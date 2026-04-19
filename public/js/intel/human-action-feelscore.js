// ============================================================
// HUMAN ACTION — FEELSCORE (FULL REWRITE - NON REDUCTIVE)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";
import { buildFullExplanation } from "../modules/renderComfortNow.js";

// ============================================================
// TIME HELPERS
// ============================================================

function getTs(h) {
  const ts = h?.timestamp ?? h?.ts ?? null;
  if (!ts) return null;
  return ts < 1e12 ? ts * 1000 : ts;
}

// 🔥 ALIGN DATA TO "NOW" (CORE FIX)
function alignHourly(hourlyRaw = []) {
  const now = Date.now();

  const sorted = hourlyRaw
    .map(h => ({ ...h, _ts: getTs(h) }))
    .filter(h => h._ts)
    .sort((a, b) => a._ts - b._ts);

  const startIndex = sorted.findIndex(h => h._ts >= now);

  return startIndex === -1 ? [] : sorted.slice(startIndex);
}

// 🔥 SPLIT INTO CALENDAR DAYS (FIXES TOMORROW BUG)
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
    const ts = h._ts;
    if (!ts) continue;

    if (ts >= startToday && ts < startTomorrow) {
      today.push(h);
    } else if (ts >= startTomorrow && ts < startNext) {
      tomorrow.push(h);
    }
  }

  return { today, tomorrow };
}

// ============================================================
// MAIN ENTRY
// ============================================================

export function buildHumanActionIntelFS(raw) {
  const rawHourly = Array.isArray(raw?.hourly) ? raw.hourly : [];

  console.log("FEELSCORE INPUT SAMPLE:", rawHourly[0]);

  console.log("RAW HOURLY SAMPLE (first 5):");

  rawHourly.slice(0, 5).forEach((h, i) => {
    console.log(i, {
      temp: h.temperatureF,
      dew: h.dewpointF,
      wind: h.windSpeed,
      ts: h.timestamp,
      date: new Date(getTs(h)).toString()
    });
  });

  if (!rawHourly.length) return fallbackAll();

  const now = Date.now();

  // 🔥 FIX 1: ALIGN TIMELINE
  const hourly = alignHourly(rawHourly);
  if (!hourly.length) return fallbackAll();

  // 🔥 FIX 2: CORRECT DAY SPLIT
  const { today: todayHours, tomorrow: tomorrowHours } = splitDays(hourly, now);

  console.log("NOW:", new Date(now).toString());

  console.log(
    "TODAY HOURS (sample):",
    todayHours.slice(0, 3).map(h => ({
      temp: h.temperatureF,
      ts: h._ts,
      date: new Date(h._ts).toString()
    }))
  );

  console.log(
    "TOMORROW HOURS (sample):",
    tomorrowHours.slice(0, 3).map(h => ({
      temp: h.temperatureF,
      ts: h._ts,
      date: new Date(h._ts).toString()
    }))
  );

  // ==========================================================
  // TEMPERATURE ANALYSIS
  // ==========================================================

  const todayTemps = todayHours.map(h => h.temperatureF).filter(Number.isFinite);
  const tomorrowTemps = tomorrowHours.map(h => h.temperatureF).filter(Number.isFinite);

  const todayMax = todayTemps.length ? Math.max(...todayTemps) : null;
  const tomorrowMax = tomorrowTemps.length ? Math.max(...tomorrowTemps) : null;

  const tempDrop =
    todayMax !== null && tomorrowMax !== null
      ? todayMax - tomorrowMax
      : 0;

  const tomorrowMorning = tomorrowHours.filter(h => {
    const hr = new Date(h._ts).getHours();
    return hr >= 5 && hr <= 10;
  });

  const tomorrowMorningTemps = tomorrowMorning
    .map(h => h.temperatureF)
    .filter(Number.isFinite);

  const tomorrowMin = tomorrowMorningTemps.length
    ? Math.min(...tomorrowMorningTemps)
    : null;

  console.log("TEMP DEBUG:", {
    todayMax,
    tomorrowMax,
    tempDrop,
    tomorrowMin,
    counts: {
      today: todayHours.length,
      tomorrow: tomorrowHours.length,
      tomorrowMorning: tomorrowMorning.length
    }
  });

  // ==========================================================
  // WIND ANALYSIS
  // ==========================================================

  const todayWindMax = Math.max(
    ...todayHours.map(h => h.windSpeed ?? 0),
    0
  );

  const tomorrowWindMax = Math.max(
    ...tomorrowHours.map(h => h.windSpeed ?? 0),
    0
  );

  const windJump = tomorrowWindMax - todayWindMax;

  // ==========================================================
  // BUILD OUTPUT
  // ==========================================================

  const tomorrowCtx = buildPeriod(tomorrowHours, "tomorrow", {
    tempDrop,
    windJump,
    tomorrowMin
  });

  return {
    feelscore: buildCurrentWithTrend(todayHours),
    tomorrow: buildPeriodNarrative(tomorrowCtx, "tomorrow")
  };
}

