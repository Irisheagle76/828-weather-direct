import { DESTINATIONS } from "../../public/js/fall/config.js";
import { normalizeNwsGrid } from "../fall/nws-grid.js";
import { normalizeFallObservations } from "../fall/observations.js";
import { loadFallForecastFallback, saveFallForecastFallback } from "../fall/store.js";
import { getElevationObservations, resetElevationObservationCache } from "../observations/service.js";
import { recordObservationShadowSamples } from "../observations/shadow.js";

const HEADERS = Object.freeze({
  Accept: "application/geo+json, application/json",
  "User-Agent": "828WeatherDirect/1.0 (https://avlweather.com; tballisty@gmail.com)"
});
const FORECAST_CACHE_MS = 10 * 60 * 1000;
const POINT_CACHE_MS = 24 * 60 * 60 * 1000;
const MIN_DESTINATIONS = 3;
const CONCURRENCY = 4;

let forecastCache = null;
const pointCache = new Map();
const resourceCache = new Map();

export function resetFallCachesForTest() {
  forecastCache = null;
  pointCache.clear();
  resourceCache.clear();
  resetElevationObservationCache();
}

export default async function handler(req, res) {
  const now = Date.now();
  if (forecastCache && now - forecastCache.timestamp <= FORECAST_CACHE_MS) return send(res, forecastCache.payload, 200);

  try {
    const payload = await buildPayload({ now, observationLoader: () => getElevationObservations({ now }) });
    forecastCache = { timestamp: now, payload };
    await saveFallForecastFallback(payload);
    return send(res, payload, payload.quality.status === "partial" ? 206 : 200);
  } catch (error) {
    const fallback = forecastCache?.payload || await loadFallForecastFallback();
    if (fallback) {
      const stale = {
        ...fallback,
        quality: { ...fallback.quality, status: "stale", staleReason: error.message },
        servedAt: new Date(now).toISOString()
      };
      return send(res, stale, 206);
    }
    return res.status(503).json({ error: "NOAA/NWS Fall forecast unavailable", detail: error.message });
  }
}

export async function buildPayload({ now = Date.now(), fetcher = fetch, observationUrl = null, observationLoader = null, observationPayload = null } = {}) {
  const pointResults = await mapLimit(DESTINATIONS, CONCURRENCY, async (destination) => {
    try { return { destination, point: await resolvePoint(destination, fetcher, now) }; }
    catch (error) { return { destination, error: error.message }; }
  });

  const gridUrls = [...new Set(pointResults.map((result) => result.point?.forecastGridData).filter(Boolean))];
  const grids = await mapLimit(gridUrls, CONCURRENCY, async (url) => {
    try { return [url, await requestJson(url, fetcher)]; }
    catch (error) { return [url, { _error: error.message }]; }
  });
  const gridByUrl = new Map(grids);
  const destinations = [];
  const failures = [];

  for (const result of pointResults) {
    if (!result.point) {
      failures.push({ id: result.destination.id, name: result.destination.name, stage: "point", reason: result.error });
      continue;
    }
    const grid = gridByUrl.get(result.point.forecastGridData);
    if (!grid || grid._error) {
      failures.push({ id: result.destination.id, name: result.destination.name, stage: "grid", reason: grid?._error || "NWS grid missing" });
      continue;
    }
    const normalized = normalizeNwsGrid(grid, result.destination, { now });
    normalized.nws = { ...normalized.nws, ...result.point };
    if (!normalized.dataQuality.available) {
      failures.push({ id: result.destination.id, name: result.destination.name, stage: "normalize", reason: "Insufficient usable NWS hours" });
      continue;
    }
    destinations.push(normalized);
  }

  if (destinations.length < MIN_DESTINATIONS) throw new Error(`Only ${destinations.length} usable NWS destinations returned`);
  let rawObservations = observationPayload;
  if (!rawObservations && observationLoader) {
    try { rawObservations = await observationLoader(); }
    catch (error) { rawObservations = { generatedAt: new Date(now).toISOString(), stations: [], quality: { status: "unavailable", error: error.message } }; }
  } else if (!rawObservations && observationUrl) {
    try {
      rawObservations = await requestJson(observationUrl, fetcher);
    } catch (error) {
      rawObservations = { generatedAt: new Date(now).toISOString(), stations: [], quality: { status: "unavailable", error: error.message } };
    }
  }
  const observations = normalizeFallObservations(rawObservations, destinations, { now });
  const calibration = await recordObservationShadowSamples(observations, { now });
  const updateTimes = destinations.map((destination) => Date.parse(destination.nws.updated)).filter(Number.isFinite);
  return {
    updated: updateTimes.length ? new Date(Math.min(...updateTimes)).toISOString() : new Date(now).toISOString(),
    servedAt: new Date(now).toISOString(),
    source: "NOAA/NWS forecast grids + 828 normalization",
    destinations,
    observations,
    calibration,
    quality: {
      status: failures.length ? "partial" : "complete",
      requestedDestinations: DESTINATIONS.length,
      availableDestinations: destinations.length,
      failures,
      observations: {
        status: observations.status,
        availableAnchors: observations.availableAnchors,
        requestedAnchors: observations.requestedAnchors
      }
    }
  };
}

async function resolvePoint(destination, fetcher, now) {
  const cached = pointCache.get(destination.id);
  if (cached && now - cached.timestamp <= POINT_CACHE_MS) return cached.value;
  const point = await requestJson(`https://api.weather.gov/points/${destination.latitude},${destination.longitude}`, fetcher);
  const properties = point?.properties || {};
  if (!properties.forecastGridData) throw new Error("NWS point discovery returned no grid-data URL");
  const value = {
    office: properties.gridId || null,
    gridX: properties.gridX ?? null,
    gridY: properties.gridY ?? null,
    forecastGridData: properties.forecastGridData,
    observationStations: properties.observationStations || null
  };
  pointCache.set(destination.id, { timestamp: now, value });
  return value;
}

async function requestJson(url, fetcher) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const previous = resourceCache.get(url);
      const headers = { ...HEADERS };
      if (previous?.etag) headers["If-None-Match"] = previous.etag;
      if (previous?.lastModified) headers["If-Modified-Since"] = previous.lastModified;
      const response = await fetcher(url, { headers, signal: AbortSignal.timeout(12000) });
      if (response.status === 304 && previous?.data) return previous.data;
      if (!response.ok) throw new Error(`Upstream request failed (${response.status})`);
      const data = await response.json();
      resourceCache.set(url, { data, etag: response.headers?.get?.("etag"), lastModified: response.headers?.get?.("last-modified") });
      return data;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await delay(250 * (attempt + 1));
    }
  }
  throw lastError || new Error("Upstream request failed");
}

function send(res, payload, status) {
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
  res.setHeader("X-828-Fall-Data", payload.quality?.status || "unknown");
  return res.status(status).json(payload);
}
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const current = index++;
      results[current] = await worker(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
