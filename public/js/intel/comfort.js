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

function computeTemperaturePenalty(temp) {
  if (temp == null) return 0.5;

  if (temp >= 65 && temp <= 75) return 0;
  if (temp >= 50) return (65 - temp) / 40;
  if (temp < 50) return clamp((50 - temp) / 25, 0, 1);
  if (temp > 75) return clamp((temp - 75) / 20, 0, 1);

  return 0;
}

function computeDewPenalty(dew) {
  if (dew == null) return 0.2;

  if (dew < 45) return 0.05;
  if (dew < 55) return 0.02;
  if (dew < 60) return 0.08;
  if (dew < 65) return 0.2;
  if (dew < 70) return 0.4;

  return 0.7;
}

function computeWindPenalty(wind) {
  if (!Number.isFinite(wind)) return 0;

  if (wind < 5) return 0;
  if (wind < 12) return 0.05;
  if (wind < 20) return 0.15;

  return 0.3;
}

function computeSolarBonus(temp, elev) {
  if (elev > 20 && temp < 75) return 0.15;
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
  return Math.max(score, 10);
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

export function computeComfort(hour) {
  const temp = num(hour.temperatureF ?? hour.temp);

  const humidity =
    num(hour.relative_humidity) ??
    num(hour.humidity);

  // 🔥 Magnus fallback (only used if dew missing)
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

  const dew =
    num(hour.dewpointF ?? hour.dewPoint) ??
    estimateDewPoint(temp, humidity);

  const wind =
    num(hour.wind_speed ?? hour.windSpeed) ?? 0;

  const timestamp = normalizeTimestamp(hour.timestamp);
  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);

  // 🚫 Only fail if temp is missing (dew now guaranteed fallback)
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

  const score = computeComfortScore(temp, dew, wind, elev);

  return {
    comfortScore: score,
    category: getCategory(score),
    emoji: getEmoji(score),
    color: getComfortColor(score),
    temp,
    dewpoint: dew,
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