// /intel/forecast-intel.js
// ============================================================
// HUMAN-ACTION 2.0 — Sky-aware Today / Tonight / Tomorrow
// ============================================================

import { computeStats } from "./stats.js";
import { computeEvents } from "./events.js";
import { synthesizePeriod } from "./synthesizer.js";
import { computeConfidence } from "./confidence.js";

// ------------------------------------------------------------
// Helper: build a snapshot from hourly indices + sky intel
// ------------------------------------------------------------
function buildSnapshot(hourly, indices, sky) {
  if (!indices?.length) return null;

  const t = indices.map(i => hourly.temperature_2m?.[i]).filter(v => v != null);
  const dew = indices.map(i => hourly.dewpoint_2m?.[i]).filter(v => v != null);
  const hum = indices.map(i => hourly.relativehumidity_2m?.[i]).filter(v => v != null);
  const wind = indices.map(i => hourly.windspeed_10m?.[i]).filter(v => v != null);
  const gust = indices.map(i => hourly.windgusts_10m?.[i]).filter(v => v != null);
  const cloud = indices.map(i => hourly.cloudcover?.[i]).filter(v => v != null);
  const rain = indices.map(i => hourly.rain?.[i]).filter(v => v != null);
  const snow = indices.map(i => hourly.snowfall?.[i]).filter(v => v != null);
  const uv = indices.map(i => hourly.uv_index?.[i]).filter(v => v != null);

  const avg = arr => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return {
    // Core weather
    temp: avg(t),
    feelsLike: avg(t),
    dewpoint: avg(dew),
    humidity: avg(hum),
    windSpeed: avg(wind),
    windGust: gust.length ? Math.max(...gust) : null,
    precipIntensity: (avg(rain) || 0) + (avg(snow) || 0),
    precipType:
      snow.some(v => v > 0) && rain.some(v => v > 0)
        ? "mixed"
        : snow.some(v => v > 0)
        ? "snow"
        : rain.some(v => v > 0)
        ? "rain"
        : "none",

    // Sky-aware fields
    cloudCover: sky.cloud ?? (cloud.length ? avg(cloud) : null),
    cloudState: sky.cloudState,
    uv: sky.uv ?? (uv.length ? Math.max(...uv) : null),
    uvCategory: sky.uvCategory,
    solar: sky.solar,
    solarElevation: sky.solarElevation,
    visibility: sky.visibilityKm,
    visibilityCategory: sky.visibilityCategory,
    fogPotential: sky.fogPotential,
    smokeIndex: sky.smokeIndex
  };
}

// ------------------------------------------------------------
// Helper: slice hourly indices for your existing windows
// ------------------------------------------------------------
function sliceWindow(hourly, start, end) {
  if (!hourly?.time) return [];
  const now = Date.now();

  // Find first forecast hour >= now
  let startIndex = hourly.time.findIndex(t => new Date(t).getTime() >= now);
  if (startIndex === -1) return [];

  const indices = [];
  for (let i = startIndex + start; i < startIndex + end; i++) {
    if (i >= hourly.time.length) break;
    indices.push(i);
  }
  return indices;
}

// ------------------------------------------------------------
// Main entry point
// ------------------------------------------------------------
export function buildWeatherIntel(hourly, sky) {
  if (!hourly?.time) return null;

  // ----------------------------------------------------------
  // 1. Build windows (same as your existing system)
  // ----------------------------------------------------------
  const windows = {
    today: {
      morning: sliceWindow(hourly, 5, 11),
      afternoon: sliceWindow(hourly, 11, 18),
      fullDay: sliceWindow(hourly, 0, 24)
    },
    tonight: {
      evening: sliceWindow(hourly, 15, 20),
      lateEvening: sliceWindow(hourly, 20, 24),
      fullNight: sliceWindow(hourly, 15, 24)
    },
    tomorrow: {
      morning: sliceWindow(hourly, 24, 29),
      afternoon: sliceWindow(hourly, 29, 35),
      evening: sliceWindow(hourly, 35, 42),
      fullDay: sliceWindow(hourly, 24, 48)
    }
  };

  // ----------------------------------------------------------
  // 2. Build snapshots (sky-aware)
  // ----------------------------------------------------------
  const todayMorning = buildSnapshot(hourly, windows.today.morning, sky);
  const todayAfternoon = buildSnapshot(hourly, windows.today.afternoon, sky);

  const tonightEvening = buildSnapshot(hourly, windows.tonight.evening, sky);
  const tonightLate = buildSnapshot(hourly, windows.tonight.lateEvening, sky);

  const tomorrowMorning = buildSnapshot(hourly, windows.tomorrow.morning, sky);
  const tomorrowAfternoon = buildSnapshot(hourly, windows.tomorrow.afternoon, sky);
  const tomorrowEvening = buildSnapshot(hourly, windows.tomorrow.evening, sky);

  // ----------------------------------------------------------
  // 3. Stats (sky-aware)
  // ----------------------------------------------------------
  const todayStats = computeStats(hourly, windows.today.fullDay, sky);
  const tonightStats = computeStats(hourly, windows.tonight.fullNight, sky);
  const tomorrowStats = computeStats(hourly, windows.tomorrow.fullDay, sky);

  // ----------------------------------------------------------
  // 4. Events (sky-aware)
  // ----------------------------------------------------------
  const todayEvents = computeEvents(todayStats, sky);
  const tonightEvents = computeEvents(tonightStats, sky);
  const tomorrowEvents = computeEvents(tomorrowStats, sky);

  // ----------------------------------------------------------
  // 5. Synthesis (Human-Action narrative)
  // ----------------------------------------------------------
  const todaySynth = synthesizePeriod("today", {
    morning: todayMorning,
    afternoon: todayAfternoon,
    stats: todayStats,
    events: todayEvents,
    sky
  });

  const tonightSynth = synthesizePeriod("tonight", {
    evening: tonightEvening,
    lateEvening: tonightLate,
    stats: tonightStats,
    events: tonightEvents,
    sky
  });

  const tomorrowSynth = synthesizePeriod("tomorrow", {
    morning: tomorrowMorning,
    afternoon: tomorrowAfternoon,
    evening: tomorrowEvening,
    stats: tomorrowStats,
    events: tomorrowEvents,
    sky
  });

  // ----------------------------------------------------------
  // 6. Confidence scoring
  // ----------------------------------------------------------
  const todayConf = computeConfidence(todayStats, todayEvents);
  const tonightConf = computeConfidence(tonightStats, tonightEvents);
  const tomorrowConf = computeConfidence(tomorrowStats, tomorrowEvents);

  // ----------------------------------------------------------
  // 7. Final Human-Action intel object
  // ----------------------------------------------------------
  return {
    today: {
      ...todaySynth,
      snapshots: { morning: todayMorning, afternoon: todayAfternoon },
      stats: todayStats,
      events: todayEvents,
      confidence: todayConf
    },
    tonight: {
      ...tonightSynth,
      snapshots: { evening: tonightEvening, lateEvening: tonightLate },
      stats: tonightStats,
      events: tonightEvents,
      confidence: tonightConf
    },
    tomorrow: {
      ...tomorrowSynth,
      snapshots: {
        morning: tomorrowMorning,
        afternoon: tomorrowAfternoon,
        evening: tomorrowEvening
      },
      stats: tomorrowStats,
      events: tomorrowEvents,
      confidence: tomorrowConf
    }
  };
}