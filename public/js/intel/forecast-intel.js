// ============================================================
// UNIFIED FORECAST INTEL WRAPPER
// This module ties together all other intel modules and produces
// the final Today + Tomorrow outlooks used by your UI.
// ============================================================

import { getTodayRemainingWindow, getTomorrowWindow, sliceHourly } from "./windows.js";
import { getUnifiedStats } from "./stats.js";
import { analyzeEvents } from "./events.js";
import { getComfortSummary, getClothingGuidance } from "./comfort.js";
import { synthesizeOutlook } from "./synthesizer.js";
import { buildTodayDetail, buildTomorrowDetail } from "./details.js";

// ------------------------------------------------------------
// Build intel for a single window (Today or Tomorrow)
// ------------------------------------------------------------
function buildWindowIntel(hourly, indices, date) {
  if (!indices || indices.length === 0) {
    return {
      available: false,
      headline: "No data available",
      narrative: "",
      bullets: [],
      microAdvice: [],
      comfort: null,
      clothing: []
    };
  }

  const window = sliceHourly(hourly, indices);
  const stats = getUnifiedStats(window);
  const events = analyzeEvents(window, stats, hourly, indices);
  const comfort = getComfortSummary(stats, date);
  const clothing = getClothingGuidance(
    comfort.tempFeel,
    comfort.windFeel,
    comfort.humidityFeel,
    stats
  );

  const outlook = synthesizeOutlook(events, comfort, stats, window, hourly, indices);

  return {
    available: true,
    ...outlook,
    comfort,
    clothing
  };
}

// ------------------------------------------------------------
// MAIN EXPORT — Build full weather intel
// ------------------------------------------------------------
export function buildWeatherIntel(hourly) {
  const now = new Date();

  // TODAY
  const todayIndices = getTodayRemainingWindow(hourly);
  const windowToday = sliceHourly(hourly, todayIndices);
  const statsToday = getUnifiedStats(windowToday);
  const eventsToday = analyzeEvents(windowToday, statsToday, hourly, todayIndices);
  const todayIntel = buildWindowIntel(hourly, todayIndices, now);

  // TOMORROW
  const tomorrowIndices = getTomorrowWindow(hourly);
  const windowTomorrow = sliceHourly(hourly, tomorrowIndices);
  const statsTomorrow = getUnifiedStats(windowTomorrow);
  const eventsTomorrow = analyzeEvents(windowTomorrow, statsTomorrow, hourly, tomorrowIndices);

  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrowIntel = buildWindowIntel(hourly, tomorrowIndices, tomorrowDate);

  return {
    generatedAt: now.toISOString(),
    today: todayIntel,
    tomorrow: tomorrowIntel,
    todayDetail: buildTodayDetail(statsToday, eventsToday, windowToday, hourly, todayIndices),
    tomorrowDetail: buildTomorrowDetail(statsTomorrow, eventsTomorrow, windowTomorrow, hourly, tomorrowIndices)
  };
}
