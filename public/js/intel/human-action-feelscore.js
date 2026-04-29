// ============================================================
// HUMAN ACTION — FEELSCORE (CLEAN ARCHITECTURE)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";
import { buildFullExplanation } from "../intel/explanations/buildFullExplanation.js";

// ============================================================
// HELPERS
// ============================================================

function avg(arr = []) {
  const valid = arr.filter(Number.isFinite);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function getTs(h) {
  const ts = h?.timestamp ?? h?.ts ?? null;
  if (!ts) return null;
  return ts < 1e12 ? ts * 1000 : ts;
}

// ============================================================
// ALIGN + SPLIT
// ============================================================

function alignHourly(hourlyRaw = []) {
  const now = Date.now();

  const sorted = hourlyRaw
    .map(h => ({ ...h, _ts: getTs(h) }))
    .filter(h => h._ts)
    .sort((a, b) => a._ts - b._ts);

  const startIndex = sorted.findIndex(h => h._ts >= now);
  return startIndex === -1 ? [] : sorted.slice(startIndex);
}

function splitDays(hourly, now) {
  const d = new Date(now);

  const startToday = new Date(d);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startNext = new Date(startTomorrow);
  startNext.setDate(startNext.getDate() + 1);

  const today = [];
  const tomorrow = [];

  for (const h of hourly) {
    if (h._ts >= startToday && h._ts < startTomorrow) today.push(h);
    else if (h._ts >= startTomorrow && h._ts < startNext) tomorrow.push(h);
  }

  return { today, tomorrow };
}

// ============================================================
// PRECIP + SNAPSHOT (UNCHANGED)
// ============================================================

function getPrecipSignal({ precipProbability = 0, precipAmount = 0 }) {
  if (precipProbability >= 70) return "high";
  if (precipProbability >= 40) return "moderate";
  if (precipProbability >= 20) return "low";
  if (precipAmount >= 0.10) return "high";
  if (precipAmount >= 0.03) return "moderate";
  return "none";
}

function getPrecipType({ precipProbability = 0, precipAmount = 0, hours = [] }) {
  const maxRate = Math.max(...hours.map(h => h.precipAmount ?? 0), 0);
  const activeHours = hours.filter(h => (h.precipAmount ?? 0) > 0).length;

  if (maxRate >= 0.10) return "steady_rain";
  if (maxRate >= 0.03) return "light_rain";

  if (precipProbability >= 70 && activeHours >= 6) return "periods_of_rain";
  if (precipProbability >= 50) return "scattered_showers";
  if (precipProbability >= 20) return "isolated_showers";

  return "none";
}

function buildSnapshot(hours = []) {
  if (!hours.length) return null;

  const first = hours[0];

  const maxProb = Math.max(...hours.map(h => h.precipProbability ?? 0), 0);
  const maxAmt  = Math.max(...hours.map(h => h.precipAmount ?? 0), 0);
  const avgAmt  = avg(hours.map(h => h.precipAmount ?? 0)) ?? 0;

  const snapshot = {
    temp: first.temperatureF,
    dewPoint: first.dewpointF,
    wind: first.windSpeed,
    gust: first.windGust,
    precipProbability: maxProb,
    precipAmount: maxAmt,
    precipAmountAvg: avgAmt,
    isRainingNow: (first.precipAmount ?? 0) > 0
  };

  snapshot.precipType = getPrecipType({
    precipProbability: snapshot.precipProbability,
    precipAmount: snapshot.precipAmount,
    hours
  });

  return snapshot;
}

// ============================================================
// INTEL
// ============================================================

function detectDominantFactor(s = {}) {
  const precipSignal = getPrecipSignal(s);
  if (precipSignal !== "none") return "rain";

  if (s.dewPoint >= 65) return "muggy";
  if (s.temp >= 85) return "heat";
  if (s.temp <= 45) return "cold";
  if (s.wind >= 12) return "wind";

  return "comfortable";
}

function buildIntel(snapshot, score, trend, windImpact, maxGust, label) {
  return {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint,
      wind: snapshot.wind,
      precipProbability: snapshot.precipProbability,
      precipAmount: snapshot.precipAmount
    },
    pattern: { trend, avg: score },
    context: { label },
    precipProbability: snapshot.precipProbability,
    precipAmount: snapshot.precipAmount,
    dominantFactor: detectDominantFactor(snapshot)
  };
}

// ============================================================
// BUILD PERIOD (DATA ONLY)
// ============================================================

