// ============================================================
// HUMAN ACTION ENGINE — v4 (PATTERN-AWARE + HUMAN-WEIGHTED)
// ============================================================

import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { calculateComfort } from "./comfort.js";


// ============================================================
// MAIN
// ============================================================

export function buildHumanActionIntel(raw) {
  const hourly = normalizeOpenMeteo(raw?.hourly);
  if (!hourly?.length) return fallbackAll();

  const now = Date.now();

  // ----------------------------------------------------------
  // SAFE TIME ACCESSOR
  // ----------------------------------------------------------
  const getTs = (h) => h.timestamp ?? h.time ?? null;

  // ----------------------------------------------------------
  // SPLIT INTO TODAY / TOMORROW
  // ----------------------------------------------------------
  const todayHours = hourly.filter(h => {
    const ts = getTs(h);
    if (!ts) return false;

    const diff = (ts - now) / 36e5;
    return diff >= 0 && diff < 24;
  });

  const tomorrowHours = hourly.filter(h => {
    const ts = getTs(h);
    if (!ts) return false;

    const diff = (ts - now) / 36e5;
    return diff >= 24 && diff < 48;
  });

  // ----------------------------------------------------------
  // FALLBACK GUARD (critical)
  // ----------------------------------------------------------
  if (!todayHours.length && !tomorrowHours.length) {
    console.warn("⚠️ No valid hourly timestamps found");
    return fallbackAll();
  }

  // ----------------------------------------------------------
  // COMFORT MAPPING
  // ----------------------------------------------------------
  const todayComfort = mapComfort(todayHours);
  const tomorrowComfort = mapComfort(tomorrowHours);

  // ----------------------------------------------------------
  // PATTERN DETECTION
  // ----------------------------------------------------------
  const similar = areSimilarDays(todayComfort, tomorrowComfort);

  // ----------------------------------------------------------
  // OUTPUT
  // ----------------------------------------------------------
  return {
    today: todayHours.length
      ? buildPeriod(todayHours, todayComfort, "today", { similar })
      : fallback("today"),

    tomorrow: tomorrowHours.length
      ? buildPeriod(tomorrowHours, tomorrowComfort, "tomorrow", { similar })
      : fallback("tomorrow")
  };
}


// ============================================================
// BUILD PERIOD
// ============================================================

function buildPeriod(hours, hourlyComfort, label, context) {
  if (!hours.length) return fallback(label);

  // ---------------------------
  // BEST / WORST
  // ---------------------------
  let best = null;
  let worst = null;

  for (let i = 0; i < hourlyComfort.length - 2; i++) {
    const slice = hourlyComfort.slice(i, i + 3);
    const score = avg(slice);

    if (!best || score > best.score) {
      best = { score, start: slice[0].hour };
    }

    if (!worst || score < worst.score) {
      worst = { score, start: slice[0].hour };
    }
  }

  // ---------------------------
  // HUMAN-WEIGHTED SCORE
  // ---------------------------
  const daytime = hourlyComfort.filter(h => h.hour >= 8 && h.hour <= 20);

  const avgDay = daytime.length ? avg(daytime) : avg(hourlyComfort);

  let score =
    avgDay * 0.7 +
    (best?.score ?? avgDay) * 0.2 +
    (worst?.score ?? avgDay) * 0.1;

  score = Math.round(score);

  // ---------------------------
  // SNAPSHOT
  // ---------------------------
  const snapshot = blend(hours);

  // ---------------------------
  // OUTPUT
  // ---------------------------
  return {
    label,
    score,
    emoji: pickEmoji(score),
    headline: buildHeadline(score, label, snapshot, context),
    bullets: buildBullets({ best, worst, score, snapshot, label, context })
  };
}


// ============================================================
// HEADLINE (PATTERN-AWARE)
// ============================================================

function buildHeadline(score, label, snapshot, context) {
  const dp = snapshot?.dewPoint ?? 55;

  if (score >= 85) {
    if (label === "tomorrow" && context.similar) {
      return "More of the same — comfortable from start to finish";
    }

    if (dp < 55) {
      return label === "today"
        ? "Comfortable all day with crisp, dry air"
        : "Another crisp and comfortable day ahead";
    }

    return label === "today"
      ? "Comfortable all day with easy conditions"
      : "Another comfortable day ahead";
  }

  if (score >= 80) return "Comfortable most of the day with minor variation";
  if (score >= 70) return "Mostly comfortable with a few dips";
  if (score >= 60) return "Mixed comfort through the day";

  return "Conditions feel more challenging overall";
}


// ============================================================
// BULLETS (DIFFERENTIATED)
// ============================================================

function buildBullets({ best, worst, score, snapshot, label, context }) {
  const bullets = [];

  // Best window
  if (best) {
    bullets.push(
      label === "today"
        ? `Best stretch comes ${timeWord(best.start)}`
        : context.similar
          ? `Another good window ${timeWord(best.start)}`
          : `Most comfortable stretch ${timeWord(best.start)}`
    );
  }

  // Worst window (tone scaled)
  if (worst) {
    if (score >= 85) {
      bullets.push(`Only slight dips ${timeWord(worst.start)}`);
    } else if (score >= 75) {
      bullets.push(`A brief dip ${timeWord(worst.start)}`);
    } else {
      bullets.push(`Rougher stretch ${timeWord(worst.start)}`);
    }
  }

  // Air feel
  if (snapshot.dewPoint < 55) {
    bullets.push(
      label === "tomorrow" && context.similar
        ? "Air stays dry and comfortable again"
        : "Dry air keeps things crisp"
    );
  }

  return bullets.slice(0, 3);
}


// ============================================================
// HELPERS
// ============================================================

function mapComfort(hours) {
  return hours.map(h => {
    const c = calculateComfort({
  temp: h.temp ?? h.temperatureF,
  dewPoint: h.dewPoint ?? h.dewpointF,
  windSpeed: h.wind ?? h.wind_speed,
  obsTimeLocal: h.timestamp
});

    return {
      hour: new Date(h.timestamp).getHours(),
      score: Math.round((c?.score ?? 5) * 10)
    };
  });
}

function areSimilarDays(today, tomorrow) {
  if (!today.length || !tomorrow.length) return false;

  const avg = arr => arr.reduce((a, h) => a + h.score, 0) / arr.length;

  return Math.abs(avg(today) - avg(tomorrow)) <= 5;
}

function avg(arr) {
  return arr.reduce((a, h) => a + h.score, 0) / arr.length;
}

function blend(hours) {
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

  return {
    temp: avg(["temperatureF", "temp"]),
    dewPoint: avg(["dewpointF", "dewPoint"]),
    windSpeed: avg(["wind_speed", "wind"])
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