// ============================================================
// HUMAN ACTION — FEELSCORE (CLEAN + ALIGNED)
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

  const today = hourly.filter(h => h.ts >= now && h.ts < now + 24 * 3600e3);
  const tomorrow = hourly.filter(h => h.ts >= now + 24 * 3600e3 && h.ts < now + 48 * 3600e3);

  const todayMapped = mapComfort(today);
  const tomorrowMapped = mapComfort(tomorrow);

  const similar = areSimilarDays(todayMapped, tomorrowMapped);

  return {
    today: buildPeriod(today, todayMapped, "today", { similar }),
    tomorrow: buildPeriod(tomorrow, tomorrowMapped, "tomorrow", { similar })
  };
}

// ============================================================
// PERIOD
// ============================================================

function buildPeriod(hours, mapped, label, context) {
  if (!hours.length) return fallback(label);

  // 1–4 PM focus
  const window = mapped.filter(h => h.hour >= 13 && h.hour <= 16);
  const base = window.length ? window : mapped;

  const scores = base.map(h => h.score);

  const avg = average(scores);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const trend = scores.at(-1) - scores[0];

  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);

  const intel = {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint,
      wind: snapshot.wind
    },
    pattern: { trend, min, max, avg: score },
    context: {
      label,
      similar: context?.similar,
      timeWindow: "afternoon"
    },
    dominantFactor: detectDominantFactor(snapshot)
  };

  const narrative = assembleWithVoice(
    intel,
    label,
    mapScoreToCategory(score),
    score >= 85
  );

  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline:
      narrative?.headline ||
      buildHeadline(score, label, snapshot, { trend }),
    bullets:
      (narrative?.bullets?.length
        ? narrative.bullets
        : buildBullets({ score, snapshot, trend, label })
      ).slice(0, 3)
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
      score: Math.round((c?.score || 0) * 10) // 0–100
    };
  });
}

// ============================================================
// SNAPSHOT (no legacy guessing)
// ============================================================

function buildSnapshot(hours) {
  const avg = (key) => {
    const vals = hours.map(h => h[key]).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return {
    temp: avg("temp"),
    dewPoint: avg("dewPoint"),
    wind: avg("wind")
  };
}

// ============================================================
// HEADLINE + BULLETS
// ============================================================

function buildHeadline(score, label, snapshot, { trend }) {
  const temp = snapshot.temp ?? 70;
  const dp = snapshot.dewPoint ?? 55;

  if (dp < 55 && temp >= 70 && temp <= 85) {
    return label === "tomorrow"
      ? "More of the same — comfortable throughout"
      : "Comfortable with dry, crisp air";
  }

  if (score >= 85) return "Feels really nice out";
  if (score >= 70) return "Comfortable overall";
  if (score >= 55) return "A bit uneven at times";

  return "Mixed comfort conditions";
}

function buildBullets({ snapshot, trend }) {
  const bullets = [];

  if (trend < -5) bullets.push("Slightly less comfortable later");
  if (trend > 5) bullets.push("Improves as the day goes on");

  if (snapshot.dewPoint < 55) {
    bullets.push("Dry air keeps things comfortable");
  }

  return bullets;
}

// ============================================================
// HELPERS
// ============================================================

function average(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function pickEmoji(score) {
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  return "😐";
}

function areSimilarDays(a, b) {
  if (!a.length || !b.length) return false;
  return Math.abs(average(a.map(h => h.score)) - average(b.map(h => h.score))) <= 5;
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
    today: fallback("today"),
    tomorrow: fallback("tomorrow")
  };
}

function detectDominantFactor(s) {
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