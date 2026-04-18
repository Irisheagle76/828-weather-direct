// ============================================================
// HUMAN ACTION — FEELSCORE (NARRATIVE-DRIVEN)
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

  const todayHours = hourly.filter(h => h.ts >= now && h.ts < now + 24 * 3600e3);
  const tomorrowHours = hourly.filter(h => h.ts >= now + 24 * 3600e3 && h.ts < now + 48 * 3600e3);

  return {
    feelscore: buildCurrentWithTrend(todayHours),
    tomorrow: buildPeriod(tomorrowHours, "tomorrow")
  };
}

// ============================================================
// PERIOD (TOMORROW)
// ============================================================

function buildPeriod(hours, label) {
  if (!Array.isArray(hours) || !hours.length) return fallback(label);

  const mapped = mapComfort(hours);

  const window = mapped.filter(h => h.hour >= 13 && h.hour <= 16);
  const base = window.length ? window : mapped;

  const scores = base.map(h => h.score).filter(s => typeof s === "number");
  if (!scores.length) return fallback(label);

  const avg = average(scores);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const trend = scores.at(-1) - scores[0];
  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);
  if (typeof snapshot.temp !== "number") return fallback(label);

  const intel = buildIntel(snapshot, score, trend, min, max, label);

  let narrative;
  try {
    narrative = assembleWithVoice(
      intel,
      label,
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    return fallback(label);
  }

  const narrativeText =
    narrative?.longNarrative ||
    narrative?.headline ||
    "";

  const headline =
    extractHeadline(narrativeText, label) ||
    narrative?.headline ||
    buildHeadline(score, snapshot);

  const bullets =
    extractBullets(narrativeText, { trend, snapshot, label }) ||
    buildBullets(snapshot, trend);

  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline,
    bullets: bullets.slice(0, 3)
  };
}

// ============================================================
// FEELSCORE (CURRENT + TODAY MERGED)
// ============================================================

function buildCurrentWithTrend(hours) {
  if (!Array.isArray(hours) || !hours.length) return fallback("today");

  const mapped = mapComfort(hours);

  const scores = mapped.map(h => h.score).filter(s => typeof s === "number");
  if (!scores.length) return fallback("today");

  const avg = average(scores);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const trend = scores.at(-1) - scores[0];
  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);
  if (typeof snapshot.temp !== "number") return fallback("today");

  const intel = buildIntel(snapshot, score, trend, min, max, "today");

  let current, today;

  try {
    current = assembleWithVoice(
      { ...intel, context: { ...intel.context, timeWindow: "current" } },
      "today",
      mapScoreToCategory(score),
      score >= 85
    );

    today = assembleWithVoice(
      intel,
      "today",
      mapScoreToCategory(score),
      score >= 85
    );
  } catch {
    return fallback("today");
  }

  const narrativeText =
    today?.longNarrative ||
    current?.longNarrative ||
    today?.headline ||
    "";

  const headline =
    extractHeadline(narrativeText, "today") ||
    current?.headline ||
    today?.headline ||
    "";

  const subHeadline =
    trend > 5
      ? "Improving through the afternoon"
      : trend < -5
      ? "Slightly less comfortable later"
      : "";

  let bullets = extractBullets(narrativeText, {
    trend,
    snapshot,
    label: "today"
  });

  if (!bullets.length) {
    bullets = [
      ...(current?.bullets || []),
      ...(today?.bullets || [])
    ];
  }

  bullets = [...new Set(bullets)];

  if (bullets.length < 2) {
    if (trend > 5) bullets.push("Improves as the day goes on");
    if (trend < -5) bullets.push("Slight drop in comfort later");

    if (snapshot.dewPoint != null && snapshot.dewPoint < 55) {
      bullets.push("Dry air keeps things comfortable");
    }

    if (snapshot.wind > 8) {
      bullets.push("Light breeze adds movement");
    }
  }

  bullets = bullets.slice(0, 3);

  return {
    label: "today",
    score,
    emoji: pickEmoji(score),
    headline,
    subHeadline,
    bullets
  };
}

// ============================================================
// INTEL BUILDER
// ============================================================

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

// ============================================================
// COMFORT MAP
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

// ============================================================
// SNAPSHOT
// ============================================================

function buildSnapshot(hours) {
  const avg = (keys) => {
    const vals = hours
      .map(h => keys.find(k => typeof h[k] === "number") ? h[keys.find(k => typeof h[k] === "number")] : null)
      .filter(v => v != null);

    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return {
    temp: avg(["temp", "temperature", "temperatureF"]),
    dewPoint: avg(["dewPoint", "dewpoint", "dewpointF"]),
    wind: avg(["wind", "windSpeed", "windspeed", "wind_speed"]) ?? 0
  };
}

// ============================================================
// TEXT SYSTEM
// ============================================================

function buildHeadline(score, snapshot) {
  const options = [
    "Comfortable overall",
    "Pleasant conditions",
    "Easy to be outside",
    "Mild and manageable"
  ];

  if (score >= 70) {
    return options[Math.floor(Math.random() * options.length)];
  }

  return "Mixed comfort conditions";
}

function buildBullets(snapshot, trend) {
  const bullets = [];

  if (trend > 5) bullets.push("Improves as the day goes on");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  if (snapshot.dewPoint < 55) {
    bullets.push("Dry air keeps things comfortable");
  }

  return bullets;
}

// ============================================================
// HELPERS
// ============================================================

function extractHeadline(text = "") {
  return text.split(".")[0]?.trim() || "";
}

function extractBullets(text = "", { trend, snapshot, label }) {
  const bullets = [];
  const t = text.toLowerCase();

  if (t.includes("dry")) bullets.push("Dry air keeps things feeling good");
  if (t.includes("breeze") || t.includes("wind")) bullets.push("Light breeze adds some movement");
  if (t.includes("stable")) bullets.push("Conditions stay steady overall");
  if (t.includes("cool") && label === "tomorrow") bullets.push("Cooler air settles in");

  if (trend > 5) bullets.push("Improves through the day");
  if (trend < -5) bullets.push("Slight drop in comfort later");

  if (bullets.length < 2 && snapshot.dewPoint < 55) {
    bullets.push("Low humidity keeps it comfortable");
  }

  return [...new Set(bullets)];
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