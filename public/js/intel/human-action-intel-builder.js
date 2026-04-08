// ============================================================
// HUMAN-ACTION INTEL BUILDER — v7 (UNIFIED VOICE)
// - Single language system (buildHumanVoice)
// - Clean time slicing (today / tonight / tomorrow)
// - Safe + predictable output
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { buildHumanVoice } from "../intel/human-voice.js";

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  const hourlyRaw = raw?.hourly;
  const hourly = normalizeOpenMeteo(hourlyRaw);

  if (!hourly.length) {
    return {
      today: fallback("today"),
      tomorrow: fallback("tomorrow"),
      next6Hours: []
    };
  }

  const now = Date.now();
  const currentHour = new Date().getHours();

  // ------------------------------------------------------------
  // TIME SLICING
  // ------------------------------------------------------------
  const next6 = slice(hourly, now, 0, 6);
  const next24 = slice(hourly, now, 0, 24);
  const next48 = slice(hourly, now, 24, 48);

  // 3PM switch → tonight mode
  const isTonight = currentHour >= 15;

  const todayHours = isTonight
    ? hourly.filter(h => {
        const hr = new Date(h.timestamp).getHours();
        return hr >= 18 || hr <= 6;
      })
    : next24;

  const tomorrowHours = next48;

  // ------------------------------------------------------------
  // BUILD PERIODS
  // ------------------------------------------------------------
  const today = buildPeriod({
    hours: todayHours,
    label: isTonight ? "tonight" : "today"
  });

  const tomorrow = buildPeriod({
    hours: tomorrowHours,
    label: "tomorrow"
  });

  return {
    today,
    tomorrow,

    // NOTE: still raw for now — we’ll decide UX later
    next6Hours: next6
  };
}

// ------------------------------------------------------------
// PERIOD BUILDER (CORE)
// ------------------------------------------------------------
function buildPeriod({ hours, label }) {
  if (!hours?.length) return fallback(label);

  const snapshot = blend(hours);
  const evals = hours.map(evaluateHumanActionFactors);
  const core = aggregate(evals);

  const signals = buildSignals(snapshot);

  // ✅ SINGLE VOICE SYSTEM
  const voice = buildHumanVoice(signals, core.dominantFactor);

  return {
    label,

    dominantFactor: core.dominantFactor,
    confidence: core.confidence,
    secondaryFactors: core.secondaryFactors,

    signals,

    // 👇 clean narrative layer
    summary: voice.summary,
    detail: voice.detail,
    feelsLike: voice.feelsLike,

    // 👇 keep raw data available
    snapshot,
    hourlyEvaluations: evals
  };
}

// ------------------------------------------------------------
// BLEND HOURS
// ------------------------------------------------------------
function blend(hours) {
  const avg = key => {
    const vals = hours
      .map(h => h[key])
      .filter(v => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const max = key => {
    const vals = hours
      .map(h => h[key])
      .filter(v => typeof v === "number");
    return vals.length ? Math.max(...vals) : null;
  };

  return {
    temp: avg("temperatureF"),
    dewPoint: avg("dewpointF"),
    humidity: avg("relative_humidity"),
    windSpeed: avg("wind_speed"),
    windGust: max("wind_gust"),
    precip: avg("precipitation"),
    cloudCover: avg("cloud_cover")
  };
}

// ------------------------------------------------------------
// SIGNALS (UI SAFE)
// ------------------------------------------------------------
function buildSignals(s) {
  return {
    temp: s.temp ?? 70,
    dewPoint: s.dewPoint ?? 55,
    humidity: s.humidity ?? 50,
    windSpeed: s.windSpeed ?? 5,
    cloudCover: s.cloudCover ?? 50
  };
}

// ------------------------------------------------------------
// SLICE HOURS
// ------------------------------------------------------------
function slice(hours, now, start, end) {
  return hours.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= start && diff < end;
  });
}

// ------------------------------------------------------------
// AGGREGATE FACTORS
// ------------------------------------------------------------
function aggregate(evals) {
  if (!evals.length) {
    return { dominantFactor: "stable", confidence: 0.2, secondaryFactors: [] };
  }

  const map = {};

  for (const e of evals) {
    const f = e.dominantFactor;
    if (!map[f]) map[f] = { count: 0, total: 0 };

    map[f].count++;
    map[f].total += e.confidence;
  }

  const ranked = Object.entries(map)
    .map(([factor, v]) => ({
      factor,
      score: v.total * (1 + v.count * 0.5)
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
// FALLBACK
// ------------------------------------------------------------
function fallback(label) {
  return {
    label,
    dominantFactor: "stable",
    confidence: 0.2,
    secondaryFactors: [],
    summary: "Conditions are fairly steady",
    detail: "",
    feelsLike: "Neutral",
    signals: {}
  };
}