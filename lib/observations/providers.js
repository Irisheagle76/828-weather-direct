const USER_AGENT = "828WeatherDirect/1.0 (https://avlweather.com; tballisty@gmail.com)";

export async function fetchProviderObservation(station, { fetcher = fetch, credentials = {}, now = Date.now() } = {}) {
  if (station.provider === "tempest") return fetchTempestObservation(station, fetcher, credentials.weatherFlowApiKey);
  if (station.provider === "wunderground") return fetchWeatherUndergroundObservation(station, fetcher, credentials.weatherUndergroundApiKey);
  if (station.provider === "econet") return fetchEconetObservation(station, fetcher, now);
  throw new Error(`Unsupported observation provider: ${station.provider}`);
}

export async function fetchTempestObservation(station, fetcher = fetch, apiKey) {
  if (!apiKey) throw new Error("WEATHERFLOW_API_KEY is not configured");
  const params = new URLSearchParams({ api_key: apiKey, station_id: station.providerStationId, units_temp: "f", units_wind: "mph", units_pressure: "inhg", units_distance: "mi", units_precip: "in", units_other: "imperial", units_direction: "cardinal" });
  const data = await requestJson(`https://swd.weatherflow.com/swd/rest/better_forecast?${params}`, fetcher);
  const current = data?.current_conditions;
  if (!current) throw new Error(`Tempest ${station.providerStationId} returned no current observation`);
  return normalized(station, {
    observedAt: epochIso(current.time), temperatureF: current.air_temperature, feelsLikeF: current.feels_like, dewPointF: current.dew_point,
    humidityPct: current.relative_humidity, windMph: current.wind_avg, gustMph: current.wind_gust, windDirection: current.wind_direction_cardinal,
    pressure: current.sea_level_pressure, uv: current.uv, solarWm2: current.solar_radiation, rainTodayIn: current.precip_accum_local_day,
    rainRateInHr: current.precip_rate, lightningStrikes1h: current.lightning_strike_count_last_1hr, lightningStrikes3h: current.lightning_strike_count_last_3hr
  });
}

export async function fetchWeatherUndergroundObservation(station, fetcher = fetch, apiKey) {
  if (!apiKey) throw new Error("WEATHER_UNDERGROUND_API_KEY is not configured");
  const params = new URLSearchParams({ stationId: station.providerStationId, format: "json", units: "e", numericPrecision: "decimal", apiKey });
  const data = await requestJson(`https://api.weather.com/v2/pws/observations/current?${params}`, fetcher);
  const observation = data?.observations?.[0];
  if (!observation) throw new Error(`Weather Underground ${station.providerStationId} returned no current observation`);
  const imperial = observation.imperial || {};
  return normalized(station, {
    observedAt: observation.obsTimeUtc, temperatureF: imperial.temp, feelsLikeF: imperial.heatIndex ?? imperial.windChill ?? imperial.temp,
    dewPointF: imperial.dewpt, humidityPct: observation.humidity, windMph: imperial.windSpeed, gustMph: imperial.windGust,
    windDirection: observation.winddir == null ? null : `${observation.winddir}deg`, pressure: imperial.pressure, uv: observation.uv,
    solarWm2: observation.solarRadiation, rainTodayIn: imperial.precipTotal, rainRateInHr: imperial.precipRate,
    latitude: observation.lat, longitude: observation.lon
  });
}

export async function fetchEconetObservation(station, fetcher = fetch, now = Date.now()) {
  const response = await requestWithRetry("https://products.climate.ncsu.edu/oper/cardinal/scout/panels/php/ajax_currentConditions.php", fetcher, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT }, body: `station=${encodeURIComponent(station.providerStationId)}`
  });
  const data = await response.json();
  const latest = data?.latest || {};
  const observedAt = easternWallClockDate(latest.ob, now);
  if (!observedAt) throw new Error(`NC ECONet ${station.providerStationId} returned no current observation`);
  return normalized(station, {
    observedAt: observedAt.toISOString(), temperatureF: latest.air_temp, feelsLikeF: latest.air_temp, dewPointF: latest.dew, humidityPct: latest.rh,
    windMph: latest.wind_speed, gustMph: latest.wind_gust, solarWm2: latest.sr, rainRateInHr: latest.precip_rate
  });
}

export function buildCompositeObservation(station, components) {
  if (!components.length) throw new Error(`${station.name} has no usable components`);
  const observedTimes = components.map((component) => Date.parse(component.observedAt)).filter(Number.isFinite);
  if (!observedTimes.length) throw new Error(`${station.name} components have no timestamps`);
  return normalized(station, {
    observedAt: new Date(Math.min(...observedTimes)).toISOString(), temperatureF: average(components, "temperatureF"), feelsLikeF: average(components, "feelsLikeF"),
    dewPointF: average(components, "dewPointF"), humidityPct: average(components, "humidityPct"), windMph: average(components, "windMph"),
    gustMph: maximum(components, "gustMph"), pressure: average(components, "pressure"), uv: average(components, "uv"), solarWm2: average(components, "solarWm2"),
    rainTodayIn: average(components, "rainTodayIn"), rainRateInHr: average(components, "rainRateInHr"), componentStationIds: components.map((component) => component.stationId)
  }, "Weather Underground composite");
}

function normalized(station, values, source = providerLabel(station.provider)) {
  return {
    id: station.id, stationId: station.providerStationId, provider: station.provider, source, name: station.name, role: station.role,
    elevationFt: station.elevationFt, url: station.url, lat: number(values.latitude) ?? station.latitude, lon: number(values.longitude) ?? station.longitude,
    observedAt: values.observedAt || null, temperatureF: number(values.temperatureF), feelsLikeF: number(values.feelsLikeF), dewPointF: number(values.dewPointF),
    humidityPct: number(values.humidityPct), windMph: number(values.windMph), gustMph: number(values.gustMph), windDirection: values.windDirection || null,
    pressure: number(values.pressure), uv: number(values.uv), solarWm2: number(values.solarWm2), rainTodayIn: number(values.rainTodayIn), rainRateInHr: number(values.rainRateInHr),
    lightningStrikes1h: number(values.lightningStrikes1h), lightningStrikes3h: number(values.lightningStrikes3h), componentStationIds: values.componentStationIds || null
  };
}

async function requestJson(url, fetcher) {
  const response = await requestWithRetry(url, fetcher, { headers: { accept: "application/json", "user-agent": USER_AGENT } });
  return response.json();
}

async function requestWithRetry(url, fetcher, options) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(9000) });
      if (!response.ok) throw new Error(`Observation upstream failed (${response.status})`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw lastError;
}

function easternWallClockDate(value, now) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const guess = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}-04:00`);
  const alternate = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`);
  return new Date(Math.abs(guess - now) <= Math.abs(alternate - now) ? guess : alternate);
}

function epochIso(value) { const epoch = Number(value); return Number.isFinite(epoch) ? new Date(epoch * 1000).toISOString() : null; }
function number(value) { if (value == null || value === "") return null; const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function average(items, key) { const values = items.map((item) => number(item[key])).filter(Number.isFinite); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function maximum(items, key) { const values = items.map((item) => number(item[key])).filter(Number.isFinite); return values.length ? Math.max(...values) : null; }
function providerLabel(provider) { return provider === "tempest" ? "Tempest" : provider === "wunderground" ? "Weather Underground" : provider === "econet" ? "NC ECONet" : provider; }
