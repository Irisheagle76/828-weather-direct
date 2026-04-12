// ============================================================
// HUMAN ACTION — FEELSCORE VERSION (v1)
// - Uses canonical normalized data
// - Weights human-active hours
// - Fixes "false challenging" issue
// ============================================================

import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { calculateComfort } from "./comfort.js";

export function buildHumanActionIntelFS(raw) {
  const hourly = normalizeOpenMeteo(raw?.hourly);
  if (!hourly.length) return fallbackAll();

  const now = Date.now();

  // ----------------------------------------------------------
  // SPLIT DAYS (timestamp already correct)
  // ----------------------------------------------------------
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
// PERIOD (FEELSCORE LOGIC)
// ============================================================

function buildPeriodFS(hours, hourlyComfort, label, context) {
  if (!hours.length) return fallback(label);

  // ---------------------------
  // FOCUS ON HUMAN HOURS (key fix)
  // ---------------------------
  const active = hourlyComfort.filter(h => h.hour >= 8 && h.hour <= 20);

  const base = active.length ? active : hourlyComfort;

  // ---------------------------
  // BEST / WORST
  // ---------------------------
  let best = null;
  let worst = null;

  for (let i = 0; i < base.length - 2; i++) {
    const slice = base.slice(i, i + 3);
    const score = avg(slice);

    if (!best || score > best.score) {
      best = { score, start: slice[0].hour };
    }

    if (!worst || score < worst.score) {
      worst = { score, start: slice[0].hour };
    }
  }

  // ---------------------------
  // SCORE (clean + intuitive)
  // ---------------------------
  const avgBase = avg(base);

  let score =
    avgBase * 0.75 +
    (best?.score ?? avgBase) * 0.2 +
    (worst?.score ?? avgBase) * 0.05;

  score = Math.round(score);

  const snapshot = blend(hours);

  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline: buildHeadlineFS(score, label, snapshot, context),
    bullets: buildBulletsFS({ best, worst, score, snapshot, label, context })
  };
}


// ============================================================
// COMFORT MAPPING (fixed inputs)
// ============================================================

function mapComfortFS(hours) {
  return hours.map(h => {
    const c = calculateComfort({
      temp: h.temperatureF,
      dewPoint: h.dewpointF,
      windSpeed: h.wind_speed,
      obsTimeLocal: h.timestamp
    });

    return {
      hour: new Date(h.timestamp).getHours(),
      score: Math.round((c?.score ?? 5) * 10)
    };
  });
}


// ============================================================
// HEADLINE (aligned with FeelScore)
// ============================================================

function buildHeadlineFS(score, label, snapshot, context) {
  if (score >= 85) {
    return label === "tomorrow" && context.similar
      ? "More of the same — comfortable from start to finish"
      : "Comfortable all day with crisp, dry air";
  }

  if (score >= 75) return "Mostly comfortable with minor changes";
  if (score >= 65) return "Comfortable overall with a few dips";

  return "Mixed comfort through the day";
}


// ============================================================
// BULLETS
// ============================================================

function buildBulletsFS({ best, worst, score, snapshot, label, context }) {
  const bullets = [];

  if (best) {
    bullets.push(
      label === "today"
        ? `Best stretch comes ${timeWord(best.start)}`
        : `Another good window ${timeWord(best.start)}`
    );
  }

  if (worst && score < 85) {
    bullets.push(`A brief dip ${timeWord(worst.start)}`);
  }

  if (snapshot.dewPoint < 55) {
    bullets.push(
      label === "tomorrow"
        ? "Air stays dry and comfortable again"
        : "Dry air keeps things crisp"
    );
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
  const avg = key => {
    const vals = hours.map(h => h[key]).filter(v => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  return {
    temp: avg("temperatureF"),
    dewPoint: avg("dewpointF"),
    windSpeed: avg("wind_speed")
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