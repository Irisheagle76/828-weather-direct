// /intel/human-action-intel-builder.js
// ============================================================
// HUMAN-ACTION INTEL BUILDER — STABLE + TIME-CORRECT
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// MAIN BUILDER
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  console.log("🔵 HA BUILDER START");

  if (!raw || !raw.hourly) {
    console.error("❌ No hourly data:", raw);
    return { today: null, tomorrow: null };
  }

  const hourly = normalizeOpenMeteo(raw.hourly);

  if (!hourly.length) {
    console.error("❌ Normalized hourly empty");
    return { today: null, tomorrow: null };
  }

  // ------------------------------------------------------------
  // CURRENT TIME INDEX (CORRECTED)
  // ------------------------------------------------------------
  const now = Date.now();

  let idx = hourly.findIndex(h => h.timestamp > now) - 1;

  if (idx < 0) idx = 0;
  if (idx >= hourly.length) idx = hourly.length - 1;

  console.log(`🔵 Current hour index: ${idx}`);

  const next6Hours = hourly.slice(idx, idx + 6);

  console.log(
    "🕒 Selected hours:",
    next6Hours.map(h =>
      new Date(h.timestamp).toLocaleTimeString([], { hour: "numeric" })
    )
  );

  // ------------------------------------------------------------
  // TODAY SNAPSHOT
  // ------------------------------------------------------------
  const todayCore = hourly.slice(idx, idx + 4);
  const todayExtended = hourly.slice(idx, idx + 8);

  const todaySnapshot = blendHoursWithForwardBias(todayCore, todayExtended);

  if (todaySnapshot) {
    todaySnapshot.dayLabel = "today";
    todaySnapshot.isTomorrow = false;
  }

  const todayIntelRaw = evaluateHumanActionFactors(todaySnapshot) || {};

  const todayIntel = {
    ...ensureSynthFields(todayIntelRaw, todaySnapshot),
    ...todaySnapshot
  };

  // ------------------------------------------------------------
  // TOMORROW SNAPSHOT
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

  const tomorrowIntel = {
    ...ensureSynthFields(tomorrowIntelRaw, tomorrowSnapshot),
    ...tomorrowSnapshot,
    stats: tomorrowBundle.stats
  };

  console.log("🔵 HA BUILDER END");

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel,
    next6Hours // ← available for UI if needed
  };
}

// ------------------------------------------------------------
// SYNTH SAFETY
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
        ? avg("snowfall") > 0 ? "snow" : "rain"
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
// FORWARD-BIAS BLEND
// ------------------------------------------------------------
function blendHoursWithForwardBias(coreHours, extendedHours) {
  if (!coreHours?.length) return blendHours(extendedHours);

  const core = blendHours(coreHours);
  const ext = extendedHours?.length ? blendHours(extendedHours) : null;

  const mix = (a, b) =>
    a != null && b != null ? 0.7 * a + 0.3 * b : a ?? b ?? null;

  return {
    temp: mix(core.temp, ext?.temp),
    feelsLike: mix(core.feelsLike, ext?.feelsLike),
    dewPoint: mix(core.dewPoint, ext?.dewPoint),
    humidity: mix(core.humidity, ext?.humidity),
    windSpeed: mix(core.windSpeed, ext?.windSpeed),
    windGust: mix(core.windGust, ext?.windGust),
    precipType: core.precipType,
    precipIntensity: mix(core.precipIntensity, ext?.precipIntensity),
    uvIndex: mix(core.uvIndex, ext?.uvIndex),
    visibility: mix(core.visibility, ext?.visibility),
    cloudCover: mix(core.cloudCover, ext?.cloudCover),
    smokeIndex: mix(core.smokeIndex, ext?.smokeIndex),
    frostRisk: mix(core.frostRisk, ext?.frostRisk),
    freezeRisk: mix(core.freezeRisk, ext?.freezeRisk),
    inversionRisk: mix(core.inversionRisk, ext?.inversionRisk),
    blackIceRisk: mix(core.blackIceRisk, ext?.blackIceRisk),
    valleyFogRisk: mix(core.valleyFogRisk, ext?.valleyFogRisk),
    ridgeFogRisk: mix(core.ridgeFogRisk, ext?.ridgeFogRisk),
    timestamp: core.timestamp
  };
}

// ------------------------------------------------------------
// TOMORROW SNAPSHOTS
// ------------------------------------------------------------
function buildTomorrowSnapshots(hourly) {
  const tomorrowHours = hourly.slice(24, 48);

  if (!tomorrowHours.length) {
    return { morning: null, afternoon: null, stats: {} };
  }

  const morning = normalizeSnapshot(averageWindow(tomorrowHours.slice(0, 6)));
  const afternoon = normalizeSnapshot(averageWindow(tomorrowHours.slice(6, 12)));
  const stats = computeTomorrowStats(tomorrowHours);

  return { morning, afternoon, stats };
}

// ------------------------------------------------------------
// AVERAGE WINDOW
// ------------------------------------------------------------
function averageWindow(hours) {
  if (!hours?.length) return null;

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
    temp: h.temperatureF,
    feelsLike: h.apparentF ?? h.temperatureF,
    dewPoint: h.dewpointF,
    humidity: h.relative_humidity,
    windSpeed: h.wind_speed,
    windGust: h.wind_gust,
    precipType:
      h.precipitation > 0
        ? h.snowfall > 0 ? "snow" : "rain"
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
  if (!hours?.length) return {};

  const temps = hours.map(h => h.temperatureF ?? 0);
  const gusts = hours.map(h => h.wind_gust ?? 0);
  const winds = hours.map(h => h.wind_speed ?? 0);

  return {
    tempMin: Math.min(...temps),
    tempMax: Math.max(...temps),
    tempSwing: Math.max(...temps) - Math.min(...temps),
    windGustMax: Math.max(...gusts),
    windAvg: winds.reduce((a, b) => a + b, 0) / winds.length,
    dewpointAvg: hours.reduce((a, h) => a + (h.dewpointF ?? 0), 0) / hours.length,
    cloudAvg: hours.reduce((a, h) => a + (h.cloud_cover ?? 0), 0) / hours.length,
    rainTotal: hours.reduce((a, h) => a + (h.precipitation ?? 0), 0),
    snowTotal: hours.reduce((a, h) => a + (h.snowfall ?? 0), 0),
    coldStart: Math.min(...temps) <= 40,
    windImpact: Math.max(...gusts) >= 30
  };
}