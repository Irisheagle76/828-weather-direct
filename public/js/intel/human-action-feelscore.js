// ============================================================
// HUMAN ACTION — FEELSCORE (STABLE + SIMPLIFIED)
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

  const todayMapped = mapComfort(todayHours);
  const tomorrowMapped = mapComfort(tomorrowHours);

  const similar = areSimilarDays(todayMapped, tomorrowMapped);

  return {
    today: buildPeriod(todayHours, todayMapped, "today", { similar }),
    tomorrow: buildPeriod(tomorrowHours, tomorrowMapped, "tomorrow", { similar })
  };
}

// ============================================================
// PERIOD
// ============================================================

function buildPeriod(hours, mapped, label, context) {
  if (!hours.length) return fallback(label);

  // focus window (afternoon bias)
  const window = mapped.filter(h => h.hour >= 13 && h.hour <= 16);
  const base = window.length ? window : mapped;

  const scores = base
    .map(h => h.score)
    .filter(s => typeof s === "number");

  if (!scores.length) return fallback(label);

  const avg = average(scores);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const trend = scores.at(-1) - scores[0];

  const score = Math.round(avg);

  const snapshot = buildSnapshot(hours);

  // ------------------------------------------------------------
  // HARD GUARD (no valid signal → no voice)
  // ------------------------------------------------------------
  if (!snapshot || typeof snapshot.temp !== "number") {
    console.warn("⚠️ Snapshot invalid", snapshot);
    return fallback(label);
  }

  const intel = {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint ?? null,
      wind: snapshot.wind ?? 0
    },
    pattern: { trend, min, max, avg: score },
    context: {
      label,
      similar: context?.similar,
      timeWindow: "afternoon"
    },
    dominantFactor: detectDominantFactor(snapshot)
  };

  // ------------------------------------------------------------
  // FINAL GUARD
  // ------------------------------------------------------------
  if (typeof intel.signals.temp !== "number") {
    console.warn("⚠️ Invalid signals", intel);
    return fallback(label);
  }

  let narrative = null;

  try {
    narrative = assembleWithVoice(
      intel,
      label,
      mapScoreToCategory(score),
      score >= 85
    );
  } catch (err) {
    console.warn("⚠️ Voice failed", err, intel);
    return fallback(label);
  }

  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline:
      narrative?.headline ||
      buildHeadline(score, label, snapshot),
    bullets:
      (narrative?.bullets?.length
        ? narrative.bullets
        : buildBullets(snapshot, trend)
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
      score: Math.round((c?.score || 0) * 10)
    };
  });
}

// ============================================================
// SNAPSHOT (resilient)
// ============================================================

function buildSnapshot(hours) {
  const avg = (keys) => {
    const vals = hours
      .map(h => {
        for (const k of keys) {
          if (typeof h[k] === "number") return h[k];
        }
        return null;
      })
      .filter(v => v != null);

    return vals.length
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  };

  const temp = avg(["temp", "temperature", "temperatureF"]);
  const dewPoint = avg(["dewPoint", "dewpoint", "dewpointF"]);
  const wind = avg(["wind", "windSpeed", "windspeed", "wind_speed"]);

  return {
    temp,
    dewPoint,
    wind: wind ?? 0
  };
}

// ============================================================
// HEADLINE + BULLETS
// ============================================================

function buildHeadline(score, label, snapshot) {
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

function buildBullets(snapshot, trend) {
  const bullets = [];

  if (trend < -5) bullets.push("Slightly less comfortable later");
  if (trend > 5) bullets.push("Improves as the day goes on");

  if (snapshot.dewPoint != null && snapshot.dewPoint < 55) {
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