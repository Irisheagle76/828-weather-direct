// ============================================================
// HUMAN ACTION — FEELSCORE (FULL CLEAN REWRITE)
// ============================================================

import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";
import { normalizeHourly } from "../utils/normalizeWeather.js";

// ============================================================
// MAIN
// ============================================================

export function buildHumanActionIntelFS(raw) {

console.log("AFTER NORMALIZE SAMPLE:", hourly[0]);

  if (!hourly.length) return fallbackAll();

  const now = Date.now();

  const todayHours = hourly.filter(
    h => h.timestamp >= now && h.timestamp < now + 24 * 3600e3
  );

  const tomorrowHours = hourly.filter(
    h => h.timestamp >= now + 24 * 3600e3 && h.timestamp < now + 48 * 3600e3
  );

  console.log("TOMORROW SAMPLE:", tomorrowHours[0]);

const getTemp = h => h.temperatureF;

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

  const tomorrowMorning = tomorrowHours.filter(h => {
    const hr = new Date(h.ts).getHours();
    return hr >= 5 && hr <= 10;
  });

  const tomorrowMin = Math.min(
    ...tomorrowMorning.map(getTemp).filter(v => typeof v === "number"),
    999
  );

 const getWind = h =>
  h.windSpeed;

  const todayWindMax = Math.max(...todayHours.map(getWind), 0);
  const tomorrowWindMax = Math.max(...tomorrowHours.map(getWind), 0);

  const windJump = tomorrowWindMax - todayWindMax;

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
// BUILD PERIOD
// ============================================================

function buildPeriod(hours, label, change = {}) {
  if (!Array.isArray(hours) || !hours.length) return null;

  const safe = hours.map(h => ({
    ts: h.timestamp ?? h.ts,
    temp: h.temperatureF ?? h.temp,
    windSpeed: h.windSpeed ?? h.wind ?? 0,
    windGust: h.windGust ?? null,
    rh: h.relativeHumidity ?? h.rh,
    dewPoint: h.dewpointF ?? h.dewPoint ?? null
  }));

  const mapped = mapComfort(safe);
  const scores = mapped.map(h => h.score).filter(Boolean);
  if (!scores.length) return null;

  const score = Math.round(average(scores));
  const trend = scores.at(-1) - scores[0];

  const snapshot = buildSnapshot(safe);
  if (typeof snapshot.temp !== "number") return null;

  const { tempDrop = 0, windJump = 0, tomorrowMin = null } = change;

  const maxWind = Math.max(...safe.map(h => h.windSpeed ?? 0));
  const maxGust = Math.max(...safe.map(h => h.windGust ?? 0));

  const windSignal = Math.max(
    ...safe.map(h =>
      Math.max(h.windSpeed ?? 0, (h.windGust ?? 0) * 0.7)
    )
  );

  const windChill = calcWindChill(snapshot.temp, snapshot.wind);
  const chillDelta = snapshot.temp - windChill;

  const isShockDay = label === "tomorrow" && tempDrop >= 18;

  const hasColdStart =
    label === "tomorrow" &&
    typeof tomorrowMin === "number" &&
    tomorrowMin <= 50;

  const intel = buildIntel(
    snapshot,
    score,
    trend,
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
// BUILD NARRATIVE
// ============================================================

function buildPeriodNarrative(ctx, label) {
  if (!ctx) return fallback(label);

  const { score, narrativeText, flags, change, wind } = ctx;

  const { isShockDay, hasColdStart } = flags;
  const { tempDrop, chillDelta, tomorrowMin } = change;

  const maxWind = wind?.maxWind ?? 0;
  const maxGust = wind?.maxGust ?? 0;

  let headline;

  if (maxGust >= 40) {
    headline = "Strong, gusty winds will be a major factor tomorrow";
  } else if (maxGust >= 30) {
    headline = "Gusty winds will play a big role tomorrow";
  } else if (maxWind >= 15) {
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

  if (maxGust >= 40) {
    bullets.push("Strong wind gusts could exceed 40 mph");
  } else if (maxGust >= 30) {
    bullets.push("Gusty winds up to around 30–40 mph");
  } else if (maxWind >= 15) {
    bullets.push("Breezy conditions at times");
  }

  if (chillDelta >= 5) {
    bullets.push("Feels colder than the temperature suggests");
  }

  if (isShockDay && tempDrop >= 25) {
    bullets.push("You’ll likely want a jacket after today's warmth");
  }

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
// FEELSCORE (UNCHANGED CORE)
// ============================================================

function buildCurrentWithTrend(hours) {
  if (!Array.isArray(hours) || !hours.length) return fallback("today");

  const mapped = mapComfort(hours);
  const scores = mapped.map(h => h.score).filter(Boolean);
  if (!scores.length) return fallback("today");

  const score = Math.round(average(scores));
  const trend = scores.at(-1) - scores[0];

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
// HELPERS
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
    wind: avg(["wind", "windSpeed", "wind_speed"]) ?? 0
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