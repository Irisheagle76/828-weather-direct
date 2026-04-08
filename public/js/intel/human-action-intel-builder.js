// ============================================================
// HUMAN ACTION + COMFORT BUILDER (CLEAN v2)
// - Today = now → +24h
// - Tomorrow = +24h → +48h
// - Hourly comfort → dayparts → windows → score
// - UI compatible (headline, bullets, emoji)
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { buildHumanVoice } from "../intel/human-voice.js";
import { calculateComfort } from "../intel/comfort.js";

// ------------------------------------------------------------
// DAYPARTS
// ------------------------------------------------------------
const DAYPARTS = [
  { key: "am_commute", start: 5, end: 9 },
  { key: "lunch", start: 11, end: 13 },
  { key: "pm_commute", start: 17, end: 19 },
  { key: "dinner", start: 17, end: 20 },
  { key: "late_night", start: 22, end: 24 }
];

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  const hourly = normalizeOpenMeteo(raw?.hourly);

  if (!hourly.length) {
    return {
      today: fallback("today"),
      tomorrow: fallback("tomorrow")
    };
  }

  const now = Date.now();

  const todayHours = hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= 0 && diff < 24;
  });

  const tomorrowHours = hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= 24 && diff < 48;
  });

  return {
    today: buildPeriod(todayHours, "today", now),
    tomorrow: buildPeriod(tomorrowHours, "tomorrow", now)
  };
}

// ------------------------------------------------------------
// PERIOD BUILDER
// ------------------------------------------------------------
function buildPeriod(hours, label, now) {
  if (!hours?.length) return fallback(label);

  // -------------------------
  // HOURLY COMFORT
  // -------------------------
  const hourlyComfort = hours.map(h => {
    const c = calculateComfort({
      temp: h.temperatureF,
      dewpointF: h.dewpointF,
      windSpeed: h.wind_speed,
      obsTimeLocal: h.timestamp
    });

    return {
      ts: h.timestamp,
      hour: new Date(h.timestamp).getHours(),
      score: Math.round((c?.score ?? 5) * 10),
      temp: h.temperatureF,
      dew: h.dewpointF,
      wind: h.wind_speed
    };
  });

  // -------------------------
  // DAYPARTS
  // -------------------------
  const dayparts = {};

  for (const part of DAYPARTS) {
    const segment = hourlyComfort.filter(h =>
      h.hour >= part.start && h.hour < part.end
    );

    if (!segment.length) continue;

    const avg = avgScore(segment);

    dayparts[part.key] = {
      avg: Math.round(avg),
      min: Math.min(...segment.map(h => h.score)),
      max: Math.max(...segment.map(h => h.score))
    };
  }

  // -------------------------
  // BEST / WORST WINDOWS
  // -------------------------
  let best = null;
  let worst = null;

  for (let i = 0; i < hourlyComfort.length - 2; i++) {
    const slice = hourlyComfort.slice(i, i + 3);
    const score = avgScore(slice);

    if (!best || score > best.score) {
      best = {
        score: Math.round(score),
        start: slice[0].hour,
        end: slice[2].hour
      };
    }

    if (!worst || score < worst.score) {
      worst = {
        score: Math.round(score),
        start: slice[0].hour,
        end: slice[2].hour
      };
    }
  }

  // -------------------------
  // NOW BLOCK
  // -------------------------
  let nowBlock = null;

  if (label === "today") {
    const current = hourlyComfort.find(h => h.ts >= now);

    if (current) {
      nowBlock = {
        score: current.score,
        temp: current.temp,
        dew: current.dew
      };
    }
  }

  // -------------------------
// TEMPERATURE RANGE (REAL FIX)
// -------------------------
const temps = hours
  .map(h => h.temperatureF)
  .filter(t => typeof t === "number");

const tempMax = temps.length ? Math.max(...temps) : null;
const tempMin = temps.length ? Math.min(...temps) : null;

  // -------------------------
  // SCORE
  // -------------------------
  const avgAll = avgScore(hourlyComfort);

  let score;

  if (label === "today") {
    score =
      (nowBlock?.score ?? avgAll) * 0.4 +
      avgAll * 0.4 +
      (best?.score ?? avgAll) * 0.2;
  } else {
    score =
      avgAll * 0.5 +
      (best?.score ?? avgAll) * 0.3 -
      (100 - (worst?.score ?? avgAll)) * 0.2;
  }

  score = Math.round(score);

  // -------------------------
  // EXISTING ENGINE
  // -------------------------
  const evals = hours.map(evaluateHumanActionFactors);
  const core = aggregate(evals);

  const snapshot = blend(hours);
  const signals = buildSignals(snapshot);
  const voice = buildHumanVoice(signals, core.dominantFactor);

  // -------------------------
  // RETURN (UI READY)
  // -------------------------
return {
  label,

  score,
  now: nowBlock,
  dayparts,
  bestWindow: best,
  worstWindow: worst,

  // 🔥 ADD THIS (REAL HIGH / LOW)
  stats: {
    tempMax,
    tempMin
  },

  // UI
  emoji: pickEmoji(score),
  headline: buildHeadline(score),
  narrative: voice.summary || "",
  bullets: buildBullets({ best, worst, dayparts }),

  // engine
  dominantFactor: core.dominantFactor,
  confidence: core.confidence,
  secondaryFactors: core.secondaryFactors,

  // voice
  summary: voice.summary,
  detail: voice.detail,
  feelsLike: voice.feelsLike,

  // raw
  snapshot,
  hourlyEvaluations: evals
};
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function avgScore(arr) {
  return arr.reduce((a, h) => a + h.score, 0) / arr.length;
}

function blend(hours) {
  const avg = key => {
    const vals = hours.map(h => h[key]).filter(v => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return {
    temp: avg("temperatureF"),
    dewPoint: avg("dewpointF"),
    humidity: avg("relative_humidity"),
    windSpeed: avg("wind_speed"),
    cloudCover: avg("cloud_cover")
  };
}

function buildSignals(s) {
  return {
    temp: s.temp ?? 70,
    dewPoint: s.dewPoint ?? 55,
    humidity: s.humidity ?? 50,
    windSpeed: s.windSpeed ?? 5,
    cloudCover: s.cloudCover ?? 50
  };
}

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

function fallback(label) {
  return {
    label,
    score: 50,
    headline: "Conditions are steady",
    narrative: "",
    bullets: [],
    dayparts: {},
    bestWindow: null,
    worstWindow: null
  };
}

// ---------------- UI HELPERS ----------------
function pickEmoji(score) {
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  if (score >= 50) return "😐";
  return "😕";
}

function buildHeadline(score) {
  if (score >= 80) return "Very comfortable overall";
  if (score >= 65) return "Comfortable for most of the day";
  if (score >= 50) return "Mixed comfort today";
  return "Challenging conditions";
}

function buildBullets({ best, worst, dayparts }) {
  const bullets = [];

  if (best) {
    bullets.push(`Best: ${formatHour(best.start)}–${formatHour(best.end)}`);
  }

  if (worst) {
    bullets.push(`Tough: ${formatHour(worst.start)}–${formatHour(worst.end)}`);
  }

  if (dayparts?.lunch) {
    bullets.push(`Lunch: ${dayparts.lunch.avg}`);
  }

  return bullets;
}

function formatHour(h) {
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}${suffix}`;
}