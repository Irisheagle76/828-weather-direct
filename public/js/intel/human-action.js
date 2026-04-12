// ============================================================
// HUMAN ACTION ENGINE — v3 (DOMINANT EXPERIENCE MODEL)
// - Fixes scoring mismatch
// - Human language (not robotic)
// - Today vs Tomorrow differentiation
// - UI-ready output
// ============================================================

import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { calculateComfort } from "./comfort.js";


// ============================================================
// MAIN ENTRY
// ============================================================

export function buildHumanActionIntel(raw) {
  const hourly = normalizeOpenMeteo(raw?.hourly);
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

  return {
    today: buildPeriod(todayHours, "today", now),
    tomorrow: buildPeriod(tomorrowHours, "tomorrow", now)
  };
}


// ============================================================
// PERIOD BUILDER
// ============================================================

function buildPeriod(hours, label, now) {
  if (!hours?.length) return fallback(label);

  // ----------------------------------------------------------
  // HOURLY COMFORT
  // ----------------------------------------------------------
  const hourlyComfort = hours.map(h => {
    const c = calculateComfort({
      temp: h.temperatureF,
      dewpointF: h.dewpointF,
      windSpeed: h.wind_speed,
      obsTimeLocal: h.timestamp
    });

    return {
      ts: h.timestamp,
      hour: new Date(h.timestamp).getHours(),
      score: Math.round((c?.score ?? 5) * 10),
      temp: h.temperatureF,
      dew: h.dewpointF,
      wind: h.wind_speed
    };
  });

  // ----------------------------------------------------------
  // BEST / WORST WINDOWS (3-hour blocks)
  // ----------------------------------------------------------
  let best = null;
  let worst = null;

  for (let i = 0; i < hourlyComfort.length - 2; i++) {
    const slice = hourlyComfort.slice(i, i + 3);
    const score = avg(slice);

    if (!best || score > best.score) {
      best = {
        score: Math.round(score),
        start: slice[0].hour
      };
    }

    if (!worst || score < worst.score) {
      worst = {
        score: Math.round(score),
        start: slice[0].hour
      };
    }
  }

  // ----------------------------------------------------------
  // SCORE (FIXED — DOMINANT EXPERIENCE)
  // ----------------------------------------------------------
  const avgAll = avg(hourlyComfort);

  let score =
    avgAll * 0.65 +
    (best?.score ?? avgAll) * 0.25 +
    (worst?.score ?? avgAll) * 0.10;

  score = Math.round(score);

  // ----------------------------------------------------------
  // SNAPSHOT
  // ----------------------------------------------------------
  const snapshot = blend(hours);

  // ----------------------------------------------------------
  // HEADLINE
  // ----------------------------------------------------------
  const headline = buildHeadline(score, label, snapshot);

  // ----------------------------------------------------------
  // BULLETS (HUMANIZED)
  // ----------------------------------------------------------
  const bullets = buildBullets({
    best,
    worst,
    score,
    snapshot,
    label
  });

  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline,
    bullets
  };
}


// ============================================================
// HEADLINE (FIXED LOGIC)
// ============================================================

function buildHeadline(score, label, snapshot) {
  const dp = snapshot?.dewPoint ?? 55;

  if (score >= 85) {
    if (dp < 55) {
      return label === "today"
        ? "Comfortable all day with crisp, dry air"
        : "Another crisp and comfortable day ahead";
    }

    return label === "today"
      ? "Comfortable all day with easy conditions"
      : "Another comfortable day ahead";
  }

  if (score >= 75) return "Mostly comfortable with minor changes";
  if (score >= 65) return "Comfortable overall with a few dips";
  if (score >= 55) return "Mixed comfort through the day";

  return "Conditions feel more challenging overall";
}


// ============================================================
// BULLETS (HUMAN VOICE)
// ============================================================

function buildBullets({ best, worst, score, snapshot, label }) {
  const bullets = [];

  // Best window
  if (best) {
    bullets.push(
      label === "today"
        ? `Best stretch comes ${timeWord(best.start)}`
        : `Most comfortable stretch ${timeWord(best.start)}`
    );
  }

  // Worst window (tone-aware)
  if (worst) {
    if (score >= 80) {
      bullets.push(`Only slight dips ${timeWord(worst.start)}`);
    } else if (score >= 65) {
      bullets.push(`A few less comfortable moments ${timeWord(worst.start)}`);
    } else {
      bullets.push(`Rougher stretch ${timeWord(worst.start)}`);
    }
  }

  // Air feel
  if (snapshot.dewPoint < 55) {
    bullets.push("Dry air keeps things crisp");
  } else if (snapshot.dewPoint > 65) {
    bullets.push("Humidity adds a heavier feel");
  }

  // Wind
  if (snapshot.windSpeed > 12) {
    bullets.push("Breezes noticeable at times");
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
  if (score >= 50) return "😐";
  return "😕";
}

function timeWord(hour) {
  if (hour < 9) return "early";
  if (hour < 12) return "late morning";
  if (hour < 16) return "afternoon";
  if (hour < 19) return "early evening";
  return "later on";
}


// ============================================================
// FALLBACK
// ============================================================

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