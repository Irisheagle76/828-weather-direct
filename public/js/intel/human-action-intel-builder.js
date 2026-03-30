// /intel/human-action-intel-builder.js
// ============================================================
// HUMAN-ACTION INTEL BUILDER — HA 2.1 (Today Blend + HA2.0 Tomorrow)
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// SYNTHESIZER SAFETY WRAPPER
// ------------------------------------------------------------
function ensureSynthFields(intel, snapshot) {
  const base = intel ?? {};

  return {
    factors: Array.isArray(base.factors) ? base.factors : [],
    precipType: base.precipType ?? snapshot?.precipType ?? "none",
    precipChance: base.precipChance ?? 0,
    snapshot: snapshot ?? base.snapshot ?? {},
    ...base
  };
}

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

  const now = Date.now();
  const currentIndex = hourly.findIndex(h => h.timestamp >= now);
  const idx = currentIndex === -1 ? 0 : currentIndex;

  // ------------------------------------------------------------
  // TODAY — current hour + next 3 hours blended (A1)
  // ------------------------------------------------------------
  const todayHours = hourly.slice(idx, idx + 4);
  const todaySnapshot = blendHours(todayHours);

  const todayIntelRaw = evaluateHumanActionFactors(todaySnapshot) || {};
  const todayIntel = ensureSynthFields(todayIntelRaw, todaySnapshot);

  // ------------------------------------------------------------
  // TOMORROW — HA 2.0 morning/afternoon hybrid
  // ------------------------------------------------------------
  const tomorrowBundle = buildTomorrowSnapshots(hourly);

  const tomorrowSnapshot =
    tomorrowBundle.afternoon ??
    tomorrowBundle.morning ??
    blendHours(hourly.slice(24, 28));

  const tomorrowIntelRaw = evaluateHumanActionFactors(tomorrowSnapshot) || {};
  const tomorrowIntel = {
    ...ensureSynthFields(tomorrowIntelRaw, tomorrowSnapshot),
    stats: tomorrowBundle.stats
  };

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel
  };
}

// ------------------------------------------------------------
// BLEND HOURS (A1)
// ------------------------------------------------------------
function blendHours(hours) {
  if (!hours || !hours.length) return null;

  const avg = key =>
    hours.reduce((a, h) => a + (h[key] ?? 0), 0) / hours.length;

  return {
    temp: avg("temperatureF"),
    feelsLike: avg("apparentF"),
    dewPoint: avg("dewpointF"),
    humidity: avg("relative_humidity"),
    windSpeed: avg("wind_speed"),
    windGust: avg("wind_gust"),
    precipType:
      avg("precipitation") > 0
        ? (avg("snowfall") > 0 ? "snow" : "rain")
        : "none",
    precipIntensity: avg("precipitation"),
    uvIndex: avg("uv_index"),
    visibility: avg("visibility"),
    cloudCover: avg("cloud_cover"),
    smokeIndex: avg("smoke_index"),
    frostRisk: avg("frost_risk"),
    freezeRisk: avg("freeze_risk"),
    inversionRisk: avg("inversion_risk"),
    blackIceRisk: avg("black_ice_risk"),
    valleyFogRisk: avg("valley_fog_risk"),
    ridgeFogRisk: avg("ridge_fog_risk"),
    timestamp: hours[0].timestamp
  };
}

// ------------------------------------------------------------
// TOMORROW SNAPSHOTS (HA 2.0)
// ------------------------------------------------------------
function buildTomorrowSnapshots(hourly) {
  const tomorrowHours = hourly.slice(24, 48);

  if (!tomorrowHours.length) {
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
  if (!hours || !hours.length) return null;

  const avg = key =>
    hours.reduce((a, h) => a + (h[key] ?? 0), 0) / hours.length;

  return {
    temperatureF: avg("temperatureF"),
    apparentF: avg("apparentF"),
    dewpointF: avg("dewpointF"),
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
// NORMALIZE SNAPSHOT
// ------------------------------------------------------------
function normalizeSnapshot(h) {
  if (!h) return null;

  return {
    temp: h.temperatureF ?? null,
    feelsLike: h.apparentF ?? h.temperatureF ?? null,
    dewPoint: h.dewpointF ?? null,
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
// TOMORROW STATS
// ------------------------------------------------------------
function computeTomorrowStats(hours) {
  if (!hours || !hours.length) return {};

  const temps = hours.map(h => h.temperatureF ?? 0);
  const gusts = hours.map(h => h.wind_gust ?? 0);
  const winds = hours.map(h => h.wind_speed ?? 0);

  const tempMin = Math.min(...temps);
  const tempMax = Math.max(...temps);
  const tempSwing = tempMax - tempMin;

  const windGustMax = Math.max(...gusts);
  const windAvg = winds.reduce((a, b) => a + b, 0) / winds.length;

  const dewpointAvg =
    hours.reduce((a, h) => a + (h.dewpointF ?? 0), 0) / hours.length;

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
