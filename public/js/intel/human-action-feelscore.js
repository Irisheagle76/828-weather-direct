// ============================================================
// HUMAN ACTION — FEELSCORE (FINAL STABLE VERSION)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";

// ============================================================
// MAIN ENTRY
// ============================================================
function getTs(h) {
  const ts = h?.timestamp ?? h?.ts ?? null;
  if (!ts) return null;

  // normalize seconds → milliseconds
  return ts < 1e12 ? ts * 1000 : ts;
}

export function buildHumanActionIntelFS(raw) {
  const hourly = Array.isArray(raw?.hourly) ? raw.hourly : [];

  // 🔍 DEBUG (safe)
  console.log("FEELSCORE INPUT SAMPLE:", hourly[0]);

  console.log("RAW HOURLY SAMPLE (first 5):");

hourly.slice(0, 5).forEach((h, i) => {
  console.log(i, {
    temp: h.temperatureF,
    dew: h.dewpointF,
    wind: h.windSpeed,
    ts: h.timestamp,
    date: new Date(getTs(h)).toString()
  });
});


  if (!hourly.length) return fallbackAll();

  const now = Date.now();

const todayHours = hourly.filter(h => {
  const ts = getTs(h);
  return ts && ts >= now && ts < now + 24 * 3600e3;
});

const tomorrowHours = hourly.filter(h => {
  const ts = getTs(h);
  return (
    ts &&
    ts >= now + 24 * 3600e3 &&
    ts < now + 48 * 3600e3
  );
});

  console.log("TOMORROW SAMPLE:", tomorrowHours[0]);

 // ==========================================================
// TEMPERATURE ANALYSIS (DEBUG SAFE)
// ==========================================================

// --- DEBUG: verify time alignment ---
console.log("NOW:", new Date(now).toString());

console.log(
  "TODAY HOURS (sample):",
  todayHours.slice(0, 3).map(h => ({
    temp: h.temperatureF,
    raw: h.timestamp,
    ts: getTs(h),
    date: new Date(getTs(h)).toString()
  }))
);

console.log(
  "TOMORROW HOURS (sample):",
  tomorrowHours.slice(0, 3).map(h => ({
    temp: h.temperatureF,
    raw: h.timestamp,
    ts: getTs(h),
    date: new Date(getTs(h)).toString()
  }))
);

// ==========================================================
// MAX TEMPS (safe, no silent masking)
// ==========================================================

const todayTemps = todayHours
  .map(h => h.temperatureF)
  .filter(Number.isFinite);

const tomorrowTemps = tomorrowHours
  .map(h => h.temperatureF)
  .filter(Number.isFinite);

const todayMax = todayTemps.length
  ? Math.max(...todayTemps)
  : null;

const tomorrowMax = tomorrowTemps.length
  ? Math.max(...tomorrowTemps)
  : null;

const tempDrop =
  todayMax !== null && tomorrowMax !== null
    ? todayMax - tomorrowMax
    : 0;

// ==========================================================
// TOMORROW MORNING LOW (timestamp-safe)
// ==========================================================

const tomorrowMorning = tomorrowHours.filter(h => {
  const ts = getTs(h);
  if (!ts) return false;

  const hr = new Date(ts).getHours();
  return hr >= 5 && hr <= 10;
});

const tomorrowMorningTemps = tomorrowMorning
  .map(h => h.temperatureF)
  .filter(Number.isFinite);

const tomorrowMin = tomorrowMorningTemps.length
  ? Math.min(...tomorrowMorningTemps)
  : null;

// ==========================================================
// DEBUG: confirm results
// ==========================================================

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
  // WIND ANALYSIS (KEY FIX AREA)
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
  // BUILD TOMORROW CONTEXT
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
// BUILD PERIOD CORE
// ============================================================

function buildPeriod(hours, label, change = {}) {
  if (!Array.isArray(hours) || !hours.length) return null;

  // ==========================================================
  // SCORES
  // ==========================================================

  const scores = hours
    .map(h => calculateComfort(h)?.score)
    .filter(Number.isFinite)
    .map(s => Math.round(s * 10));

  if (!scores.length) return null;

  const score = Math.round(average(scores));
  const trend = scores.at(-1) - scores[0];

  // ==========================================================
  // SNAPSHOT
  // ==========================================================

  const snapshot = {
    temp: avg(hours.map(h => h.temperatureF)),
    dewPoint: avg(hours.map(h => h.dewpointF)),
    wind: avg(hours.map(h => h.windSpeed))
  };

  if (!Number.isFinite(snapshot.temp)) return null;

  // ==========================================================
  // WIND SIGNALS (IMPORTANT)
  // ==========================================================

  const maxWind = Math.max(...hours.map(h => h.windSpeed ?? 0));
  const maxGust = Math.max(...hours.map(h => h.windGust ?? 0));

  const windImpact = Math.max(
    ...hours.map(h =>
      Math.max(
        h.windSpeed ?? 0,
        (h.windGust ?? 0) * 0.7
      )
    )
  );

  // ==========================================================
  // CHANGE SIGNALS
  // ==========================================================

  const { tempDrop = 0, windJump = 0, tomorrowMin = null } = change;

  const windChill = calcWindChill(snapshot.temp, snapshot.wind);
  const chillDelta = snapshot.temp - windChill;

  const isShockDay = label === "tomorrow" && tempDrop >= 18;

  const hasColdStart =
    label === "tomorrow" &&
    Number.isFinite(tomorrowMin) &&
    tomorrowMin <= 50;

  // ==========================================================
  // INTEL
  // ==========================================================

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
// BUILD NARRATIVE (WIND FIXED)
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
// CURRENT FEELSCORE
// ============================================================

function buildCurrentWithTrend(hours) {
  if (!hours.length) return fallback("today");

  const scores = hours
    .map(h => calculateComfort(h)?.score)
    .filter(Number.isFinite)
    .map(s => Math.round(s * 10));

  if (!scores.length) return fallback("today");

  const score = Math.round(average(scores));
  const trend = scores.at(-1) - scores[0];

  const snapshot = {
    temp: avg(hours.map(h => h.temperatureF)),
    dewPoint: avg(hours.map(h => h.dewpointF)),
    wind: avg(hours.map(h => h.windSpeed))
  };

  const intel = buildIntel(snapshot, score, trend, 0, 0, "today");

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      "today",
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    return fallback("today");
  }

  const narrativeText =
    narrative?.longNarrative ||
    narrative?.headline ||
    "";

  let bullets = extractBullets(narrativeText, {
    trend,
    snapshot,
    label: "today"
  });

  return {
    label: "today",
    score,
    emoji: pickEmoji(score),
    headline: extractHeadline(narrativeText),
    bullets: [...new Set(bullets)].slice(0, 3)
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