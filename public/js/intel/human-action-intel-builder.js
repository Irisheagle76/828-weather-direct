// ============================================================
// HUMAN ACTION + COMFORT BUILDER (v4 - FIXED TIME + CLEAN)
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
  const hourly = Array.isArray(raw?.hourly)
    ? raw.hourly
    : normalizeOpenMeteo(raw?.hourly);

  const clean = normalizeHourly(hourly);

  if (!clean.length) {
    return fallbackBundle();
  }

  const now = Date.now();

  const todayHours = clean.filter(h => inWindow(h.timestamp, now, 0, 24));
  const tomorrowHours = clean.filter(h => inWindow(h.timestamp, now, 24, 48));

  return {
    today: buildPeriod(todayHours, "today", now),
    tomorrow: buildPeriod(tomorrowHours, "tomorrow", now)
  };
}

// ------------------------------------------------------------
// 🔥 CRITICAL FIX: TIMESTAMP NORMALIZATION
// ------------------------------------------------------------
function normalizeHourly(hourly) {
  return hourly
    .map(h => {
      const rawTs = h.timestamp ?? h.ts ?? h.time;
      const ts = parseTimestamp(rawTs);

      if (!ts) return null;

      const d = new Date(ts);

      return {
        timestamp: ts,
        hour: d.getHours(),

        temperatureF: pick(h, ["temperatureF", "temp"]),
        dewpointF: pick(h, ["dewpointF", "dew"]),
        windSpeed: pick(h, ["windSpeed", "wind_speed"]),
        humidity: pick(h, ["humidity", "relative_humidity"]),
        cloudCover: pick(h, ["cloudCover", "cloud_cover"])
      };
    })
    .filter(Boolean);
}

function parseTimestamp(input) {
  if (!input) return null;

  if (typeof input === "number") return input;

  const ts = new Date(input).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (typeof obj[k] === "number") return obj[k];
  }
  return null;
}

function inWindow(ts, now, startHrs, endHrs) {
  const diff = (ts - now) / 36e5;
  return diff >= startHrs && diff < endHrs;
}

