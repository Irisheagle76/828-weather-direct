// ============================================================
// HUMAN ACTION — FEELSCORE (CLEAN + INTELLIGENCE MERGED)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js?v=20260513-subtle-comfort-dip";
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

function splitDays(hourly, now, periodContext = null) {
  const d = new Date(now);

  const startToday = new Date(d);
  startToday.setHours(0, 0, 0, 0);

  const startTomorrow = new Date(startToday);
  startTomorrow.setDate(startTomorrow.getDate() + 1);

  const startNext = new Date(startTomorrow);
  startNext.setDate(startNext.getDate() + 1);

  const overnightEnd = new Date(startTomorrow);
  overnightEnd.setHours(8, 0, 0, 0);

  const currentPeriodEnd =
    periodContext?.key === "tonight"
      ? overnightEnd
      : startTomorrow;

  const today = [];
  const tomorrow = [];

  for (const h of hourly) {
    if (h._ts >= now && h._ts < currentPeriodEnd) today.push(h);
    else if (h._ts >= startTomorrow && h._ts < startNext) tomorrow.push(h);
  }

  return { today, tomorrow };
}

function buildCurrentPeriodContext(now) {
  const hour = new Date(now).getHours();

  if (hour >= 17) {
    return {
      key: "tonight",
      label: "tonight",
      trendLead: "Later tonight",
      fallbackLabel: "tonight"
    };
  }

  if (hour >= 12) {
    return {
      key: "today",
      label: "rest of today",
      trendLead: "Through the rest of today",
      fallbackLabel: "today"
    };
  }

  return {
    key: "today",
    label: "today",
    trendLead: "Later today",
    fallbackLabel: "today"
  };
}

// ============================================================
// PRECIP + SNAPSHOT
// ============================================================

function getPrecipSignal({ precipProbability = 0, precipAmount = 0 }) {
  if (precipProbability >= 0.7) return "high";
  if (precipProbability >= 0.4) return "moderate";
  if (precipProbability >= 0.2) return "low";
  if (precipAmount >= 0.10) return "high";
  if (precipAmount >= 0.03) return "moderate";
  return "none";
}

function getPrecipType({ precipProbability = 0, precipAmount = 0, hours = [] }) {
  const maxRate = Math.max(...hours.map(h => h.precipAmount ?? 0), 0);
  const activeHours = hours.filter(h => (h.precipAmount ?? 0) > 0).length;

  if (maxRate >= 0.10) return "steady_rain";
  if (maxRate >= 0.03) return "light_rain";

  if (precipProbability >= 0.7 && activeHours >= 6) return "periods_of_rain";
  if (precipProbability >= 0.5) return "scattered_showers";
  if (precipProbability >= 0.2) return "isolated_showers";

  return "none";
}

function describeDaypart(ts) {
  if (!Number.isFinite(ts)) return "later today";

  const hour = new Date(ts).getHours();

  if (hour < 6) return "overnight";
  if (hour < 10) return "early this morning";
  if (hour < 12) return "later this morning";
  if (hour < 17) return "this afternoon";
  if (hour < 21) return "this evening";
  return "tonight";
}

function buildPrecipTiming(hours = []) {
  const wetHours = hours.filter(h => {
    const amount = h.precipAmount ?? 0;
    const probability = h.precipProbability ?? 0;
    return amount >= 0.005 || probability >= 0.25;
  });

  if (!wetHours.length) return null;

  const first = wetHours[0];
  const last = wetHours[wetHours.length - 1];

  return {
    firstTs: first._ts ?? first.timestamp ?? null,
    lastTs: last._ts ?? last.timestamp ?? null,
    starts: describeDaypart(first._ts ?? first.timestamp),
    ends: describeDaypart(last._ts ?? last.timestamp),
    activeHours: wetHours.length
  };
}

function buildSnapshot(hours = []) {
  if (!hours.length) return null;

  const first = hours[0];

  const maxProb = Math.max(...hours.map(h => h.precipProbability ?? 0), 0);
  const maxAmt = Math.max(...hours.map(h => h.precipAmount ?? 0), 0);
  const avgAmt = avg(hours.map(h => h.precipAmount ?? 0)) ?? 0;

  const snapshot = {
    temp: first.temperatureF,
    dewPoint: first.dewpointF,
    wind: first.windSpeed,
    gust: first.windGust,
    precipProbability: maxProb,
    precipAmount: maxAmt,
    precipAmountAvg: avgAmt,
    isRainingNow: (first.precipAmount ?? 0) > 0,
    precipTiming: buildPrecipTiming(hours)
  };

  snapshot.precipType = getPrecipType({
    precipProbability: snapshot.precipProbability,
    precipAmount: snapshot.precipAmount,
    hours
  });

  return snapshot;
}

