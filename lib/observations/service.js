import { evaluateObservationHealth, resetObservationHealthHistory } from "./health.js";
import { buildCompositeObservation, fetchProviderObservation } from "./providers.js";
import { OBSERVATION_STATIONS, SOURCE_STATIONS, STATION_BY_ID } from "./registry.js";

const CACHE_MS = 5 * 60 * 1000;
const LAST_GOOD_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 6;
const DEFAULT_FALLBACK_URL = "https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/data/hiking-guidance.json";

let networkCache = null;
const lastGoodById = new Map();

export async function getElevationObservations({ now = Date.now(), fetcher = fetch, credentials = environmentCredentials(), fallbackUrl = process.env.FALL_OBSERVATIONS_URL || DEFAULT_FALLBACK_URL, force = false } = {}) {
  if (!force && networkCache && now - networkCache.timestamp <= CACHE_MS) return networkCache.payload;

  const fallbackPromise = loadArtifactFallback(fallbackUrl, fetcher).catch(() => null);
  const results = await mapLimit(SOURCE_STATIONS, CONCURRENCY, async (station) => {
    try {
      const observation = await fetchProviderObservation(station, { fetcher, credentials, now });
      return { station, observation, mode: "live" };
    } catch (error) {
      return { station, error: error.message };
    }
  });
  const artifact = await fallbackPromise;
  const artifactById = new Map((artifact?.stations || []).map((station) => [station.id, station]));
  const sourceObservations = [];
  const failures = [];

  for (const result of results) {
    let observation = result.observation;
    let mode = result.mode;
    if (!observation) {
      const artifactObservation = artifactById.get(result.station.id);
      const memoryObservation = lastGoodById.get(result.station.id);
      observation = artifactObservation || (memoryObservation && now - Date.parse(memoryObservation.observedAt) <= LAST_GOOD_MS ? memoryObservation : null);
      mode = artifactObservation ? "artifact-fallback" : observation ? "memory-fallback" : "unavailable";
    }
    if (!observation) {
      failures.push({ id: result.station.id, provider: result.station.provider, reason: result.error || "No observation returned" });
      continue;
    }
    const normalized = { ...observation, id: result.station.id, stationId: result.station.providerStationId, provider: result.station.provider, source: observation.source || providerLabel(result.station.provider), name: result.station.name, role: result.station.role, elevationFt: result.station.elevationFt, lat: finite(observation.lat) ?? result.station.latitude, lon: finite(observation.lon) ?? result.station.longitude, url: result.station.url, retrievalMode: mode };
    const health = evaluateObservationHealth(normalized, result.station, { now });
    const withHealth = { ...normalized, status: health.usable ? "live" : health.status, health };
    sourceObservations.push(withHealth);
    if (health.usable && mode === "live") lastGoodById.set(result.station.id, withHealth);
    if (!health.usable) failures.push({ id: result.station.id, provider: result.station.provider, reason: health.issues.map((item) => item.code).join(",") });
  }

  const sourceById = new Map(sourceObservations.map((observation) => [observation.id, observation]));
  const composites = OBSERVATION_STATIONS.filter((station) => station.provider === "composite").map((station) => {
    const components = station.componentIds.map((id) => sourceById.get(id)).filter((item) => item?.health?.usable);
    try {
      const observation = buildCompositeObservation(station, components);
      const health = evaluateObservationHealth(observation, station, { now });
      return { ...observation, status: health.usable ? "live" : health.status, health, retrievalMode: components.every((item) => item.retrievalMode === "live") ? "live" : "mixed-fallback" };
    } catch (error) {
      failures.push({ id: station.id, provider: station.provider, reason: error.message });
      return null;
    }
  }).filter(Boolean);

  const stations = [...sourceObservations.filter((observation) => !STATION_BY_ID.get(observation.id)?.componentOnly), ...composites];
  const usable = stations.filter((station) => station.health?.usable);
  const live = usable.filter((station) => station.retrievalMode === "live");
  const providers = Object.fromEntries(["tempest", "wunderground", "econet", "composite"].map((provider) => {
    const providerStations = stations.filter((station) => station.provider === provider);
    return [provider, { requested: provider === "composite" ? OBSERVATION_STATIONS.filter((station) => station.provider === provider).length : SOURCE_STATIONS.filter((station) => station.provider === provider && !station.componentOnly).length, available: providerStations.filter((station) => station.health?.usable).length }];
  }));
  const requested = OBSERVATION_STATIONS.filter((station) => !station.componentOnly && station.provider !== "composite").length + OBSERVATION_STATIONS.filter((station) => station.provider === "composite").length;
  const payload = {
    generatedAt: new Date(now).toISOString(),
    source: "828 live elevation observation network",
    stations,
    quality: {
      status: usable.length >= Math.ceil(requested * 0.75) ? "fresh" : usable.length ? "partial" : "unavailable",
      requestedStations: requested,
      availableStations: usable.length,
      directLiveStations: live.length,
      fallbackStations: usable.length - live.length,
      providers,
      failures
    }
  };
  networkCache = { timestamp: now, payload };
  console.info(JSON.stringify({ event: "elevation_observation_refresh", at: payload.generatedAt, quality: payload.quality.status, available: usable.length, requested, failures: failures.length }));
  return payload;
}

export function resetElevationObservationCache() {
  networkCache = null;
  lastGoodById.clear();
  resetObservationHealthHistory();
}

export function environmentCredentials() {
  return { weatherFlowApiKey: process.env.WEATHERFLOW_API_KEY || null, weatherUndergroundApiKey: process.env.WEATHER_UNDERGROUND_API_KEY || process.env.WU_API_KEY || null };
}

async function loadArtifactFallback(url, fetcher) {
  if (!url) return null;
  const response = await fetcher(url, { headers: { accept: "application/json", "user-agent": "828WeatherDirect/1.0 (https://avlweather.com)" }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error(`Observation artifact failed (${response.status})`);
  return response.json();
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

function finite(value) { if (value == null || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function providerLabel(provider) { return provider === "tempest" ? "Tempest" : provider === "wunderground" ? "Weather Underground" : provider === "econet" ? "NC ECONet" : provider; }