// ------------------------------------------------------------
// PERIOD BUILDER
// ------------------------------------------------------------
function buildPeriod(hours, label, now) {
  if (!hours.length) return fallback(label);

// ============================================================
// 🔍 DEBUG: FULL TOMORROW SNAPSHOT
// ============================================================
if (label === "tomorrow") {
  const get = (arr, key) =>
    arr.map(h => h[key]).filter(v => typeof v === "number");

  const stats = arr => ({
    min: arr.length ? Math.min(...arr) : null,
    max: arr.length ? Math.max(...arr) : null,
    avg: arr.length
      ? arr.reduce((a, b) => a + b, 0) / arr.length
      : null
  });

  const temps = get(hours, "temperatureF");
  const dew = get(hours, "dewpointF");
  const wind = get(hours, "windSpeed");
  const humidity = get(hours, "humidity");
  const clouds = get(hours, "cloudCover");

  console.log("🌤️ TOMORROW FULL DEBUG", {
    count: hours.length,

    temperature: stats(temps),
    dewpoint: stats(dew),
    wind: stats(wind),
    humidity: stats(humidity),
    cloudCover: stats(clouds),

    // 🔥 Raw sample (first 5 hours)
    sample: hours.slice(0, 5),

    // 🔥 Hour distribution (catch slicing bugs)
    hoursLocal: hours.map(h => h.hour)
  });
}
// ============================================================
// 🔍 END DEBUG: FULL TOMORROW SNAPSHOT
// ============================================================
  const hourlyComfort = hours.map(h => {
    const c = calculateComfort({
      temp: h.temperatureF,
      dewpointF: h.dewpointF,
      windSpeed: h.windSpeed,
      obsTimeLocal: h.timestamp
    });

    return {
      ts: h.timestamp,
      hour: h.hour,
      score: Math.round((c?.score ?? 5) * 10),
      temp: h.temperatureF,
      dew: h.dewpointF,
      wind: h.windSpeed
    };
  });

  const dayparts = buildDayparts(hourlyComfort);
  const { best, worst } = findWindows(hourlyComfort);
  const nowBlock = label === "today" ? findNow(hourlyComfort, now) : null;

  const temps = hours.map(h => h.temperatureF).filter(isNum);
  const tempMax = temps.length ? Math.max(...temps) : null;
  const tempMin = temps.length ? Math.min(...temps) : null;

  const avgAll = avg(hourlyComfort.map(h => h.score));

  let score =
    label === "today"
      ? (nowBlock?.score ?? avgAll) * 0.4 + avgAll * 0.4 + (best?.score ?? avgAll) * 0.2
      : avgAll * 0.5 + (best?.score ?? avgAll) * 0.3 - (100 - (worst?.score ?? avgAll)) * 0.2;

  score = Math.round(score);

  const evals = hours.map(evaluateHumanActionFactors);
  if (label === "tomorrow") {
  console.log("🧪 FACTOR BREAKDOWN", evals.map(e => ({
    factor: e.dominantFactor,
    confidence: e.confidence
  })));
}

  const core = aggregate(evals);

  const snapshot = blend(hours);
  const signals = buildSignals(snapshot);
  const voice = buildHumanVoice(signals, core.dominantFactor);

  return {
    label,
    score,
    now: nowBlock,
    dayparts,
    bestWindow: best,
    worstWindow: worst,
    stats: { tempMax, tempMin },

    emoji: pickEmoji(score),
    headline: buildHeadline(score),
    narrative: voice.summary || "",
    bullets: buildBullets({ best, worst, dayparts }),

    dominantFactor: core.dominantFactor,
    confidence: core.confidence,
    secondaryFactors: core.secondaryFactors,

    summary: voice.summary,
    detail: voice.detail,
    feelsLike: voice.feelsLike,

    snapshot,
    hourlyEvaluations: evals
  };
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const isNum = v => typeof v === "number";

const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

function buildDayparts(hours) {
  const out = {};

  for (const part of DAYPARTS) {
    const seg = hours.filter(h => h.hour >= part.start && h.hour < part.end);
    if (!seg.length) continue;

    out[part.key] = {
      avg: Math.round(avg(seg.map(h => h.score))),
      min: Math.min(...seg.map(h => h.score)),
      max: Math.max(...seg.map(h => h.score))
    };
  }

  return out;
}

function findWindows(hours) {
  let best = null;
  let worst = null;

  for (let i = 0; i < hours.length - 2; i++) {
    const slice = hours.slice(i, i + 3);
    const score = avg(slice.map(h => h.score));

    if (!best || score > best.score) {
      best = { score: Math.round(score), start: slice[0].hour, end: slice[2].hour };
    }

    if (!worst || score < worst.score) {
      worst = { score: Math.round(score), start: slice[0].hour, end: slice[2].hour };
    }
  }

  return { best, worst };
}

function findNow(hours, now) {
  const current = hours.find(h => h.ts >= now);
  return current
    ? { score: current.score, temp: current.temp, dew: current.dew }
    : null;
}

function blend(hours) {
  const avgKey = key => {
    const vals = hours.map(h => h[key]).filter(isNum);
    return vals.length ? avg(vals) : null;
  };

  return {
    temp: avgKey("temperatureF"),
    dewPoint: avgKey("dewpointF"),
    humidity: avgKey("humidity"),
    windSpeed: avgKey("windSpeed"),
    cloudCover: avgKey("cloudCover")
  };
}

function buildSignals(s) {
  return {
    temp: s.temp ?? 70,
    dewPoint: s.dewPoint ?? 55,
    humidity: s.humidity ?? 50,
    wind: s.windSpeed ?? 5,
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
    confidence: avg(evals.map(e => e.confidence)),
    secondaryFactors: ranked.slice(1, 3).map(r => r.factor)
  };
}

// ------------------------------------------------------------
// FALLBACK + UI
// ------------------------------------------------------------
function fallbackBundle() {
  return {
    today: fallback("today"),
    tomorrow: fallback("tomorrow")
  };
}

function fallback(label) {
  const voice = buildHumanVoice({}, "stable");

  return {
    label,
    score: 50,
    headline: "Conditions are steady",
    narrative: voice.summary,
    bullets: [],
    dayparts: {},
    bestWindow: null,
    worstWindow: null,
    stats: { tempMax: null, tempMin: null }
  };
}

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
  const out = [];

  if (best) out.push(`Best: ${fmt(best.start)}–${fmt(best.end)}`);
  if (worst) out.push(`Tough: ${fmt(worst.start)}–${fmt(worst.end)}`);
  if (dayparts?.lunch) out.push(`Lunch: ${dayparts.lunch.avg}`);

  return out;
}

function fmt(h) {
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}${suffix}`;
}