// ============================================================
// BUILD PERIOD CORE (UNCHANGED STRUCTURE)
// ============================================================

function buildPeriod(hours, label, change = {}) {
  if (!Array.isArray(hours) || !hours.length) return null;

  const scores = hours
    .map(h => calculateComfort(h)?.score)
    .filter(Number.isFinite)
    .map(s => Math.round(s * 10));

  if (!scores.length) return null;

  const score = Math.round(average(scores));
  const trend = scores.at(-1) - scores[0];

  const snapshot = {
    temp: avg(hours.map(h => h.temperatureF)),
    dewPoint: avg(hours.map(h => h.dewpointF)),
    wind: avg(hours.map(h => h.windSpeed))
  };

  if (!Number.isFinite(snapshot.temp)) return null;

  const maxWind = Math.max(...hours.map(h => h.windSpeed ?? 0));
  const maxGust = Math.max(...hours.map(h => h.windGust ?? 0));

  const windImpact = Math.max(
    ...hours.map(h =>
      Math.max(h.windSpeed ?? 0, (h.windGust ?? 0) * 0.7)
    )
  );

  const { tempDrop = 0, windJump = 0, tomorrowMin = null } = change;

  const windChill = calcWindChill(snapshot.temp, snapshot.wind);
  const chillDelta = snapshot.temp - windChill;

  const isShockDay = label === "tomorrow" && tempDrop >= 18;

  const hasColdStart =
    label === "tomorrow" &&
    Number.isFinite(tomorrowMin) &&
    tomorrowMin <= 50;

  const intel = buildIntel(
    snapshot,
    score,
    trend,
    windImpact,
    maxGust,
    label
  );

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      label,
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    narrative = null;
  }

  return {
    label,
    score,
    snapshot,
    trend,
    narrativeText:
      narrative?.longNarrative ||
      narrative?.headline ||
      "",
    flags: {
      isShockDay,
      hasColdStart
    },
    change: {
      tempDrop,
      windJump,
      chillDelta,
      tomorrowMin
    },
    wind: {
      maxWind,
      maxGust
    }
  };
}

// ============================================================
// CURRENT FEELSCORE (FIXED CORE ISSUE)
// ============================================================

function buildCurrentWithTrend(hours) {
  if (!hours.length) return fallback("today");

  const first = hours[0]; // current hour anchor

  const currentScore = calculateComfort(first)?.score;
  if (!Number.isFinite(currentScore)) return fallback("today");

  const scores = hours
    .map(h => calculateComfort(h)?.score)
    .filter(Number.isFinite)
    .map(s => Math.round(s * 10));

  const trend = scores.length ? scores.at(-1) - scores[0] : 0;

  // 🔥 IMPORTANT: use CURRENT conditions, not averages
  const snapshot = {
    temp: first.temperatureF,
    dewPoint: first.dewpointF,
    wind: first.windSpeed
  };

  const intel = buildIntel(snapshot, currentScore * 10, trend, 0, 0, "today");

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      "today",
      mapScoreToCategory(currentScore * 10),
      currentScore * 10 >= 85
    );
  } catch {
    return fallback("today");
  }

  // 🔥 NEW: use your real narrative engine
  const explanation = buildFullExplanation(
    {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint,
      windSpeed: snapshot.wind
    },
    narrative,
    hours
  );

  return {
    label: "today",
    score: Math.round(currentScore * 10),
    emoji: pickEmoji(currentScore * 10),

    // keep headline simple + safe
   headline:
  narrative?.headline ||
  (trend > 10
    ? "Rapid improvement in comfort ahead"
    : "Comfort gradually improving"),

    // 🔥 CRITICAL CHANGE: replace bullets with real narrative
    bullets: [explanation]
  };
}
// ============================================================
// BUILD NARRATIVE (RESTORED - REQUIRED)
// ============================================================