// ============================================================
// 🆕 SHORT-TERM TREND
// ============================================================

function computeShortTermTrend(hours = []) {
  const [h0 = {}, h1 = {}, h2 = {}] = hours;

  const get = (v) => (Number.isFinite(v) ? v : null);

  return {
    tempTrend: (get(h2.temperatureF) ?? 0) - (get(h0.temperatureF) ?? 0),
    dewTrend:  (get(h2.dewpointF) ?? 0) - (get(h0.dewpointF) ?? 0),
    windTrend: (get(h2.windSpeed) ?? 0) - (get(h0.windSpeed) ?? 0)
  };
}

// ============================================================
// 🆕 TREND FLAVOR
// ============================================================

function applyTrendFlavor(text, shortTerm = {}, periodContext = {}) {
  if (!text) return text;

  const { tempTrend = 0, dewTrend = 0, windTrend = 0 } = shortTerm;
  const lead = periodContext?.trendLead || "Later on";

  let additions = [];

  if (tempTrend >= 2) additions.push("temperatures climb a bit");
  if (tempTrend <= -2) additions.push("temperatures ease a little");

  if (dewTrend >= 2) additions.push("humidity ticks up");
  if (dewTrend <= -2) additions.push("the air dries out");

  if (windTrend >= 3) additions.push("the breeze picks up");
  if (windTrend <= -3) additions.push("the wind eases back");

  if (!additions.length) return text;

  const trendSentence =
    additions.length === 1
      ? `${lead}, ${additions[0]}.`
      : `${lead}, ${additions.slice(0, -1).join(", ")} and ${additions.at(-1)}.`;

  return `${text.replace(/\.$/, "")}. ${trendSentence}`;
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

function buildIntel(snapshot, score, trend, windImpact, maxGust, label, shortTerm, periodContext) {
  return {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint,
      wind: snapshot.wind,
      windGust: snapshot.gust,
      precipProbability: snapshot.precipProbability,
      precipAmount: snapshot.precipAmount,
      precipTiming: snapshot.precipTiming
    },
    pattern: { trend, avg: score },
    context: {
      label,
      period: periodContext?.key ?? label,
      speaksFor: periodContext?.label ?? label,
      remainingDay: label !== "tomorrow"
    },
    precipProbability: snapshot.precipProbability,
    precipAmount: snapshot.precipAmount,
    precipTiming: snapshot.precipTiming,
    dominantFactor: detectDominantFactor(snapshot),
    shortTerm
  };
}

// ============================================================
// BUILD PERIOD
// ============================================================

