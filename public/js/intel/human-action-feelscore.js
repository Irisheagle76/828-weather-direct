/// ============================================================
// HUMAN ACTION — FEELSCORE VERSION (FIXED)
// ============================================================

import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { calculateComfort } from "./comfort.js";

export function buildHumanActionIntelFS(raw) {
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

  const todayComfort = mapComfortFS(todayHours);
  const tomorrowComfort = mapComfortFS(tomorrowHours);

  const similar = areSimilarDays(todayComfort, tomorrowComfort);

  return {
    today: buildPeriodFS(todayHours, todayComfort, "today", { similar }),
    tomorrow: buildPeriodFS(tomorrowHours, tomorrowComfort, "tomorrow", { similar })
  };
}


// ============================================================
// PERIOD (PEAK-WEIGHTED)
// ============================================================

function buildPeriodFS(hours, hourlyComfort, label, context) {
  if (!hours.length) return fallback(label);

  const daytime = hourlyComfort.filter(h => h.hour >= 8 && h.hour <= 20);
  const midday  = hourlyComfort.filter(h => h.hour >= 11 && h.hour <= 17);

  const base = daytime.length ? daytime : hourlyComfort;
  const peak = midday.length ? midday : base;

  let best = null;
  let worst = null;

  for (let i = 0; i < base.length - 2; i++) {
    const slice = base.slice(i, i + 3);
    const s = avg(slice);

    if (!best || s > best.score) best = { score: s, start: slice[0].hour };
    if (!worst || s < worst.score) worst = { score: s, start: slice[0].hour };
  }

  const avgPeak = avg(peak);
  const avgBase = avg(base);

  let score =
    avgPeak * 0.6 +
    avgBase * 0.25 +
    (best?.score ?? avgPeak) * 0.1 +
    (worst?.score ?? avgPeak) * 0.05;

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
// COMFORT MAPPING
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
// HEADLINE (REAL FIX)
// ============================================================

function buildHeadlineFS(score, label, snapshot, context) {
  const temp = snapshot?.temp ?? 70;
  const dp = snapshot?.dewPoint ?? 55;

  const dry = dp < 55;
  const warm = temp >= 70 && temp <= 85;

  if (dry && warm) {
    return label === "tomorrow" && context.similar
      ? "More of the same — comfortable from start to finish"
      : "Comfortable all day with crisp, dry air";
  }

  if (score >= 80) return "Comfortable overall";
  if (score >= 65) return "Mostly comfortable with some variation";

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