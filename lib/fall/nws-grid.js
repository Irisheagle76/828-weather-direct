const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const TIME_ZONE = "America/New_York";

export function normalizeNwsGrid(grid, destination, { now = Date.now(), days = 5 } = {}) {
  const properties = grid?.properties || {};
  const start = floorHour(now);
  const end = start + days * DAY_MS;
  const series = {
    temperatureF: expandSeries(properties.temperature, start, end, convertTemperature),
    dewpointF: expandSeries(properties.dewpoint, start, end, convertTemperature),
    relativeHumidity: expandSeries(properties.relativeHumidity, start, end, percentFraction),
    precipProbability: expandSeries(properties.probabilityOfPrecipitation, start, end, percentFraction),
    precipitation: expandSeries(properties.quantitativePrecipitation, start, end, convertPrecipitation, { distribute: true }),
    cloudCover: expandSeries(properties.skyCover, start, end, percentFraction),
    windSpeed: expandSeries(properties.windSpeed, start, end, convertSpeed),
    windGust: expandSeries(properties.windGust, start, end, convertSpeed),
    visibilityMiles: expandSeries(properties.visibility, start, end, convertVisibility)
  };

  const hourly = [];
  for (let timestamp = start; timestamp < end; timestamp += HOUR_MS) {
    const hour = { timestamp };
    for (const [key, values] of Object.entries(series)) hour[key] = values.get(timestamp) ?? null;
    hour.isRainingNow = Number(hour.precipitation) >= 0.005;
    hourly.push(hour);
  }
  const daily = buildDaily(hourly, destination);
  const dailyByKey = new Map(daily.map((day) => [day.date, day]));
  hourly.forEach((hour) => {
    const day = dailyByKey.get(localDay(hour.timestamp));
    hour.sunrise = day?.sunrise ?? null;
    hour.sunset = day?.sunset ?? null;
  });

  const usableHours = hourly.filter(hasCoreForecast).length;
  const gridElevationFeet = convertElevation(properties.elevation);
  const elevationDeltaFeet = Number.isFinite(gridElevationFeet) ? Math.round(destination.elevationFeet - gridElevationFeet) : null;
  const elevationConfidence = confidenceForElevationDelta(elevationDeltaFeet);
  const updated = properties.updateTime || properties.generatedAt || null;
  const ageHours = updated ? Math.max(0, (now - Date.parse(updated)) / HOUR_MS) : null;

  return {
    ...destination,
    hourly,
    daily,
    nws: { gridElevationFeet, elevationDeltaFeet, elevationConfidence, updated, ageHours: Number.isFinite(ageHours) ? Number(ageHours.toFixed(1)) : null },
    dataQuality: { available: usableHours >= 12, usableHours, expectedHours: hourly.length, freshness: Number.isFinite(ageHours) && ageHours <= 12 ? "fresh" : "stale", elevationConfidence }
  };
}

export function buildDaily(hourly, destination) {
  const grouped = new Map();
  for (const hour of hourly) {
    const key = localDay(hour.timestamp);
    grouped.set(key, [...(grouped.get(key) || []), hour]);
  }
  return [...grouped.entries()].slice(0, 5).map(([key, hours]) => {
    const temperatures = finite(hours.map((hour) => hour.temperatureF));
    const precipitation = finite(hours.map((hour) => hour.precipitation));
    const pop = finite(hours.map((hour) => hour.precipProbability));
    const clouds = finite(hours.map((hour) => hour.cloudCover));
    const solar = solarTimes(key, destination.latitude, destination.longitude);
    return {
      date: key,
      timestamp: hours[0]?.timestamp ?? null,
      tempMax: temperatures.length ? Math.max(...temperatures) : null,
      tempMin: temperatures.length ? Math.min(...temperatures) : null,
      precipProbability: pop.length ? Math.max(...pop) : null,
      precipAmount: precipitation.length ? precipitation.reduce((sum, value) => sum + value, 0) : null,
      cloudCover: clouds.length ? clouds.reduce((sum, value) => sum + value, 0) / clouds.length : null,
      sunrise: solar.sunrise,
      sunset: solar.sunset
    };
  });
}

export function parseValidTime(validTime) {
  const [startText, durationText = "PT1H"] = String(validTime || "").split("/");
  const start = Date.parse(startText);
  const match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?)?$/.exec(durationText);
  if (!Number.isFinite(start) || !match) return null;
  const durationMs = ((Number(match[1]) || 0) * 1440 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0)) * 60000;
  return { start, durationMs: durationMs || HOUR_MS, hours: Math.max(1, Math.ceil((durationMs || HOUR_MS) / HOUR_MS)) };
}

