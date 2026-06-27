import { buildPayload as buildLiveSkyPayload } from "../sky/current.js";
import { fetchRadarAnalysis } from "../../storm/radar.js";
import { buildStormSignal } from "../../storm/signal.js";

const SKY_SNAPSHOT_URL =
  "https://raw.githubusercontent.com/Irisheagle76/828-weather-direct/main/public/js/sky-cam/output.json";
const CACHE_MS = 90 * 1000;
const SNAPSHOT_MAX_AGE_MS = 30 * 60 * 1000;

let memoryCache = null;

function dewPointC(tempC, humidity) {
  if (!Number.isFinite(tempC) || !Number.isFinite(humidity) || humidity <= 0) return null;
  const a = 17.27;
  const b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
  return (b * alpha) / (a - alpha);
}

async function fetchJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "828 Weather Direct storm signal/1.0" }
    });
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTempestObservation() {
  const stationId = process.env.TEMPEST_STATION_ID;
  const token = process.env.TEMPEST_TOKEN;
  if (stationId && token) {
    try {
      const payload = await fetchJson(
        `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}`
      );
      const observation = payload?.obs?.[0];
      if (Array.isArray(observation)) {
        const airTemperatureC = Number(observation[7]);
        const humidity = Number(observation[8]);
        return {
          observedAt: Number(observation[0]) * 1000,
          airTemperatureC,
          dewPointC: dewPointC(airTemperatureC, humidity),
          humidity,
          lightningCount: Number(observation[15]) || 0
        };
      }
    } catch {
      // Use the site's already-normalized Tempest endpoint below.
    }
  }

  const fallback = await fetchJson("https://avlweather.com/api/router?route=tempest/device");
  const observation = fallback?.station_observation || fallback?.current_conditions;
  if (!observation) throw new Error("Tempest observation unavailable");
  return {
    observedAt: observation.timestamp ?? Date.now(),
    airTemperatureC: Number(observation.air_temperature),
    dewPointC: Number(observation.dew_point),
    humidity: Number(observation.relative_humidity),
    lightningCount: Number(observation.lightningStrikeCount) || 0
  };
}

async function fetchScheduledSkySnapshot() {
  const payload = await fetchJson(`${SKY_SNAPSHOT_URL}?t=${Date.now()}`);
  const timestamp = Date.parse(payload?.timestamp);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > SNAPSHOT_MAX_AGE_MS) return null;
  return payload;
}

function combineSky(liveSky, scheduledSky) {
  const liveMetrics = liveSky?.metrics || {};
  const scheduledMetrics = scheduledSky?.metrics || {};
  const trend = scheduledSky?.trend || liveSky?.trend || {};
  return {
    ...scheduledMetrics,
    ...liveMetrics,
    cloudTrend: trend.cloudTrend,
    brightnessTrend: trend.brightnessTrend,
    overallTrend: trend.overallTrend
  };
}

async function optional(promise, fallback = null) {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

async function buildStormPayload() {
  const [radar, liveSky, scheduledSky, weather] = await Promise.all([
    optional(fetchRadarAnalysis(), { available: false }),
    optional(buildLiveSkyPayload()),
    optional(fetchScheduledSkySnapshot()),
    optional(fetchTempestObservation(), {})
  ]);
  const sky = combineSky(liveSky, scheduledSky);
  const signal = buildStormSignal({ radar, sky, weather });

  return {
    timestamp: new Date().toISOString(),
    signal,
    radar,
    sky: {
      cloudCoverWest: sky.cloudCoverWest ?? null,
      cloudTrend: sky.cloudTrend ?? "unknown",
      brightnessTrend: sky.brightnessTrend ?? "unknown",
      satelliteCloudMotionSignal: sky.satelliteCloudMotionSignal ?? false,
      satelliteCloudFraction: sky.satelliteCloudFraction ?? null,
      buildingCloudStructureSignal: sky.buildingCloudStructureSignal ?? false,
      buildingCloudStructureScore: sky.buildingCloudStructureScore ?? null,
      mode: sky.mode ?? "unknown"
    },
    weather
  };
}

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.timestamp > CACHE_MS) {
      memoryCache = { timestamp: now, payload: await buildStormPayload() };
    }
    res.setHeader("Cache-Control", "s-maxage=90, stale-while-revalidate=90");
    return res.status(200).json(memoryCache.payload);
  } catch (error) {
    return res.status(503).json({ error: error.message || "Storm signal unavailable" });
  }
}

export { buildStormPayload, combineSky, fetchTempestObservation };