function buildPeriod(hoursInput, label, change = {}) {
  if (!hoursInput?.length) return null;

  const hours = hoursInput.map(h => ({ ...h }));
  const snapshot = buildSnapshot(hours);

  const scores = hours
    .map(h => calculateComfort(h)?.score)
    .filter(Number.isFinite)
    .map(s => Math.round(s * 10));

  if (!scores.length) return null;

  const score = Math.round(avg(scores));
  const trend = scores.at(-1) - scores[0];

  const windValues = hours.map(h => h.windSpeed ?? 0);
  const gustValues = hours.map(h => h.windGust ?? 0);

  const maxWind = Math.max(...windValues, 0);
  const maxGust = Math.max(...gustValues, 0);

  const windImpact = Math.max(...windValues, ...gustValues.map(g => g * 0.7));

  const intel = buildIntel(snapshot, score, trend, windImpact, maxGust, label);

  return {
    label,
    score,
    snapshot,
    trend,
    intel,
    wind: {
      maxWind,
      maxGust,
      avgWind: avg(windValues),
      breezyHours: windValues.filter(w => w >= 10).length
    }
  };
}

// ============================================================
// FINAL NARRATIVE (ONLY SYSTEM)
// ============================================================

function finalizeSentence(text = "") {
  if (!text) return "";

  const trimmed = text.trim();
  const capitalized =
    trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  return /[.!?]$/.test(capitalized)
    ? capitalized
    : capitalized + ".";
}

function buildBulletSentence(bullets = []) {
  if (!bullets.length) return "";

  if (bullets.length === 1) return bullets[0];

  if (bullets.length === 2) {
    return `${bullets[0]} and ${bullets[1]}`;
  }

  return (
    bullets.slice(0, -1).join(", ") +
    ", and " +
    bullets[bullets.length - 1]
  );
}

function buildFinalNarrative(ctx, label) {
  if (!ctx) return fallback(label);

  const narrativeObj = assembleWithVoice(
    ctx.intel,
    label,
    mapScoreToCategory(ctx.score),
    ctx.score >= 85
  );

  const bullets = narrativeObj?.bullets || [];

  // ✅ PRIORITY: use full assembled sentence (what you saw in console)
  let narrative =
    narrativeObj?.notes ||
    buildBulletSentence(bullets);

  narrative = finalizeSentence(narrative);

  return {
    label,
    score: ctx.score,

    headline:
      narrativeObj?.headline || "Conditions are steady",

    narrative,

    bullets,

    emoji: resolveComfortIcon({
      score: ctx.score,
      temp: ctx.snapshot?.temp,
      dewPoint: ctx.snapshot?.dewPoint,
      wind: ctx.wind
    })
  };
}

// ============================================================
// ICON
// ============================================================

function resolveComfortIcon({ score, temp, dewPoint, wind = {} }) {
  const maxWind = wind.maxWind ?? 0;
  const maxGust = wind.maxGust ?? 0;
  const avgWind = wind.avgWind ?? 0;

  if (temp <= 40) return "🥶";
  if (temp <= 50) return "🧥";
  if (temp >= 90) return "🥵";
  if (temp >= 80 && dewPoint >= 65) return "😓";
  if (dewPoint >= 68) return "😫";
  if (dewPoint >= 62) return "😅";
  if (maxGust >= 25) return "💨";
  if (maxWind >= 15 || avgWind >= 12) return "🌬️";

  if (score >= 85) return "😄";
  if (score >= 70) return "🙂";
  if (score >= 55) return "😐";
  if (score >= 40) return "😕";

  return "🥵";
}

// ============================================================
// MAIN ENTRY
// ============================================================

export function buildHumanActionIntelFS(raw) {
  const rawHourly = raw?.hourly ?? [];
  if (!rawHourly.length) return fallbackAll();

  const now = Date.now();

  const hourly = alignHourly(rawHourly);
  if (!hourly.length) return fallbackAll();

  const { today, tomorrow } = splitDays(hourly, now);

  const todayCtx = buildPeriod(today, "today");
  const tomorrowCtx = buildPeriod(tomorrow, "tomorrow");

  return {
    feelscore: buildFinalNarrative(todayCtx, "today"),
    tomorrow: buildFinalNarrative(tomorrowCtx, "tomorrow")
  };
}

// ============================================================
// MISC
// ============================================================

function mapScoreToCategory(score) {
  if (score >= 85) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slight";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function fallback(label) {
  return {
    label,
    score: 50,
    headline: "Conditions are steady",
    narrative: "",
    bullets: [],
    emoji: "😐"
  };
}

function fallbackAll() {
  return {
    feelscore: fallback("today"),
    tomorrow: fallback("tomorrow")
  };
}