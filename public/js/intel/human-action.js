// ============================================================
// HUMAN ACTION + NARRATIVE ENGINE — v3 (UNIFIED VOICE)
// - Today + Tomorrow builder
// - Keeps scoring + windows
// - Upgrades language to human narrative
// - UI-ready output
// ============================================================

import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { calculateComfort } from "../intel/comfort.js";
import { buildHumanVoice } from "../intel/human-voice.js";


// ============================================================
// MAIN ENTRY
// ============================================================

export function buildHumanActionIntel(raw) {
  const hourly = normalizeOpenMeteo(raw?.hourly);

  if (!hourly.length) {
    return {
      today: fallback("today"),
      tomorrow: fallback("tomorrow")
    };
  }

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
        start: slice[0].hour,
        end: slice[2].hour
      };
    }

    if (!worst || score < worst.score) {
      worst = {
        score: Math.round(score),
        start: slice[0].hour,
        end: slice[2].hour
      };
    }
  }

  // ----------------------------------------------------------
  // NOW (TODAY ONLY)
  // ----------------------------------------------------------
  let nowBlock = null;

  if (label === "today") {
    const current = hourlyComfort.find(h => h.ts >= now);

    if (current) {
      nowBlock = {
        score: current.score,
        temp: current.temp,
        dew: current.dew
      };
    }
  }

  // ----------------------------------------------------------
  // SCORE
  // ----------------------------------------------------------
  const avgAll = avg(hourlyComfort);

  let score;

  if (label === "today") {
    score =
      (nowBlock?.score ?? avgAll) * 0.4 +
      avgAll * 0.4 +
      (best?.score ?? avgAll) * 0.2;
  } else {
    score =
      avgAll * 0.6 +
      (best?.score ?? avgAll) * 0.3 -
      (100 - (worst?.score ?? avgAll)) * 0.1;
  }

  score = Math.round(score);

  // ----------------------------------------------------------
  // SIGNAL BLEND (for voice)
  // ----------------------------------------------------------
  const snapshot = blend(hours);

  const voice = buildHumanVoice(
    {
      temp: snapshot.temp,
      dewPoint: snapshot.dewPoint,
      windSpeed: snapshot.windSpeed
    },
    detectDominant(snapshot)
  );

  // ----------------------------------------------------------
  // HEADLINE (human, not robotic)
  // ----------------------------------------------------------
  const headline = buildHeadline(score, voice, label);

  // ----------------------------------------------------------
  // BULLETS (THIS IS THE BIG UPGRADE)
  // ----------------------------------------------------------
  const bullets = buildNarrativeBullets({
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
    bullets,

    bestWindow: best,
    worstWindow: worst,
    now: nowBlock,

    summary: voice.summary,
    detail: voice.detail,

    snapshot
  };
}


// ============================================================
// HUMAN BULLETS (CORE UPGRADE)
// ============================================================

function buildNarrativeBullets({ best, worst, score, snapshot, label }) {
  const bullets = [];

  // Best window → human
  if (best) {
    bullets.push(
      label === "today"
        ? `Best stretch comes ${timeWord(best.start)}`
        : `Most comfortable stretch ${timeWord(best.start)}`
    );
  }

  // Worst window → human
  if (worst) {
    bullets.push(
      score >= 70
        ? `Only minor dips ${timeWord(worst.start)}`
        : `Rougher stretch ${timeWord(worst.start)}`
    );
  }

  // Atmosphere insight
  if (snapshot.dewPoint < 55) {
    bullets.push("Dry air keeps things crisp");
  } else if (snapshot.dewPoint > 65) {
    bullets.push("Humidity adds a heavier feel");
  }

  // Wind insight
  if (snapshot.windSpeed > 12) {
    bullets.push("Breezes noticeable at times");
  }

  return bullets.slice(0, 3);
}


// ============================================================
// HEADLINE BUILDER
// ============================================================

function buildHeadline(score, voice, label) {
  if (score >= 85) {
    return label === "today"
      ? "Comfortable all day with easy conditions"
      : "Another comfortable day ahead";
  }

  if (score >= 70) {
    return "Mostly comfortable with minor changes";
  }

  if (score >= 55) {
    return "Mixed comfort through the day";
  }

  return "Conditions feel more challenging overall";
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

function detectDominant(s) {
  if (s.dewPoint > 65) return "humidity";
  if (s.temp > 88) return "heat";
  if (s.temp < 45) return "cold";
  if (s.windSpeed > 15) return "wind";
  return "stable";
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