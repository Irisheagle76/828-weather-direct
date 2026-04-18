// ============================================================
// HUMAN ACTION — FEELSCORE (FULL + STABLE + NO REGRESSIONS)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";

// ============================================================
// MAIN
// ============================================================

export function buildHumanActionIntelFS(raw) {
  const hourly = Array.isArray(raw?.hourly) ? raw.hourly : [];
  if (!hourly.length) return fallbackAll();

  const now = Date.now();

  const todayHours = hourly.filter(
    h => h.ts >= now && h.ts < now + 24 * 3600e3
  );

  const tomorrowHours = hourly.filter(
    h => h.ts >= now + 24 * 3600e3 && h.ts < now + 48 * 3600e3
  );

  // ------------------------------------------------------------
  // TEMP (MAX-BASED CHANGE — PRESERVED + IMPROVED)
  // ------------------------------------------------------------
  const getTemp = h =>
    h?.temp ?? h?.temperature ?? h?.temperatureF ?? null;

  const todayMax = Math.max(
    ...todayHours.map(getTemp).filter(v => typeof v === "number"),
    -999
  );

  const tomorrowMax = Math.max(
    ...tomorrowHours.map(getTemp).filter(v => typeof v === "number"),
    -999
  );

  const tempDrop =
    todayMax > -900 && tomorrowMax > -900
      ? todayMax - tomorrowMax
      : 0;

  // ------------------------------------------------------------
  // MORNING LOW (COLD START)
  // ------------------------------------------------------------
  const tomorrowMorning = tomorrowHours.filter(h => {
    const hr = new Date(h.ts).getHours();
    return hr >= 5 && hr <= 10;
  });

  const tomorrowMinMorning = Math.min(
    ...tomorrowMorning.map(getTemp).filter(v => typeof v === "number"),
    999
  );

  const tomorrowMin =
    tomorrowMinMorning < 900
      ? tomorrowMinMorning
      : Math.min(
          ...tomorrowHours.map(getTemp).filter(v => typeof v === "number"),
          999
        );

  // ------------------------------------------------------------
  // WIND (MAX — PRESERVED)
  // ------------------------------------------------------------
  const getWind = h =>
    h?.wind ?? h?.windSpeed ?? h?.windspeed ?? h?.wind_speed ?? 0;

  const todayWindMax = Math.max(...todayHours.map(getWind), 0);
  const tomorrowWindMax = Math.max(...tomorrowHours.map(getWind), 0);

  const windJump = tomorrowWindMax - todayWindMax;

  // ------------------------------------------------------------
  // BUILD TOMORROW CONTEXT
  // ------------------------------------------------------------
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
// BUILD PERIOD (DETECTION ONLY — NO UI LOGIC)
// ============================================================

function buildPeriod(hours, label, change = {}) {
  if (!Array.isArray(hours) || !hours.length) return null;

  // 🔍 DEBUG — RAW INPUT TO THIS PERIOD
  if (label === "tomorrow") {
    const debug = hours.map(h => ({
      time: new Date(h.timestamp).toLocaleString(),
      temp: h.temperatureF,
      rh: h.relativeHumidity,
      wind: h.windSpeed,
      gust: h.windGust
    }));

    console.table(debug);
  }

  const mapped = mapComfort(hours);
  const scores = mapped.map(h => h.score).filter(s => typeof s === "number");
  if (!scores.length) return null;

  const avg = average(scores);
  const trend = scores.at(-1) - scores[0];
  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);
  if (typeof snapshot.temp !== "number") return null;

  const {
    tempDrop = 0,
    windJump = 0,
    tomorrowMin = null
  } = change;

  const windChill = calcWindChill(snapshot.temp, snapshot.windSpeed);
  const chillDelta = snapshot.temp - windChill;

  const isShockDay = label === "tomorrow" && tempDrop >= 18;
  const hasColdStart =
    label === "tomorrow" &&
    typeof tomorrowMin === "number" &&
    tomorrowMin <= 50;

  const isWindyShift =
    label === "tomorrow" &&
    windJump >= 8;

  const maxWind = Math.max(...hours.map(h => h.windSpeed ?? 0));
const maxGust = Math.max(...hours.map(h => h.windGust ?? 0));

const windSignal = Math.max(
  ...hours.map(h => Math.max(h.windSpeed ?? 0, (h.windGust ?? 0) * 0.7))
);

const intel = buildIntel(
  snapshot,
  score,
  trend,
  maxWind,
  windSignal,
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
    narrative,
    narrativeText:
      narrative?.longNarrative ||
      narrative?.headline ||
      "",
    flags: {
      isShockDay,
      hasColdStart,
      isWindyShift
    },
    change: {
      tempDrop,
      windJump,
      chillDelta,
      tomorrowMin
    }
  };
}

