// /js/intel/comfort.js

import { LOCATION } from "/js/config/location.js";

// ============================================================
// UTILITIES
// ============================================================

function clamp(val, min, max) {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTimestamp(ts) {
  if (!ts) return Date.now();
  return ts < 1e12 ? ts * 1000 : ts;
}

// ============================================================
// SOLAR
// ============================================================

function computeSolarElevation(timestamp, lat, lon) {
  const date = new Date(timestamp);
  const rad = Math.PI / 180;

  const day = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / 86400000
  );

  const decl =
    23.45 * rad *
    Math.sin(rad * ((360 / 365) * (day - 81)));

  const time = date.getHours() + date.getMinutes() / 60;
  const solarTime = time + (lon / 15);

  const hourAngle = rad * (15 * (solarTime - 12));
  const latRad = lat * rad;

  const elevation =
    Math.asin(
      Math.sin(latRad) * Math.sin(decl) +
      Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
    );

  return elevation * (180 / Math.PI);
}

// ============================================================
// PENALTIES
// ============================================================

// ============================================================
// TEMPERATURE PENALTY — Asheville realistic
// ============================================================

function computeTemperaturePenalty(temp) {
  if (temp == null) return 0.5;

  // Goldilocks
  if (temp >= 65 && temp <= 75) return 0;

  // Cool discomfort
  if (temp < 65 && temp >= 50) return (65 - temp) / 40;
  if (temp < 50) return clamp((50 - temp) / 25, 0, 1);

  // --- Asheville heat discomfort (new curve) ---

  // 75–82°F → gentle ramp
  if (temp > 75 && temp < 82) {
    return (temp - 75) / 17; // 0 → ~0.5
  }

  // 82–86°F → sharper discomfort
  if (temp >= 82 && temp < 86) {
    return 0.5 + (temp - 82) * 0.12; // 0.5 → ~1.0
  }

  // 86°F+ → near-max penalty
  if (temp >= 86) {
    return clamp(0.98 + (temp - 86) * 0.05, 0, 1);
  }

  return 0;
}

// ============================================================
// DEWPOINT PENALTY — Asheville realistic (lower threshold)
// ============================================================

function computeDewPenalty(dew) {
  if (dew == null) return 0.2;

  // Crisp & dry
  if (dew < 45) return 0.05;
  if (dew < 55) return 0.10;

  // Noticeable humidity
  if (dew < 60) return 0.25;

  // Muggy
  if (dew < 65) return 0.45;

  // 🔥 Asheville harsh humidity starts here
  if (dew < 70) return 0.70;

  // Oppressive
  return 0.90;
}

function computeWindPenalty(wind) {
  if (!Number.isFinite(wind)) return 0;

  if (wind < 5) return 0;
  if (wind < 12) return 0.05;
  if (wind < 20) return 0.15;

  return 0.3;
}

function computeSolarBonus(temp, elev) {
  if (elev > 20 && temp < 75) return 0.12;
  return 0;
}

// ============================================================
// SCORE
// ============================================================

function computeComfortScore(temp, dew, wind, elev) {
  if (temp == null || dew == null) return null;

  const t = computeTemperaturePenalty(temp);
  const d = computeDewPenalty(dew);
  const w = computeWindPenalty(wind);
  const s = computeSolarBonus(temp, elev);

  const raw =
    (t * 0.5) +
    (d * 0.7) +
    w -
    s;

  const score = Math.round(clamp(100 - raw * 100, 0, 100));
  return clamp(score, 20, 98);
}

// ============================================================
// CATEGORY
// ============================================================

function getCategory(score) {
  if (score >= 75) return "Comfortable";
  if (score >= 60) return "Slightly Uncomfortable";
  if (score >= 40) return "Uncomfortable";
  return "Harsh";
}

function getEmoji(score) {
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  if (score >= 50) return "😐";
  if (score >= 35) return "😕";
  return "🥵";
}

