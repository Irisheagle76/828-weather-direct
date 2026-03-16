// /intel/forecast-intel.js
// ============================================================
// FORECAST INTELLIGENCE ENGINE
// ============================================================

import { getTodayHumanActionOutlook, getTomorrowHumanActionOutlook }
  from "./human-action-outlook.js";

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function buildWeatherIntel(hourly) {
  const intel = {};

  // ------------------------------------------------------------
  // TODAY + TOMORROW STATS
  // ------------------------------------------------------------
  intel.today = computeDayStats(hourly, 0);
  intel.tomorrow = computeDayStats(hourly, 1);

  // ------------------------------------------------------------
  // HUMAN‑ACTION OUTLOOKS (NEW)
  // ------------------------------------------------------------
  intel.today.actionOutlook = getTodayHumanActionOutlook(intel);
  intel.tomorrow.actionOutlook = getTomorrowHumanActionOutlook(intel);

  return intel;
}

// ------------------------------------------------------------
// DAY STATS
// ------------------------------------------------------------
function computeDayStats(hours, dayOffset) {
  const start = dayOffset * 24;
  const slice = hours.slice(start, start + 24);

  if (!slice.length) return {};

  const temps = slice.map(h => h.temp);
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);

  return {
    stats: {
      maxTemp,
      minTemp,
      uv: slice[12]?.uv ?? null
    },
    precipType: detectPrecipType(slice),
    windSpeed: slice[12]?.windSpeed ?? null,
    tempTrend: temps[temps.length - 1] - temps[0]
  };
}

// ------------------------------------------------------------
// PRECIP TYPE DETECTION
// ------------------------------------------------------------
function detectPrecipType(hours) {
  for (const h of hours) {
    if (h.snow > 0) return "snow";
    if (h.rain > 0) return "rain";
  }
  return null;
}
