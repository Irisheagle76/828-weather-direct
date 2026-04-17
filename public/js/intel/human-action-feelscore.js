// ============================================================
// HUMAN ACTION — FEELSCORE (STABLE + HARDENED)
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
    today: buildPeriod(todayHours, "today"),
    tomorrow: buildPeriod(tomorrowHours, "tomorrow")
  };
}

// ============================================================
// PERIOD
// ============================================================

function buildPeriod(hours, label) {
  if (!Array.isArray(hours) || !hours.length) return fallback(label);

  const mapped = mapComfort(hours);

  // Afternoon bias
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

  // 🚨 HARD STOP — no valid temp → no voice
  if (typeof snapshot.temp !== "number") {
    console.warn("⚠️ Invalid snapshot", snapshot);
    return fallback(label);
  }

  const intel = buildIntel(snapshot, score, trend, min, max, label);

  // 🚨 FINAL GUARD
  if (typeof intel.signals.temp !== "number") {
    console.warn("⚠️ Invalid intel", intel);
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
      buildHeadline(score, snapshot),
    bullets:
      (narrative?.bullets?.length
        ? narrative.bullets
        : buildBullets(snapshot, trend)
      ).slice(0, 3)
  };
}

// ============================================================
// INTEL BUILDER (NEW — CONSISTENT SHAPE)
// ============================================================

function buildIntel(snapshot, score, trend, min, max, label) {
  return {
    signals: {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint ?? null,
      wind: snapshot.wind ?? 0
    },
    pattern: {
      trend,
      min,
      max,
      avg: score
    },
    context: {
      label,
      timeWindow: "afternoon"
    },
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
// SNAPSHOT (STRICT)
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
    temp: typeof temp === "number" ? temp : null,
    dewPoint: typeof dewPoint === "number" ? dewPoint : null,
    wind: typeof wind === "number" ? wind : 0
  };
}

// ============================================================
// TEXT SYSTEM
// ============================================================

function buildHeadline(score, snapshot) {
  const temp = snapshot.temp ?? 70;
  const dp = snapshot.dewPoint ?? 55;

  if (dp < 55 && temp >= 70 && temp <= 85) {
    return "Comfortable with dry, crisp air";
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