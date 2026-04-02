// /intel/human-action-intel-builder.js
// ============================================================
// HUMAN-ACTION INTEL BUILDER — HA 2.3 (Synthesizer-Ready)
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// SYNTHESIZER SAFETY WRAPPER
// Ensures required fields exist even if HA engine omits them
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

console.log("HA TODAY", intel.today);
console.log("HA TOMORROW", intel.tomorrow);

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
  // TODAY — current hour + next 3 hours, with slight forward blend
  // ------------------------------------------------------------
  const todayCore = hourly.slice(idx, idx + 4);
  const todayExtended = hourly.slice(idx, idx + 8);
  const todaySnapshot = blendHoursWithForwardBias(todayCore, todayExtended);

  todaySnapshot.dayLabel = "today";
  todaySnapshot.isTomorrow = false;

  const todayIntelRaw = evaluateHumanActionFactors(todaySnapshot) || {};

  // ⭐ NEW: Merge snapshot meteorology into HA intel
  const todayIntel = {
    ...ensureSynthFields(todayIntelRaw, todaySnapshot),
    ...todaySnapshot
  };

  // ------------------------------------------------------------
  // TOMORROW — HA 2.0 morning/afternoon hybrid
  // ------------------------------------------------------------
  const tomorrowBundle = buildTomorrowSnapshots(hourly);

  const tomorrowSnapshot =
    tomorrowBundle.afternoon ??
    tomorrowBundle.morning ??
    blendHours(hourly.slice(24, 28));

  if (tomorrowSnapshot) {
    tomorrowSnapshot.dayLabel = "tomorrow";
    tomorrowSnapshot.isTomorrow = true;
  }

  const tomorrowIntelRaw = evaluateHumanActionFactors(tomorrowSnapshot) || {};

  // ⭐ NEW: Merge snapshot meteorology + tomorrow stats
  const tomorrowIntel = {
    ...ensureSynthFields(tomorrowIntelRaw, tomorrowSnapshot),
    ...tomorrowSnapshot,
    stats: tomorrowBundle.stats
  };

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel
  };
}

// ------------------------------------------------------------
// BLEND HOURS (simple average)
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
// BLEND HOURS WITH FORWARD BIAS (Today divergence helper)
// ------------------------------------------------------------
function blendHoursWithForwardBias(coreHours, extendedHours) {
  if (!coreHours || !coreHours.length) {
    return blendHours(extendedHours) ?? null;
  }

  const core = blendHours(coreHours);
  if (!extendedHours || !extendedHours.length) return core;

  const ext = blendHours(extendedHours);

  const mix = (a, b) =>
    a != null && b != null ? (0.7 * a + 0.3 * b) : (a ?? b ?? null);

  return {
    temp: mix(core.temp, ext.temp),
    feelsLike: mix(core.feelsLike, ext.feelsLike),
    dewPoint: mix(core.dewPoint, ext.dewPoint),
    humidity: mix(core.humidity, ext.humidity),
    windSpeed: mix(core.windSpeed, ext.windSpeed),
    windGust: mix(core.windGust, ext.windGust),
    precipType: core.precipType,
    precipIntensity: mix(core.precipIntensity, ext.precipIntensity),
    uvIndex: mix(core.uvIndex, ext.uvIndex),
    visibility: mix(core.visibility, ext.visibility),
    cloudCover: mix(core.cloudCover, ext.cloudCover),
    smokeIndex: mix(core.smokeIndex, ext.smokeIndex),
    frostRisk: mix(core.frostRisk, ext.frostRisk),
    freezeRisk: mix(core.freezeRisk, ext.freezeRisk),
    inversionRisk: mix(core.inversionRisk, ext.inversionRisk),
    blackIceRisk: mix(core.blackIceRisk, ext.blackIceRisk),
    valleyFogRisk: mix(core.valleyFogRisk, ext.valleyFogRisk),
    ridgeFogRisk: mix(core.ridgeFogRisk, ext.ridgeFogRisk),
    timestamp: core.timestamp
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
