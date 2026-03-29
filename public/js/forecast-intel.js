// /intel/forecast-intel.js

import { computeComfort } from "./comfort.js";
import { synthesizeOutlook, differentiateFromToday, synthesizeRemainderTodayOutlook } from "./synthesizer.js";
import { computeStats } from "./stats.js";
import { computeEvents } from "./events.js";
import { getTodayWindow, getTomorrowWindow } from "./windows.js";

export function buildWeatherIntel(hourly) {
  // -----------------------------
  // Current hour snapshot
  // -----------------------------
  const nowIndex = 0; // first hour = "now"
  const hourlyNow = {
    temperature_2m: hourly.temperature_2m[nowIndex],
    dewpoint_2m: hourly.dewpoint_2m[nowIndex],
    wind_speed_10m: hourly.wind_speed_10m[nowIndex],
    wind_gusts_10m: hourly.wind_gusts_10m[nowIndex]
  };

  // -----------------------------
  // Build Today + Tomorrow windows
  // -----------------------------
const todayHours = getTodayWindow(hourly);
const tomorrowHours = getTomorrowWindow(hourly);

// 🔍 Deep debugging
console.log("RAW HOURLY (first 48):", hourly.time.slice(0, 48));
console.log("TODAY HOURS:", todayHours);
console.log("TOMORROW HOURS:", tomorrowHours);

  // -----------------------------
  // Stats + Events
  // -----------------------------
  const statsToday = computeStats(hourly, todayHours);
  const statsTomorrow = computeStats(hourly, tomorrowHours);

  const eventsToday = computeEvents(hourly, todayHours, statsToday);
  const eventsTomorrow = computeEvents(hourly, tomorrowHours, statsTomorrow);

  console.log("STATS TODAY:", statsToday);
console.log("STATS TOMORROW:", statsTomorrow);

  // -----------------------------
  // Synthesized Outlooks
  // -----------------------------
  const todayOutlook = synthesizeOutlook(statsToday, eventsToday, todayHours);
  let tomorrowOutlook = synthesizeOutlook(statsTomorrow, eventsTomorrow, tomorrowHours);

  // Anti‑redundancy: ensure Tomorrow doesn't echo Today
  tomorrowOutlook = differentiateFromToday(todayOutlook, tomorrowOutlook);

  // -----------------------------
  // Future Comfort Window (next ~6 hours)
  // -----------------------------
  const futureComfortWindow = getFutureComfortWindow(hourly);

  // -----------------------------
  // Remainder-of-today intel (after 3 PM)
  // -----------------------------
  const remainderInfo = buildRemainderSubwindows(hourly, todayHours);
  let remainderTodayIntel = null;

  if (remainderInfo) {
    const { earlier, remainder } = remainderInfo;
    const statsEarlier = computeStats(hourly, earlier);
    const statsRemainder = computeStats(hourly, remainder);

    const outlook = synthesizeRemainderTodayOutlook(statsEarlier, statsRemainder);

    remainderTodayIntel = {
      available: true,
      ...outlook,
      statsEarlier,
      statsRemainder
    };
  }

  // -----------------------------
  // Return unified intel object
  // (WU + MRMS attached later in app.js)
  // -----------------------------
  const intel = {
    today: {
      available: todayHours.length > 0,
      ...todayOutlook,
      stats: statsToday,
      events: eventsToday
    },
    tomorrow: {
      available: tomorrowHours.length > 0,
      ...tomorrowOutlook,
      stats: statsTomorrow,
      events: eventsTomorrow
    },
    remainderToday: remainderTodayIntel,

    // ⭐ NEW: Future Comfort Window
    futureComfortWindow,

    comfort: null, // filled in app.js
    wu: null,
    mrms: null
  };

  return intel;
}

// -----------------------------
// Helper: split today into earlier vs remainder (after 3 PM)
// -----------------------------
function buildRemainderSubwindows(hourly, todayHours) {
  if (!hourly || !hourly.time || !todayHours || todayHours.length === 0) return null;

  const now = new Date();
  const nowMs = now.getTime();
  const currentHour = now.getHours();

  // Only activate after 3 PM local
  if (currentHour < 15) return null;

  const earlier = [];
  const remainder = [];

  for (const idx of todayHours) {
    const t = new Date(hourly.time[idx]);
    const tMs = t.getTime();
    const h = t.getHours();

    if (tMs < nowMs) {
      earlier.push(idx);
    } else if (h >= 15) {
      remainder.push(idx);
    }
  }

  if (earlier.length === 0 || remainder.length === 0) return null;
  return { earlier, remainder };
}

// -----------------------------
// Helper: next 6 hours window for Future Comfort
// -----------------------------
function getFutureComfortWindow(hourly) {
  if (!hourly || !hourly.time || hourly.time.length === 0) return [];

  const startIndex = 0; // current hour
  const maxCount = 6;
  const lastIndex = Math.min(hourly.time.length, startIndex + maxCount);

  const indices = [];
  for (let i = startIndex; i < lastIndex; i++) {
    indices.push(i);
  }

  return indices;
}