function buildPeriod(hoursInput, label, periodContext = null) {
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

  const shortTerm = computeShortTermTrend(hours.slice(0, 3));

  const intel = buildIntel(
    snapshot,
    score,
    trend,
    windImpact,
    maxGust,
    label,
    shortTerm,
    periodContext
  );

  return {
    label,
    periodContext,
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
// FINAL NARRATIVE
// ============================================================

function finalizeSentence(text = "") {
  if (!text) return "";

  const trimmed = text.trim();
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  return /[.!?]$/.test(capitalized)
    ? capitalized
    : capitalized + ".";
}

function buildBulletSentence(bullets = []) {
  if (!bullets.length) return "";

  if (bullets.length === 1) return bullets[0];
  if (bullets.length === 2) return `${bullets[0]} and ${bullets[1]}`;

  return (
    bullets.slice(0, -1).join(", ") +
    ", and " +
    bullets[bullets.length - 1]
  );
}

function buildFinalNarrative(ctx, label, periodContext = null) {
  if (!ctx) return fallback(periodContext?.fallbackLabel ?? label);

  const narrativePeriod = periodContext?.key ?? label;

  const narrativeObj = assembleWithVoice(
    ctx.intel,
    narrativePeriod,
    mapScoreToCategory(ctx.score),
    ctx.score >= 85
  );

  const bullets = narrativeObj?.bullets || [];

  let narrative =
    narrativeObj?.notes ||
    buildBulletSentence(bullets);

  // 🔥 APPLY TREND INTELLIGENCE
  narrative = applyTrendFlavor(narrative, ctx.intel?.shortTerm, periodContext);

  narrative = finalizeSentence(narrative);

  return {
    label: periodContext?.fallbackLabel ?? label,
    speaksFor: periodContext?.label ?? label,
    score: ctx.score,
    headline: narrativeObj?.headline || "Conditions are steady",
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

function normalizeCopyKey(text = "") {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pickDistinct(options = [], avoid = "") {
  const avoidKey = normalizeCopyKey(avoid);
  return options.find(option => normalizeCopyKey(option) !== avoidKey) || options[0] || "";
}

function describeComfortHeadline(ctx, label, avoid = "") {
  const score = ctx?.score ?? 0;
  const temp = ctx?.snapshot?.temp;
  const dew = ctx?.snapshot?.dewPoint;
  const wind = ctx?.wind?.avgWind ?? ctx?.wind?.maxWind ?? 0;
  const isTomorrow = label === "tomorrow";

  if (temp <= 48 && score >= 75) {
    return pickDistinct(
      isTomorrow
        ? ["Cool start, nice finish", "A crisp start, then easier", "Chilly early, comfortable later"]
        : ["A cool start, then easier", "Crisp early, comfortable later", "The cool air relaxes a bit"],
      avoid
    );
  }

  if (dew != null && dew < 52 && score >= 75) {
    return pickDistinct(
      isTomorrow
        ? ["Dry air keeps it pleasant", "Low humidity does the heavy lifting", "A clean, easy feel outside"]
        : ["Dry air keeps things pleasant", "Low humidity helps a lot", "A clean feel outside"],
      avoid
    );
  }

  if (wind >= 10) {
    return pickDistinct(
      isTomorrow
        ? ["A little breeze in the mix", "Comfortable, with some breeze", "Easy overall, just breezy at times"]
        : ["A light breeze in the mix", "Comfortable, with a breeze", "Easy overall, just a bit breezy"],
      avoid
    );
  }

  if (score >= 85) {
    return pickDistinct(
      isTomorrow
        ? ["Another easy day outside", "A really usable day", "Comfort holds up well"]
        : ["A good day to be outside", "Comfort holds up well", "A really usable stretch"],
      avoid
    );
  }

  return pickDistinct(
    isTomorrow
      ? ["Tomorrow stays manageable", "A decent setup for tomorrow", "Comfort looks steady tomorrow"]
      : ["Comfort looks steady", "A manageable setup", "Not much fighting comfort"],
    avoid
  );
}

function diversifyNarratives(feelscore, tomorrow, todayCtx, tomorrowCtx) {
  if (!feelscore || !tomorrow) return { feelscore, tomorrow };

  let nextTomorrow = { ...tomorrow };

  if (normalizeCopyKey(feelscore.headline) === normalizeCopyKey(nextTomorrow.headline)) {
    nextTomorrow.headline = describeComfortHeadline(tomorrowCtx, "tomorrow", feelscore.headline);
  }

  if (normalizeCopyKey(feelscore.narrative) === normalizeCopyKey(nextTomorrow.narrative)) {
    const detail = describeComfortHeadline(tomorrowCtx, "tomorrow", feelscore.headline).toLowerCase();
    nextTomorrow.narrative = finalizeSentence(`Tomorrow keeps a similar feel, but the main story is ${detail}`);
  }

  const todayBulletKeys = new Set((feelscore.bullets || []).map(normalizeCopyKey));
  const filteredBullets = (nextTomorrow.bullets || []).filter(b => !todayBulletKeys.has(normalizeCopyKey(b)));
  if (filteredBullets.length) {
    nextTomorrow.bullets = filteredBullets.slice(0, 3);
  }

  return { feelscore, tomorrow: nextTomorrow };
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

  const currentPeriod = buildCurrentPeriodContext(now);
  const { today, tomorrow } = splitDays(hourly, now, currentPeriod);

  const todayCtx = buildPeriod(today, "today", currentPeriod);
  const tomorrowCtx = buildPeriod(tomorrow, "tomorrow");
  const feelscore = buildFinalNarrative(todayCtx, "today", currentPeriod);
  const tomorrowNarrative = buildFinalNarrative(tomorrowCtx, "tomorrow");

  return diversifyNarratives(feelscore, tomorrowNarrative, todayCtx, tomorrowCtx);
}

// ============================================================
// MISC
// ============================================================

function mapScoreToCategory(score) {
  if (score >= 85) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slightlyUncomfortable";
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
