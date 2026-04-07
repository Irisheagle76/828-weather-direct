// ============================================================
// HUMAN-ACTION INTEL BUILDER — v4 (HARDENED + CLEAN)
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// MAIN BUILDER
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  console.log("🔵 HA BUILDER START");

  if (!raw?.hourly) {
    console.error("❌ No hourly data:", raw);
    return buildEmptyIntel();
  }

  const hourly = normalizeOpenMeteo(raw.hourly);

  if (!hourly.length) {
    console.error("❌ Normalized hourly empty");
    return buildEmptyIntel();
  }

  const currentHour = new Date().getHours();
  const isTonightMode = currentHour >= 15;

  // ------------------------------------------------------------
  // TIME SLICES
  // ------------------------------------------------------------
  const next6Hours = sliceByHoursAhead(hourly, 0, 6);
  const next24 = sliceByHoursAhead(hourly, 0, 24);
  const next48 = sliceByHoursAhead(hourly, 24, 48);

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

  const todaySnapshot = blendHoursSafe(todayHours);
  const todayEval = todayHours.map(evaluateHumanActionFactors);
  const todayCore = aggregateHumanAction(todayEval);

  const todayIntel = buildIntelPackage({
    core: todayCore,
    snapshot: todaySnapshot,
    hours: todayHours,
    label: isTonightMode ? "tonight" : "today",
    isTomorrow: false
  });

  // ------------------------------------------------------------
  // TOMORROW
  // ------------------------------------------------------------
  const tomorrowHours = next48;
  const tomorrowSnapshot = blendHoursSafe(tomorrowHours);
  const tomorrowEval = tomorrowHours.map(evaluateHumanActionFactors);
  const tomorrowCore = aggregateHumanAction(tomorrowEval);

  const tomorrowIntel = buildIntelPackage({
    core: tomorrowCore,
    snapshot: tomorrowSnapshot,
    hours: tomorrowHours,
    label: "tomorrow",
    isTomorrow: true
  });

  console.log("🔵 HA BUILDER END");

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel,
    next6Hours
  };
}

// ------------------------------------------------------------
// SAFE BLEND (CRITICAL FIX)
// ------------------------------------------------------------
function blendHoursSafe(hours) {
  if (!hours?.length) return null;

  const safeVals = (key) =>
    hours
      .map(h => h[key])
      .filter(v => typeof v === "number" && v > -100 && v < 200); // 🚨 strict bounds

  const avg = key => {
    const vals = safeVals(key);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const max = key => {
    const vals = safeVals(key);
    return vals.length ? Math.max(...vals) : null;
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
// INTEL PACKAGING
// ------------------------------------------------------------
function buildIntelPackage({ core, snapshot, hours, label, isTomorrow }) {
  const safe = snapshot ?? {};

  return {
    dominantFactor: core?.dominantFactor ?? "default",
    confidence: core?.confidence ?? 0.3,
    secondaryFactors: core?.secondaryFactors ?? [],

    dayLabel: label,
    isTomorrow,

    ...safe,

    signals: {
      temp: safe.temp ?? 70,
      feelsLike: safe.feelsLike ?? 70,
      dewPoint: safe.dewPoint ?? 55,
      humidity: safe.humidity ?? 50,
      windSpeed: safe.windSpeed ?? 5,
      windGust: safe.windGust ?? 8,
      cloudCover: safe.cloudCover ?? 50,
      visibility: safe.visibility ?? 10,
      precipIntensity: safe.precipIntensity ?? 0
    },

    hourlyEvaluations: hours.map(evaluateHumanActionFactors)
  };
}

// ------------------------------------------------------------
// TIME SLICING (CLEAN)
// ------------------------------------------------------------
function sliceByHoursAhead(hourly, startHr, endHr) {
  if (!hourly?.length) return [];

  const base = normalizeTs(hourly[0].timestamp);

  return hourly.filter(h => {
    const ts = normalizeTs(h.timestamp);
    const diff = (ts - base) / 36e5;
    return diff >= startHr && diff < endHr;
  });
}

function normalizeTs(ts) {
  if (typeof ts === "string") ts = new Date(ts).getTime();
  if (ts < 1e12) ts *= 1000;
  return ts;
}

// ------------------------------------------------------------
// AGGREGATION (UNCHANGED CORE LOGIC)
// ------------------------------------------------------------
function aggregateHumanAction(evals) {
  if (!evals?.length) {
    return {
      dominantFactor: "default",
      confidence: 0.3,
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
    dominantFactor: ranked[0]?.factor ?? "default",
    confidence: evals.reduce((a, e) => a + e.confidence, 0) / evals.length,
    secondaryFactors: ranked.slice(1, 3).map(r => r.factor)
  };
}

// ------------------------------------------------------------
// EMPTY FALLBACK
// ------------------------------------------------------------
function buildEmptyIntel() {
  return {
    today: baseFallback(),
    tomorrow: baseFallback(),
    next6Hours: []
  };
}

function baseFallback() {
  return {
    dominantFactor: "default",
    confidence: 0.3,
    secondaryFactors: [],
    signals: {
      temp: 70,
      dewPoint: 55,
      windSpeed: 5,
      windGust: 8,
      cloudCover: 50,
      visibility: 10,
      precipIntensity: 0
    }
  };
}