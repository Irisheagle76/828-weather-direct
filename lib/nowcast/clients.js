import { NOWCAST_CONFIG } from "./config.js";

const { latitude, longitude } = NOWCAST_CONFIG.location;
const userAgent = process.env.NWS_USER_AGENT || "828 Weather Nowcast Console (avlweather.com)";
const sourceCache = new Map();
const sourceRequests = new Map();

export async function fetchTempestObservation(now = Date.now()) {
  return cachedSource("tempest", NOWCAST_CONFIG.cacheMs.tempest, () => fetchTempestObservationUncached(now));
}

async function fetchTempestObservationUncached(now) {
  const stationId = String(process.env.TEMPEST_STATION_ID || "").trim();
  const token = String(process.env.TEMPEST_TOKEN || "").trim();
  if (!stationId || !token) throw new Error("Tempest credentials are not configured");

  const response = await fetchWithTimeout(`https://swd.weatherflow.com/swd/rest/observations/station/${encodeURIComponent(stationId)}?token=${encodeURIComponent(token)}`, 12_000);
  if (!response.ok) throw new Error(`Tempest returned HTTP ${response.status}`);
  const data = await response.json();
  const obs = data?.obs?.[0];
  if (!obs || typeof obs !== "object") throw new Error("Tempest returned no station observation");

  return normalizeTempestObservation(obs, now);
}

export function normalizeTempestObservation(obs, now = Date.now()) {
  const arrayFormat = Array.isArray(obs);
  const timestamp = normalizeTimestamp(arrayFormat ? obs[0] : obs.timestamp) || now;
  const temperatureC = finite(arrayFormat ? obs[7] : obs.air_temperature);
  const humidity = finite(arrayFormat ? obs[8] : obs.relative_humidity);
  const dewPointC = finite(arrayFormat ? null : obs.dew_point);
  return {
    timestamp,
    temperatureF: cToF(temperatureC),
    dewPointF: cToF(dewPointC ?? deriveDewPointC(temperatureC, humidity)),
    humidityPct: humidity,
    feelsLikeF: cToF(arrayFormat ? temperatureC : obs.feels_like ?? temperatureC),
    windDirectionDeg: finite(arrayFormat ? obs[4] : obs.wind_direction),
    windSpeedMph: msToMph(arrayFormat ? obs[2] : obs.wind_avg),
    windGustMph: msToMph(arrayFormat ? obs[3] : obs.wind_gust),
    pressureMb: finite(arrayFormat ? obs[6] : obs.sea_level_pressure ?? obs.barometric_pressure ?? obs.station_pressure),
    rainRateInPerHour: mmToInches(rainRateMmPerHour(obs)),
    rainAccumulationIn: mmToInches(arrayFormat ? obs[12] : obs.precip_accum_local_day),
    lightningDistanceMiles: kmToMiles(arrayFormat ? obs[14] : obs.lightning_strike_last_distance),
    lightningCount: finite(arrayFormat ? obs[15] : obs.lightning_strike_count) ?? 0,
    uvIndex: finite(arrayFormat ? obs[10] : obs.uv),
    solarRadiationWm2: finite(arrayFormat ? obs[11] : obs.solar_radiation),
    source: "Tempest",
    freshness: now - timestamp > NOWCAST_CONFIG.thresholds.staleTempestMinutes * 60_000 ? "stale" : "fresh",
    fetchStatus: "success",
    fetchedAt: now
  };
}

export async function fetchNwsBundle(now = Date.now()) {
  return cachedSource("nwsForecast", NOWCAST_CONFIG.cacheMs.nwsForecast, () => fetchNwsBundleUncached(now));
}

async function fetchNwsBundleUncached(now) {
  const headers = { Accept: "application/geo+json", "User-Agent": userAgent };
  const pointResponse = await fetchWithTimeout(`https://api.weather.gov/points/${latitude},${longitude}`, 12_000, headers);
  if (!pointResponse.ok) throw new Error(`NWS points returned HTTP ${pointResponse.status}`);
  const point = await pointResponse.json();
  const forecastUrl = point?.properties?.forecast;
  const hourlyUrl = point?.properties?.forecastHourly;
  if (!forecastUrl || !hourlyUrl) throw new Error("NWS points response omitted forecast URLs");

  const [pointForecastResult, hourlyForecastResult] = await Promise.allSettled([
    fetchNwsForecast(forecastUrl, "point", now, headers),
    fetchNwsForecast(hourlyUrl, "hourly", now, headers)
  ]);
  return {
    point: settledValue(pointForecastResult),
    hourly: settledValue(hourlyForecastResult),
    grid: {
      office: point?.properties?.gridId || null,
      zone: point?.properties?.forecastZone || null,
      county: point?.properties?.county || null
    }
  };
}