function expandSeries(property, rangeStart, rangeEnd, converter, { distribute = false } = {}) {
  const result = new Map();
  for (const item of property?.values || []) {
    const interval = parseValidTime(item?.validTime);
    const converted = converter(item?.value, property?.uom || property?.unitCode);
    if (!interval || !Number.isFinite(converted)) continue;
    const value = distribute ? converted / interval.hours : converted;
    const first = Math.max(floorHour(interval.start), rangeStart);
    const last = Math.min(interval.start + interval.durationMs, rangeEnd);
    for (let timestamp = first; timestamp < last; timestamp += HOUR_MS) result.set(timestamp, value);
  }
  return result;
}

// NOAA solar equations, sufficient for planning-scale sunrise and sunset windows.
function solarTimes(dateKey, latitude, longitude) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { sunrise: solarEvent(year, month, day, latitude, longitude, true), sunset: solarEvent(year, month, day, latitude, longitude, false) };
}
function solarEvent(year, month, day, latitude, longitude, sunrise) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfYear = Math.floor((date.getTime() - Date.UTC(year, 0, 0)) / DAY_MS);
  const lngHour = longitude / 15;
  const t = dayOfYear + ((sunrise ? 6 : 18) - lngHour) / 24;
  const meanAnomaly = 0.9856 * t - 3.289;
  let trueLongitude = normalizeDegrees(meanAnomaly + 1.916 * sin(meanAnomaly) + 0.02 * sin(2 * meanAnomaly) + 282.634);
  let rightAscension = normalizeDegrees(atan(0.91764 * tan(trueLongitude)));
  rightAscension += Math.floor(trueLongitude / 90) * 90 - Math.floor(rightAscension / 90) * 90;
  rightAscension /= 15;
  const sinDeclination = 0.39782 * sin(trueLongitude);
  const cosDeclination = Math.cos(Math.asin(sinDeclination));
  const cosHour = (Math.cos(toRadians(90.833)) - sinDeclination * sin(latitude)) / (cosDeclination * Math.cos(toRadians(latitude)));
  if (cosHour < -1 || cosHour > 1) return null;
  const localHour = (sunrise ? 360 - toDegrees(Math.acos(cosHour)) : toDegrees(Math.acos(cosHour))) / 15;
  const utcHour = normalizeHours(localHour + rightAscension - 0.06571 * t - 6.622 - lngHour);
  return Date.UTC(year, month - 1, day) + utcHour * HOUR_MS;
}

function convertTemperature(value, uom = "") { if (!Number.isFinite(value)) return null; if (/degC/i.test(uom)) return value * 9 / 5 + 32; if (/K$/i.test(uom)) return (value - 273.15) * 9 / 5 + 32; return value; }
function convertSpeed(value, uom = "") { if (!Number.isFinite(value)) return null; if (/km_h/i.test(uom)) return value * 0.621371; if (/m_s/i.test(uom)) return value * 2.23694; return value; }
function convertPrecipitation(value, uom = "") { if (!Number.isFinite(value)) return null; if (/mm|kg_m-2/i.test(uom)) return value / 25.4; return value; }
function convertVisibility(value, uom = "") { if (!Number.isFinite(value)) return null; if (/wmoUnit:m$|unit:m$/i.test(uom)) return value / 1609.344; if (/km/i.test(uom)) return value * 0.621371; return value; }
function convertElevation(property) { const value = property?.value; if (!Number.isFinite(value)) return null; return /wmoUnit:m$|unit:m$/i.test(property?.unitCode || property?.uom || "") ? Math.round(value * 3.28084) : Math.round(value); }
function percentFraction(value) { return Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : null; }
function confidenceForElevationDelta(delta) { const magnitude = Math.abs(Number(delta)); return !Number.isFinite(magnitude) ? "unknown" : magnitude <= 500 ? "high" : magnitude <= 1500 ? "medium" : "low"; }
function hasCoreForecast(hour) { return Number.isFinite(hour.temperatureF) && Number.isFinite(hour.cloudCover) && Number.isFinite(hour.windSpeed); }
function finite(values) { return values.filter(Number.isFinite); }
function floorHour(value) { return Math.floor(value / HOUR_MS) * HOUR_MS; }
function localDay(value) { return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function toRadians(value) { return value * Math.PI / 180; }
function toDegrees(value) { return value * 180 / Math.PI; }
function sin(value) { return Math.sin(toRadians(value)); }
function tan(value) { return Math.tan(toRadians(value)); }
function atan(value) { return toDegrees(Math.atan(value)); }
function normalizeDegrees(value) { return ((value % 360) + 360) % 360; }
function normalizeHours(value) { return ((value % 24) + 24) % 24; }
