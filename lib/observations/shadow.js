import { saveObservationShadowBatch } from "../fall/store.js";

export async function recordObservationShadowSamples(observations, { now = Date.now() } = {}) {
  const samples = (observations?.anchors || []).filter((anchor) => Number.isFinite(anchor.temperatureResidualF)).map((anchor) => ({
    recordedAt: new Date(now).toISOString(),
    observedAt: anchor.observedAt,
    stationId: anchor.id,
    providerStationId: anchor.stationId,
    destinationId: anchor.destinationId,
    terrainRole: anchor.terrainRole,
    elevationFeet: anchor.elevationFeet,
    observedTemperatureF: anchor.temperatureF,
    observedHumidityPct: anchor.humidityPct,
    observedWindMph: anchor.windMph,
    forecastTemperatureF: anchor.forecastTemperatureF,
    forecastTimestamp: anchor.forecastTimestamp,
    forecastCloudCover: anchor.forecastCloudCover,
    forecastWindMph: anchor.forecastWindMph,
    residualF: anchor.temperatureResidualF,
    baseWeight: anchor.baseWeight ?? anchor.weight,
    effectiveWeight: anchor.effectiveWeight ?? anchor.weight,
    healthStatus: anchor.health?.status || "unknown",
    crossStationStatus: anchor.crossStationStatus || "normal",
    comparisonMethod: anchor.comparisonMethod,
    localHour: easternHour(anchor.observedAt),
    weatherRegime: weatherRegime(anchor)
  }));
  const summary = summarizeSamples(samples);
  if (!samples.length) return { mode: "none", samples: 0, summary };

  console.info(JSON.stringify({ event: "fall_observation_shadow", at: new Date(now).toISOString(), samples, summary }));
  const persisted = await saveObservationShadowBatch({ recordedAt: new Date(now).toISOString(), samples, summary });
  return { mode: persisted ? "kv+logs" : "logs-only", samples: samples.length, summary };
}

export function summarizeSamples(samples = []) {
  const residuals = samples.map((sample) => Number(sample.residualF)).filter(Number.isFinite);
  if (!residuals.length) return { meanBiasF: null, meanAbsoluteErrorF: null, maxAbsoluteErrorF: null };
  return {
    meanBiasF: round(residuals.reduce((sum, value) => sum + value, 0) / residuals.length, 2),
    meanAbsoluteErrorF: round(residuals.reduce((sum, value) => sum + Math.abs(value), 0) / residuals.length, 2),
    maxAbsoluteErrorF: round(Math.max(...residuals.map(Math.abs)), 2)
  };
}

function round(value, digits) { const factor = 10 ** digits; return Math.round(value * factor) / factor; }
function easternHour(value) { return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(value))) % 24; }
function weatherRegime(anchor) {
  const cloud = finiteNumber(anchor.forecastCloudCover);
  const wind = finiteNumber(anchor.forecastWindMph);
  if (Number.isFinite(cloud) && Number.isFinite(wind) && cloud <= 0.35 && wind <= 5) return "radiational";
  if (Number.isFinite(wind) && wind >= 15) return "windy";
  if (Number.isFinite(cloud) && cloud >= 0.75) return "cloudy";
  return "mixed";
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
