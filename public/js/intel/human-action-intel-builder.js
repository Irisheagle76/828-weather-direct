// /intel/human-action-intel-builder.js
// ============================================================
// HUMAN-ACTION INTEL BUILDER — Raw → Snapshots → Engine
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// MAIN BUILDER
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  if (!raw || !raw.hourly) {
    console.error("No hourly data", raw);
    return { today: null, tomorrow: null };
  }

  const hourly = normalizeOpenMeteo(raw.hourly);

  if (!hourly.length) {
    console.error("Normalized hourly empty");
    return { today: null, tomorrow: null };
  }

  // ----------------------------------------------------------
  // 1. TODAY — find closest hour to NOW
  // ----------------------------------------------------------
  const now = Date.now();
  const current =
    hourly.find(h => h.timestamp >= now) || hourly[0];

  const todaySnapshot = normalizeSnapshot(current);
  const todayIntel = evaluateHumanActionFactors(todaySnapshot);

  // ----------------------------------------------------------
  // 2. TOMORROW — build morning + afternoon hybrid
  // ----------------------------------------------------------
  const tomorrow = buildTomorrowSnapshots(hourly);
  const tomorrowIntel = evaluateHumanActionFactors(tomorrow);

  return {
    today: {
      ...todayIntel,
      snapshot: todaySnapshot
    },
    tomorrow: {
      ...tomorrowIntel,
      snapshot: tomorrow
    }
  };
}

// ------------------------------------------------------------
// NORMALIZE A SINGLE SNAPSHOT
// ------------------------------------------------------------
function normalizeSnapshot(h) {
  if (!h) return null;

  return {
    temp: h.temperature,
    feelsLike: h.feels_like ?? h.apparent_temperature ?? h.temperature,
    dewpoint: h.dewpoint,
    humidity: h.relative_humidity,
    windSpeed: h.wind_speed,
    windGust: h.wind_gust,
    precipType:
      h.precipitation > 0
        ? (h.snowfall > 0 ? "snow" : "rain")
        : "none",
    precipIntensity: h.precipitation,
    uvIndex: h.uv_index,
    visibility: h.visibility,
    cloudCover: h.cloud_cover,
    smokeIndex: h.smoke_index,
    frostRisk: h.frost_risk,
    freezeRisk: h.freeze_risk,
    inversionRisk: h.inversion_risk,
    blackIceRisk: h.black_ice_risk,
    valleyFogRisk: h.valley_fog_risk,
    ridgeFogRisk: h.ridge_fog_risk,
    timestamp: h.timestamp
  };
}

// ------------------------------------------------------------
// TOMORROW SNAPSHOTS
// ------------------------------------------------------------
function buildTomorrowSnapshots(hourly) {
  const tomorrowHours = hourly.slice(24, 48);

  if (!tomorrowHours.length) {
    console.warn("No tomorrow hours available");
    return {
      morning: null,
      afternoon: null,
      stats: {}
    };
  }

  const morning = averageWindow(tomorrowHours.slice(0, 6));
  const afternoon = averageWindow(tomorrowHours.slice(6, 12));

  const stats = computeTomorrowStats(tomorrowHours);

  return {
    morning: normalizeSnapshot(morning),
    afternoon: normalizeSnapshot(afternoon),
    stats
  };
}

// ------------------------------------------------------------
// SAFE AVERAGE WINDOW
// ------------------------------------------------------------
function averageWindow(hours) {
  if (!hours || hours.length === 0) {
    return {
      temperature: null,
      apparent_temperature: null,
      dewpoint: null,
      relative_humidity: null,
      wind_speed: 0,
      wind_gust: 0,
      precipitation: 0,
      snowfall: 0,
      uv_index: null,
      visibility: null,
      cloud_cover: null,
      smoke_index: 0,
      frost_risk: 0,
      freeze_risk: 0,
      inversion_risk: 0,
      black_ice_risk: 0,
      valley_fog_risk: 0,
      ridge_fog_risk: 0,
      timestamp: Date.now()
    };
  }

  const avg = key =>
    hours.reduce((a, h) => a + (h[key] ?? 0), 0) / hours.length;

  return {
    temperature: avg("temperature"),
    apparent_temperature: avg("apparent_temperature"),
    dewpoint: avg("dewpoint"),
    relative_humidity: avg("relative_humidity"),
    wind_speed: avg("wind_speed"),
    wind_gust: avg("wind_gust"),
    precipitation: avg("precipitation"),
    snowfall: avg("snowfall"),
    uv_index: avg("uv_index"),
    visibility: avg("visibility"),
    cloud_cover: avg("cloud_cover"),
    smoke_index: avg("smoke_index"),
    frost_risk: avg("frost_risk"),
    freeze_risk: avg("freeze_risk"),
    inversion_risk: avg("inversion_risk"),
    black_ice_risk: avg("black_ice_risk"),
    valley_fog_risk: avg("valley_fog_risk"),
    ridge_fog_risk: avg("ridge_fog_risk"),
    timestamp: hours[0].timestamp
  };
}

// ------------------------------------------------------------
// TOMORROW STATS
// ------------------------------------------------------------
function computeTomorrowStats(hours) {
  if (!hours || !hours.length) return {};

  const temps = hours.map(h => h.temperature ?? 0);
  const gusts = hours.map(h => h.wind_gust ?? 0);
  const winds = hours.map(h => h.wind_speed ?? 0);

  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const tempSwing = tempMax - tempMin;

  const windGustMax = Math.max(...gusts);
  const windAvg = winds.reduce((a, b) => a + b, 0) / winds.length;

  const dewpointAvg =
    hours.reduce((a, h) => a + (h.dewpoint ?? 0), 0) / hours.length;

  const cloudAvg =
    hours.reduce((a, h) => a + (h.cloud_cover ?? 0), 0) / hours.length;

  const rainTotal =
    hours.reduce((a, h) => a + (h.precipitation ?? 0), 0);

  const snowTotal =
    hours.reduce((a, h) => a + (h.snowfall ?? 0), 0);

  return {
    tempMin,
    tempMax,
    tempSwing,
    windGustMax,
    windAvg,
    dewpointAvg,
    cloudAvg,
    rainTotal,
    snowTotal,
    coldStart: tempMin <= 40,
    windImpact: windGustMax >= 30
  };
}