export async function fetchNwsAlerts(now = Date.now()) {
  return cachedSource("nwsAlerts", NOWCAST_CONFIG.cacheMs.nwsAlerts, () => fetchNwsAlertsUncached(now));
}

async function fetchNwsAlertsUncached(now) {
  const response = await fetchWithTimeout(`https://api.weather.gov/alerts/active?point=${latitude},${longitude}`, 12_000, { Accept: "application/geo+json", "User-Agent": userAgent });
  if (!response.ok) throw new Error(`NWS alerts returned HTTP ${response.status}`);
  const data = await response.json();
  return (data?.features || []).map(feature => {
    const p = feature.properties || {};
    return {
      id: feature.id || p.id || p.identifier,
      event: p.event || "Weather alert",
      severity: p.severity || "Unknown",
      urgency: p.urgency || "Unknown",
      certainty: p.certainty || "Unknown",
      headline: p.headline || "",
      effective: p.effective || p.onset || null,
      expires: p.expires || p.ends || null,
      area: p.areaDesc || "",
      description: p.description || "",
      instruction: p.instruction || "",
      sent: p.sent || null,
      source: "National Weather Service",
      url: feature.id || null
    };
  }).filter(alert => alert.id);
}

async function fetchNwsForecast(url, kind, now, headers) {
  const response = await fetchWithTimeout(url, 12_000, headers);
  if (!response.ok) throw new Error(`NWS ${kind} forecast returned HTTP ${response.status}`);
  const data = await response.json();
  const p = data.properties || {};
  return {
    kind,
    updatedAt: normalizeTimestamp(p.updateTime || p.updated || p.generatedAt) || now,
    generatedAt: normalizeTimestamp(p.generatedAt) || null,
    fetchedAt: now,
    source: "National Weather Service",
    periods: (p.periods || []).slice(0, kind === "hourly" ? 12 : 8).map(period => ({
      number: period.number,
      name: period.name || "",
      startTime: period.startTime || null,
      endTime: period.endTime || null,
      isDaytime: period.isDaytime,
      temperatureF: finite(period.temperature),
      temperatureUnit: period.temperatureUnit || "F",
      precipProbabilityPct: finite(period.probabilityOfPrecipitation?.value),
      windSpeed: period.windSpeed || "",
      windSpeedMph: parseWindMph(period.windSpeed),
      windDirection: period.windDirection || "",
      shortForecast: period.shortForecast || "",
      detailedForecast: period.detailedForecast || ""
    }))
  };
}

function settledValue(result) {
  if (result.status === "fulfilled") return { ok: true, data: result.value, error: null };
  return { ok: false, data: null, error: String(result.reason?.message || result.reason) };
}

async function fetchWithTimeout(url, timeoutMs, headers = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeTimestamp(value) {
  if (!value) return null;
  const number = Number(value);
  if (Number.isFinite(number)) return number < 1e12 ? number * 1_000 : number;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cToF(value) {
  const number = finite(value);
  return number === null ? null : number * 9 / 5 + 32;
}

function msToMph(value) {
  const number = finite(value);
  return number === null ? null : number * 2.236936;
}

function mmToInches(value) {
  const number = finite(value);
  return number === null ? null : number / 25.4;
}

function kmToMiles(value) {
  const number = finite(value);
  return number === null ? null : number * 0.621371;
}

function rainRateMmPerHour(obs) {
  if (!Array.isArray(obs)) {
    const accumulation = finite(obs?.precip) || 0;
    return accumulation * 60;
  }
  const accumulation = finite(obs[12]) || 0;
  const interval = finite(obs[17]) || 1;
  return interval > 0 ? accumulation * (60 / interval) : 0;
}

function deriveDewPointC(tempC, humidity) {
  if (!Number.isFinite(tempC) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

function parseWindMph(value) {
  const values = String(value || "").match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  return values.length ? Math.max(...values) : null;
}

async function cachedSource(key, ttlMs, operation) {
  const cached = sourceCache.get(key);
  if (cached && Date.now() - cached.storedAt < ttlMs) return cached.value;
  if (sourceRequests.has(key)) return sourceRequests.get(key);
  const request = operation()
    .then(value => {
      sourceCache.set(key, { storedAt: Date.now(), value });
      return value;
    })
    .finally(() => sourceRequests.delete(key));
  sourceRequests.set(key, request);
  return request;
}
