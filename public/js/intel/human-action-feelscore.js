/// ============================================================
// HUMAN ACTION — FEELSCORE VERSION (FIXED)
// ============================================================

import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { calculateComfort } from "./comfort.js";
import { assembleWithVoice } from "./synthesizer/assembleWithVoice.js";

export function buildHumanActionIntelFS(raw) {
  const hourly = raw?.hourly || [];
  if (!hourly.length) return fallbackAll();

  const now = Date.now();

  const todayHours = hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= 0 && diff < 24;
  });

  const tomorrowHours = hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= 24 && diff < 48;
  });

  const todayComfort = mapComfortFS(todayHours);
  const tomorrowComfort = mapComfortFS(tomorrowHours);

  const similar = areSimilarDays(todayComfort, tomorrowComfort);

  return {
    today: buildPeriodFS(todayHours, todayComfort, "today", { similar }),
    tomorrow: buildPeriodFS(tomorrowHours, tomorrowComfort, "tomorrow", { similar })
  };
}


// ============================================================
// PERIOD (New Window)
// ============================================================

function buildPeriodFS(hours, hourlyComfort, label, context) {
  if (!hours.length) return fallback(label);

  // ------------------------------------------------------------
  // 🕐 PRIMARY WINDOW: 1–4 PM
  // ------------------------------------------------------------
  const window = hourlyComfort.filter(h =>
    h.hour >= 13 && h.hour <= 16
  );

  const base = window.length ? window : hourlyComfort;

  // ------------------------------------------------------------
  // 📊 CORE METRICS
  // ------------------------------------------------------------
  const scores = base.map(h => h.score);

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  const trend = scores[scores.length - 1] - scores[0];

  const score = Math.round(avg);

  // ------------------------------------------------------------
  // 🌡 SNAPSHOT (for language)
  // ------------------------------------------------------------
  const snapshot = blend(hours);

  // ------------------------------------------------------------
  // 🧠 OUTPUT
  // ------------------------------------------------------------
// ------------------------------------------------------------
// 🧠 BUILD INTEL OBJECT
// ------------------------------------------------------------
const intel = {
  signals: {
    temp: snapshot.temp,
    dewPoint: snapshot.dewPoint,
    windSpeed: snapshot.windSpeed
  },

  pattern: {
    trend,
    min,
    max,
    avg: score
  },

  context: {
    label,
    similar: context?.similar,
    timeWindow: "afternoon"
  },

  dominantFactor: detectDominantFactor(snapshot)
};

// ------------------------------------------------------------
// 🎙 SYNTHESIS (PRIMARY)
// ------------------------------------------------------------
const narrative = assembleWithVoice(
  intel,
  label,
  mapScoreToCategory(score),
  score >= 85
);

// ------------------------------------------------------------
// 🛟 FALLBACK (SAFETY)
// ------------------------------------------------------------
// ------------------------------------------------------------
// 🛟 HYBRID OUTPUT (SYNTH + INTELLIGENT FALLBACK)
// ------------------------------------------------------------

// HEADLINE — synth first, fallback if needed
const headline =
  narrative?.headline ||
  buildHeadlineFS(score, label, snapshot, { trend, min, max });


// BULLETS — synth if present, otherwise structured fallback
const bullets = (
  narrative?.bullets?.length
    ? narrative.bullets
    : buildBulletsFS({
        score,
        snapshot,
        label,
        trend,
        min,
        max
      })
).slice(0, 3);

// ------------------------------------------------------------
// 🎯 OUTPUT
// ------------------------------------------------------------
return {
  label,
  score,
  emoji: pickEmoji(score, snapshot),
  headline,
  bullets
};
}

// ============================================================
// COMFORT MAPPING
// ============================================================

function mapComfortFS(hours) {
  return hours.map(h => {
    const c = calculateComfort(h);

    const score = Number.isFinite(c?.score)
      ? Math.round(c.score * 10)
      : 50;

    return {
      hour: new Date(h.timestamp).getHours(),
      score
    };
  });
}

// ============================================================
// HEADLINE (with new window data)
// ============================================================

function buildHeadlineFS(score, label, snapshot, context) {
  const temp = snapshot?.temp ?? 70;
  const dp = snapshot?.dewPoint ?? 55;

  const dry = dp < 55;
  const warm = temp >= 70 && temp <= 85;

  const trend = context?.trend ?? 0;

  // 🔥 Trend-aware logic
  if (dry && warm) {
    if (trend < -5) {
      return "Comfortable early, a bit more humid later";
    }

    return label === "tomorrow" && context?.similar
      ? "More of the same — comfortable from start to finish"
      : "Comfortable all day with crisp, dry air";
  }

 if (score >= 85) return "Feels really nice out there";
if (score >= 70) return "Comfortable with a few small shifts";
if (score >= 55) return "A bit uneven, but manageable";

  return "Mixed comfort through the day";
}

// ============================================================
// BULLETS
// ============================================================

function buildBulletsFS({ score, snapshot, label, trend, min, max }) {
  const bullets = [];

  if (trend < -5) {
    bullets.push("A little more humid as the afternoon goes on");
  } else if (trend > 5) {
    bullets.push("Conditions improve through the afternoon");
  }

  if (snapshot.dewPoint < 55) {
    bullets.push(
      label === "tomorrow"
        ? "Air stays dry and comfortable again"
        : "Dry air keeps things crisp"
    );
  }

  if (min < 70) {
    bullets.push("A brief dip in comfort at times");
  }

  return bullets.slice(0, 3);
}

// ============================================================
// HELPERS
// ============================================================

function avg(arr) {
  return arr.reduce((a, h) => a + h.score, 0) / arr.length;
}

function blend(hours) {
  const avgVal = (keys) => {
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

  return {
    temp: avgVal(["temperatureF", "temp"]),
    dewPoint: avgVal(["dewpointF", "dewPoint"]),
    windSpeed: avgVal(["wind_speed", "wind"])
  };
}

function pickEmoji(score) {
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  return "😐";
}

function timeWord(hour) {
  if (hour < 9) return "early";
  if (hour < 12) return "late morning";
  if (hour < 16) return "afternoon";
  return "evening";
}

function areSimilarDays(a, b) {
  if (!a.length || !b.length) return false;

  const avg = arr => arr.reduce((x, h) => x + h.score, 0) / arr.length;

  return Math.abs(avg(a) - avg(b)) <= 5;
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

function detectDominantFactor(snapshot) {
  const dp = snapshot?.dewPoint ?? 55;
  const temp = snapshot?.temp ?? 70;
  const wind = snapshot?.windSpeed ?? 0;

  if (dp >= 68) return "muggy";
  if (dp >= 60) return "humid";
if (dp < 50 && temp >= 65 && temp <= 80) return "mountain_air";

  if (temp >= 88) return "heat";
  if (temp <= 45) return "cold";

  if (wind >= 15) return "wind";

  return "comfortable";
}

function mapScoreToCategory(score) {
  if (score >= 88) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slightlyUncomfortable";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}