// ============================================================
// BUILD NARRATIVE (FINAL OUTPUT)
// ============================================================

function buildPeriodNarrative(ctx, label) {
  if (!ctx) return fallback(label);

  const { score, narrativeText, flags, change } = ctx;
  const { isShockDay, hasColdStart, isWindyShift } = flags;
  const { tempDrop, chillDelta, tomorrowMin } = change;

  // ------------------------------------------------------------
  // HEADLINE
  // ------------------------------------------------------------
  let headline;

  if (isShockDay) {
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

  // ------------------------------------------------------------
  // BULLETS
  // ------------------------------------------------------------
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

  if (isWindyShift) {
    bullets.push("Breezy to gusty winds at times");
  }

  if (chillDelta >= 5) {
    bullets.push("Feels colder than the temperature suggests");
  }

  if (isShockDay && tempDrop >= 25) {
    bullets.push("You’ll likely want a jacket after today's warmth");
  }

  // fallback narrative fill (PRESERVED BEHAVIOR)
  if (bullets.length < 2) {
    const extracted = extractBullets(narrativeText, {
      trend: 0,
      snapshot: ctx.snapshot,
      label
    });
    bullets = [...bullets, ...extracted];
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
// FEELSCORE (UNCHANGED CORE LOGIC)
// ============================================================

function buildCurrentWithTrend(hours) {
  if (!Array.isArray(hours) || !hours.length) return fallback("today");

  const mapped = mapComfort(hours);
  const scores = mapped.map(h => h.score).filter(s => typeof s === "number");
  if (!scores.length) return fallback("today");

  const avg = average(scores);
  const trend = scores.at(-1) - scores[0];
  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);
  if (typeof snapshot.temp !== "number") return fallback("today");

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

  if (bullets.length < 2 && snapshot.dewPoint < 55) {
    bullets.push("Dry air keeps things comfortable");
  }

  return {
    label: "today",
    score,
    emoji: pickEmoji(score),
    headline: extractHeadline(narrativeText),
    bullets: [...new Set(bullets)].slice(0, 3)
  };
}

// ============================================================
// HELPERS (FULLY PRESERVED)
// ============================================================

function mapComfort(hours) {
  return hours.map(h => {
    const c = calculateComfort(h);
    return {
      hour: new Date(h.ts).getHours(),
      score: Math.round((c?.score || 0) * 10)
    };
  });
}

function buildSnapshot(hours) {
  const avg = (keys) => {
    const vals = hours
      .map(h => {
        const key = keys.find(k => typeof h[k] === "number");
        return key ? h[key] : null;
      })
      .filter(v => v != null);

    return vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  };

  return {
    temp: avg(["temp", "temperature", "temperatureF"]),
    dewPoint: avg(["dewPoint", "dewpoint", "dewpointF"]),
    wind: avg(["wind", "windSpeed", "windspeed", "wind_speed"]) ?? 0
  };
}

function extractHeadline(text = "") {
  return text.split(".")[0]?.trim() || "";
}

function extractBullets(text = "", { trend, snapshot, label }) {
  const bullets = [];
  const t = text.toLowerCase();

  if (t.includes("dry")) bullets.push("Dry air keeps things feeling good");
  if (t.includes("wind")) bullets.push("Wind plays a noticeable role");
  if (t.includes("cool") && label === "tomorrow") bullets.push("Cooler air settles in");

  if (trend > 5) bullets.push("Improves through the day");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  return bullets;
}

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
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

function buildIntel(snapshot, score, trend, min, max, label) {
  return {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint ?? null,
      wind: snapshot.wind ?? 0
    },
    pattern: { trend, min, max, avg: score },
    context: { label, timeWindow: "afternoon" },
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