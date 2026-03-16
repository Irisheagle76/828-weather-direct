// /intel/forecast-intel.js
// ============================================================
// FORECAST INTELLIGENCE ENGINE (HARDENED + SAFE)
// ============================================================

import {
  getTodayHumanActionOutlook,
  getTomorrowHumanActionOutlook
} from "./human-action-outlook.js";

// ------------------------------------------------------------
// MAIN ENTRY — expects an array of hourly objects
// ------------------------------------------------------------
export function buildWeatherIntel(hours) {
  const intel = {};

  // Safety: ensure hours is a valid array
  if (!Array.isArray(hours) || hours.length === 0) {
    console.warn("forecast-intel: hours array missing or empty");
    intel.today = {};
    intel.tomorrow = {};
    return intel;
  }

  // ------------------------------------------------------------
  // TODAY + TOMORROW STATS
  // ------------------------------------------------------------
  intel.today = computeDayStats(hours, 0);
  intel.tomorrow = computeDayStats(hours, 1);

  // ------------------------------------------------------------
  // HUMAN‑ACTION OUTLOOKS (NEW)
  // ------------------------------------------------------------
  intel.today.actionOutlook = getTodayHumanActionOutlook(intel);
  intel.tomorrow.actionOutlook = getTomorrowHumanActionOutlook(intel);

  return intel;
}

// ------------------------------------------------------------
// DAY STATS (safe + defensive)
// ------------------------------------------------------------
function computeDayStats(hours, dayOffset) {
  if (!Array.isArray(hours) || hours.length === 0) {
    return {
      stats: {},
      precipType: null,
      windSpeed: null,
      tempTrend: null
    };
  }

  const start = dayOffset * 24;
  const slice = hours.slice(start, start + 24);

  if (!slice || slice.length === 0) {
    return {
      stats: {},
      precipType: null,
      windSpeed: null,
      tempTrend: null
    };
  }

  // Extract temps safely
  const temps = slice.map(h => safeNum(h.temp));
  const maxTemp = maxOrNull(temps);
  const minTemp = minOrNull(temps);

  // UV: pick hour 12 if available, else fallback
  const uv =
    slice[12]?.uv ??
    slice[Math.floor(slice.length / 2)]?.uv ??
    null;

  // Wind: same fallback logic
  const windSpeed =
    slice[12]?.windSpeed ??
    slice[Math.floor(slice.length / 2)]?.windSpeed ??
    null;

  // Temperature trend: last - first
  const tempTrend =
    temps.length >= 2
      ? safeNum(temps[temps.length - 1]) - safeNum(temps[0])
      : null;

  return {
    stats: {
      maxTemp,
      minTemp,
      uv
    },
    precipType: detectPrecipType(slice),
    windSpeed,
    tempTrend
  };
}

// ------------------------------------------------------------
// PRECIP TYPE DETECTION (safe)
// ------------------------------------------------------------
function detectPrecipType(hours) {
  if (!Array.isArray(hours)) return null;

  for (const h of hours) {
    if (safeNum(h.snow) > 0) return "snow";
    if (safeNum(h.rain) > 0) return "rain";
  }
  return null;
}

// ------------------------------------------------------------
// SAFE HELPERS
// ------------------------------------------------------------
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function maxOrNull(arr) {
  const nums = arr.filter(n => Number.isFinite(n));
  return nums.length ? Math.max(...nums) : null;
}

function minOrNull(arr) {
  const nums = arr.filter(n => Number.isFinite(n));
  return nums.length ? Math.min(...nums) : null;
}