function buildPeriodNarrative(ctx, label) {
  if (!ctx) return fallback(label);

  const { score, narrativeText, flags, change, wind } = ctx;

  const { isShockDay, hasColdStart } = flags;
  const { tempDrop, chillDelta, tomorrowMin } = change;

  const maxWind = wind?.maxWind ?? 0;
  const maxGust = wind?.maxGust ?? 0;

  // ==========================================================
  // HEADLINE
  // ==========================================================

  let headline;

  if (maxGust >= 45) {
    headline = "Strong winds may cause impacts tomorrow";
  } else if (maxGust >= 30) {
    headline = "Gusty winds will be a major factor tomorrow";
  } else if (maxWind >= 12) {
    headline = "Breezy conditions develop tomorrow";
  } else if (isShockDay) {
    headline =
      tempDrop >= 25
        ? "A sharp cooldown hits tomorrow"
        : "A noticeably cooler day arrives tomorrow";
  } else if (hasColdStart) {
    headline = "A chilly start leads into a cool day";
  } else {
    headline =
      extractHeadline(narrativeText) ||
      "Conditions settle into a steady pattern";
  }

  // ==========================================================
  // BULLETS
  // ==========================================================

  let bullets = [];

  if (isShockDay) {
    bullets.push("Much colder than today — a noticeable drop");
  }

  if (hasColdStart) {
    bullets.push(
      tomorrowMin <= 42
        ? "Cold start in the 40s"
        : "Cool start early in the day"
    );
  }

  if (maxGust >= 45) {
    bullets.push("Wind gusts could exceed 45 mph at times");
  } else if (maxGust >= 30) {
    bullets.push("Gusty winds up to around 30–40 mph");
  } else if (maxWind >= 12) {
    bullets.push("Breezy conditions at times");
  }

  if (chillDelta >= 5) {
    bullets.push("Feels colder than the temperature suggests");
  }

  if (isShockDay && tempDrop >= 25) {
    bullets.push("You’ll likely want a jacket after today's warmth");
  }

  if (bullets.length < 2) {
    bullets = [
      ...bullets,
      ...extractBullets(narrativeText, {
        trend: 0,
        snapshot: ctx.snapshot,
        label
      })
    ];
  }

  bullets = [...new Set(bullets)].slice(0, 3);

  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline,
    bullets
  };
}
// ============================================================
// HELPERS
// ============================================================

const avg = arr =>
  arr.filter(Number.isFinite).reduce((a, b) => a + b, 0) / arr.length || null;

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function extractHeadline(text = "") {
  return text.split(".")[0]?.trim() || "";
}

function extractBullets(text = "", { trend, snapshot, label }) {
  const bullets = [];
  const t = text.toLowerCase();

  if (t.includes("dry")) bullets.push("Dry air keeps things comfortable");
  if (t.includes("wind")) bullets.push("Wind plays a noticeable role");
  if (t.includes("cool") && label === "tomorrow") bullets.push("Cooler air settles in");

  if (trend > 5) bullets.push("Improves through the day");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  return bullets;
}

function pickEmoji(score) {
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  return "😐";
}

function fallback(label) {
  return {
    label,
    score: 50,
    headline: "Conditions are steady",
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

function buildIntel(snapshot, score, trend, windImpact, maxGust, label) {
  return {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint ?? null,
      wind: snapshot.wind ?? 0
    },
    pattern: { trend, avg: score },
    context: { label },
    dominantFactor: detectDominantFactor(snapshot)
  };
}

function detectDominantFactor(s = {}) {
  if (s.dewPoint >= 65) return "muggy";
  if (s.temp >= 85) return "heat";
  if (s.temp <= 45) return "cold";
  if (s.wind >= 12) return "wind";
  return "comfortable";
}

function mapScoreToCategory(score) {
  if (score >= 85) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slight";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function calcWindChill(temp, wind) {
  if (temp > 50 || wind < 3) return temp;

  return (
    35.74 +
    0.6215 * temp -
    35.75 * Math.pow(wind, 0.16) +
    0.4275 * temp * Math.pow(wind, 0.16)
  );
}