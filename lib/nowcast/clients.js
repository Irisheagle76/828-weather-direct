import { NOWCAST_CONFIG } from "./config.js";

const { latitude, longitude } = NOWCAST_CONFIG.location;
const userAgent = process.env.NWS_USER_AGENT || "828 Weather Nowcast Console (avlweather.com)";
const sourceCache = new Map();
const sourceRequests = new Map();

export async function fetchTempestObservation(now = Date.now()) {
  return cachedSource("tempest", NOWCAST_CONFIG.cacheMs.tempest, () => fetchTempestObservationUncached(now));
}

async function fetchTempestObservationUncached(now) {
  const stationId = process.env.TEMPEST_STATION_ID;
  const token = process.env.TEMPEST_TOKEN;
  if (!stationId || !token) throw new Error("Tempest credentials are not configured");

  const response = await fetchWithTimeout(`https://swd.weatherflow.com/swd/rest/observations/station/${encodeURIComponent(stationId)}?token=${encodeURIComponent(token)}`, 12_000);
  if (!response.ok) throw new Error(`Tempest returned HTTP ${response.status}`);
  const data = await response.json();
  const obs = data?.obs?.[0];
  if (!Array.isArray(obs)) throw new Error("Tempest returned no station observation");

  const timestamp = normalizeTimestamp(obs[0]) || now;
  const temperatureC = finite(obs[7]);
  const humidity = finite(obs[8]);
  return {
    timestamp,
    temperatureF: cToF(temperatureC),
    dewPointF: cToF(deriveDewPointC(temperatureC, humidity)),
    humidityPct: humidity,
    feelsLikeF: cToF(temperatureC),
    windDirectionDeg: finite(obs[4]),
    windSpeedMph: msToMph(obs[2]),
    windGustMph: msToMph(obs[3]),
    pressureMb: finite(obs[6]),
    rainRateInPerHour: mmToInches(rainRateMmPerHour(obs)),
    rainAccumulationIn: mmToInches(obs[12]),
    lightningDistanceMiles: kmToMiles(obs[14]),
    lightningCount: finite(obs[15]) ?? 0,
    uvIndex: finite(obs[10]),
    solarRadiationWm2: finite(obs[11]),
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