export function getComfortColor(score) {
  if (score >= 80) return "#4f7cff";
  if (score >= 65) return "#2ec4b6";
  if (score >= 45) return "#ff9f1c";
  return "#e63946";
}

// ============================================================
// CORE ENGINE (FIXED)
// ============================================================

function computeComfort(hour) {
  // ------------------------------------------------------------
  // NORMALIZED INPUT (SAFE — DOES NOT BREAK OLD APP)
  // ------------------------------------------------------------
  const temp = num(hour.temperatureF ?? hour.temp);

  const humidity =
    num(hour.relative_humidity) ??
    num(hour.humidity);

  const dew =
    num(hour.dewpointF ?? hour.dewPoint);

  const wind =
    num(hour.wind ?? hour.windSpeed ?? hour.wind_speed) ?? 0;

  const timestamp = normalizeTimestamp(
    hour.ts ?? hour.timestamp
  );

  // ------------------------------------------------------------
  // DEW FALLBACK (unchanged logic)
  // ------------------------------------------------------------
  const estimateDewPoint = (tempF, rh) => {
    if (tempF == null || rh == null) return null;

    const T = (tempF - 32) * 5 / 9;
    const a = 17.625;
    const b = 243.04;

    const alpha =
      Math.log(rh / 100) +
      (a * T) / (b + T);

    const dewC = (b * alpha) / (a - alpha);
    return (dewC * 9 / 5) + 32;
  };

  const finalDew =
    dew ?? estimateDewPoint(temp, humidity);

  // ------------------------------------------------------------
  // FAIL SAFE
  // ------------------------------------------------------------
  if (temp == null) {
    console.warn("⚠️ Missing temperature", { hour });

    return {
      comfortScore: 50,
      category: "Unknown",
      emoji: "❓",
      color: "#888",
      temp: null,
      dewpoint: null,
      windSpeed: wind
    };
  }

  const elev = computeSolarElevation(
    timestamp,
    LOCATION.lat,
    LOCATION.lon
  );

  const score = computeComfortScore(
    temp,
    finalDew,
    wind,
    elev
  );

  return {
    comfortScore: score,
    category: getCategory(score),
    emoji: getEmoji(score),
    color: getComfortColor(score),

    temp,
    dewpoint: finalDew,
    windSpeed: wind
  };
}

// ============================================================
// AFTERNOON WINDOW ANALYSIS (NEW)
// ============================================================

export function analyzeAfternoonWindow(hours) {
  const window = hours.filter(h => {
    const hr = new Date(h.timestamp).getHours();
    return hr >= 13 && hr <= 16;
  });

  const scored = window.map(h => {
    const c = computeComfort(h);

    console.log("🧪 WINDOW HOUR", {
      time: new Date(h.timestamp).toLocaleTimeString(),
      temp: h.temperatureF,
      dew: h.dewpointF,
      score: c.comfortScore
    });

    return c;
  });

  const scores = scored.map(s => s.comfortScore);

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const trend = scores[scores.length - 1] - scores[0];

  console.log("📊 WINDOW SUMMARY", { avg, min, max, trend });

  return {
    avgScore: avg,
    minScore: min,
    maxScore: max,
    trend,
    hours: scored
  };
}

// ============================================================
// MODERN INTERFACE
// ============================================================

export function calculateComfort(hour) {
  const result = computeComfort(hour);
  if (!result) return null;

  return {
    score: result.comfortScore / 10,
    label: result.category,
    color: result.color,

    temp: result.temp,
    dewPoint: result.dewpoint,

    flags: {
      veryHot: result.temp >= 85,
      veryHumid: result.dewpoint >= 65,
      crisp: result.dewpoint < 55,
      windy: result.windSpeed >= 10
    },

    goldilocks:
      result.temp >= 65 &&
      result.temp <= 75 &&
      result.dewpoint >= 50 &&
      result.dewpoint <= 60 &&
      result.windSpeed < 12
  };
}
