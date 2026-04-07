// ============================================================
// HUMAN-ACTION INTEL BUILDER — v5 (FULLY RESILIENT)
// - Never crashes
// - Handles empty / partial data
// - Clean aggregation + slicing
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  console.log("🔵 HA BUILDER START");

  const hourlyRaw = raw?.hourly;
  const hourly = normalizeOpenMeteo(hourlyRaw);

  // ------------------------------------------------------------
  // 🚨 NO DATA → DEGRADED MODE (NOT ERROR)
  // ------------------------------------------------------------
  if (!hourly.length) {
    console.warn("No hourly data — degraded mode");

    return {
      today: buildFallbackIntel("today"),
      tomorrow: buildFallbackIntel("tomorrow"),
      next6Hours: []
    };
  }

  // ------------------------------------------------------------
  // TIME CONTEXT
  // ------------------------------------------------------------
  const now = Date.now();
  const currentHour = new Date().getHours();
  const isTonightMode = currentHour >= 15;

  // ------------------------------------------------------------
  // TIME SLICES
  // ------------------------------------------------------------
  const next6 = sliceHours(hourly, now, 0, 6);
  const next24 = sliceHours(hourly, now, 0, 24);
  const next48 = sliceHours(hourly, now, 24, 48);

  // ------------------------------------------------------------
  // TODAY / TONIGHT
  // ------------------------------------------------------------
  let todayHours = isTonightMode
    ? hourly.filter(h => {
        const hr = new Date(h.timestamp).getHours();
        return hr >= 18 || hr <= 6;
      })
    : next24;

  if (!todayHours.length) todayHours = next24;

  const todayIntel = buildPeriodIntel({
    hours: todayHours,
    label: isTonightMode ? "tonight" : "today",
    isTomorrow: false
  });

  // ------------------------------------------------------------
  // TOMORROW
  // ------------------------------------------------------------
  const tomorrowIntel = buildPeriodIntel({
    hours: next48,
    label: "tomorrow",
    isTomorrow: true
  });

  console.log("🔵 HA BUILDER END");

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel,
    next6Hours: next6
  };
}

// ------------------------------------------------------------
// PERIOD INTEL (CORE PIPELINE)
// ------------------------------------------------------------
function buildPeriodIntel({ hours, label, isTomorrow }) {
  if (!hours?.length) {
    return buildFallbackIntel(label, isTomorrow);
  }

  const snapshot = blendHours(hours);
  const evals = hours.map(evaluateHumanActionFactors);
  const core = aggregate(evals);

  return {
    dominantFactor: core.dominantFactor,
    confidence: core.confidence,
    secondaryFactors: core.secondaryFactors,

    dayLabel: label,
    isTomorrow,

    ...snapshot,

    signals: buildSignals(snapshot),
    hourlyEvaluations: evals
  };
}

// ------------------------------------------------------------
// BLEND HOURS (SAFE AVG)
// ------------------------------------------------------------
function blendHours(hours) {
  const vals = key =>
    hours
      .map(h => h[key])
      .filter(v => typeof v === "number" && Number.isFinite(v));

  const avg = key => {
    const v = vals(key);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const max = key => {
    const v = vals(key);
    return v.length ? Math.max(...v) : null;
  };

  return {
    temp: avg("temperatureF"),
    feelsLike: avg("apparentF"),
    dewPoint: avg("dewpointF"),
    humidity: avg("relative_humidity"),

    windSpeed: avg("wind_speed"),
    windGust: max("wind_gust"),

    precipIntensity: avg("precipitation"),
    precipType:
      avg("precipitation") > 0
        ? avg("snowfall") > 0 ? "snow" : "rain"
        : "none",

    uvIndex: avg("uv_index"),
    visibility: avg("visibility"),
    cloudCover: avg("cloud_cover"),

    timestamp: hours[0]?.timestamp ?? null
  };
}

// ------------------------------------------------------------
// SIGNALS (UI SAFE DEFAULTS)
// ------------------------------------------------------------
function buildSignals(s) {
  return {
    temp: s.temp ?? 70,
    feelsLike: s.feelsLike ?? 70,
    dewPoint: s.dewPoint ?? 55,
    humidity: s.humidity ?? 50,
    windSpeed: s.windSpeed ?? 5,
    windGust: s.windGust ?? 8,
    cloudCover: s.cloudCover ?? 50,
    visibility: s.visibility ?? 10,
    precipIntensity: s.precipIntensity ?? 0
  };
}

// ------------------------------------------------------------
// TIME SLICING
// ------------------------------------------------------------
function sliceHours(hourly, now, startHr, endHr) {
  return hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= startHr && diff < endHr;
  });
}

// ------------------------------------------------------------
// AGGREGATION
// ------------------------------------------------------------
function aggregate(evals) {
  if (!evals?.length) {
    return {
      dominantFactor: "stable",
      confidence: 0.2,
      secondaryFactors: []
    };
  }

  const stats = {};

  for (const e of evals) {
    const f = e.dominantFactor;
    if (!stats[f]) stats[f] = { count: 0, total: 0 };

    stats[f].count++;
    stats[f].total += e.confidence;
  }

  const ranked = Object.entries(stats)
    .map(([factor, s]) => ({
      factor,
      score: s.total * (1 + s.count * 0.5)
    }))
    .sort((a, b) => b.score - a.score);

  return {
    dominantFactor: ranked[0]?.factor ?? "stable",
    confidence:
      evals.reduce((a, e) => a + e.confidence, 0) / evals.length,
    secondaryFactors: ranked.slice(1, 3).map(r => r.factor)
  };
}

// ------------------------------------------------------------
// FALLBACK INTEL (CRITICAL)
// ------------------------------------------------------------
function buildFallbackIntel(label, isTomorrow = false) {
  return {
    dominantFactor: "stable",
    confidence: 0.2,
    secondaryFactors: [],

    dayLabel: label,
    isTomorrow,

    signals: {
      temp: 70,
      feelsLike: 70,
      dewPoint: 55,
      humidity: 50,
      windSpeed: 5,
      windGust: 8,
      cloudCover: 50,
      visibility: 10,
      precipIntensity: 0
    },

    hourlyEvaluations: []
  };
}