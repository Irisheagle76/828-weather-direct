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
// CORE COMFORT MODEL (DEW-BASED)
// ============================================================

function computeTemperaturePenalty(temp) {
  if (temp == null) return 0.5;

  // GOLDILOCKS
  if (temp >= 65 && temp <= 75) return 0;

  // COOL (pleasant in mountains)
  if (temp >= 50) return (65 - temp) / 40;

  // COLD
  if (temp < 50) return clamp((50 - temp) / 25, 0, 1);

  // HOT (stronger penalty)
  if (temp > 75) return clamp((temp - 75) / 20, 0, 1);

  return 0;
}

function computeDewPenalty(dew) {
  if (dew == null) return 0.2;

  if (dew < 45) return 0.05;     // crisp
  if (dew < 55) return 0.02;     // 🔥 ideal
  if (dew < 60) return 0.08;
  if (dew < 65) return 0.2;
  if (dew < 70) return 0.4;

  return 0.7; // oppressive
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

  // prevent unrealistic 0s
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
// MAIN ENGINE (ROBUST VERSION)
// ============================================================

export function computeComfort(intel) {
 const src =
  intel?.tempest ??
  intel?.wu ??
  intel ?? {};   // 🔥 THIS IS THE FIX

  // ---------------------------
  // INPUT NORMALIZATION
  // ---------------------------
 const temp =
  num(src.temp) ??
  num(src.temperatureF);

const dew =
  num(src.dewpointF) ??
  num(src.dewPoint) ??
  (temp != null ? temp - 18 : null);

const wind =
  num(src.windSpeed) ??
  num(src.wind_speed) ??
  0;
  
  const timestamp = normalizeTimestamp(src.obsTimeLocal);

  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);

  // ---------------------------
  // VALIDATION (🔥 critical fix)
  // ---------------------------
  if (temp == null || dew == null) {
    console.warn("⚠️ Invalid comfort inputs", {
      temp,
      dew,
      wind,
      src
    });

    return {
      comfortScore: 50, // neutral fallback instead of 0
      category: "Unknown",
      emoji: "❓",
      color: "#888",

      temp: temp ?? null,
      dewpoint: dew ?? null,
      windSpeed: wind,

      headline: "Conditions unclear",
      narrative: null
    };
  }

  // ---------------------------
  // SCORE CALCULATION
  // ---------------------------
  const rawScore = computeComfortScore(temp, dew, wind, elev);

  const score =
    rawScore != null
      ? rawScore
      : 50; // fallback (prevents 0 bug)

  // ---------------------------
  // OUTPUT
  // ---------------------------
  return {
    comfortScore: score,
    category: getCategory(score),
    emoji: getEmoji(score),
    color: getComfortColor(score),

    temp,
    dewpoint: dew,
    windSpeed: wind,

    headline: buildHeadline(score, dew),
    narrative: buildNarrative(temp, dew, wind, elev)
  };
}

// ============================================================
// NARRATIVE
// ============================================================

function buildHeadline(score, dew) {
  if (score >= 80) return "Comfortable";
  if (score >= 65) return "Pleasant";
  if (score >= 50) return "Fair";
  if (score >= 35) return "Uncomfortable";
  return "Harsh";
}

function buildNarrative(temp, dew, wind, elev) {
  const parts = [];

  if (dew < 55) parts.push("Crisp mountain air");
  if (dew >= 65) parts.push("Sticky humidity");

  if (wind >= 12) parts.push("Noticeable breeze");
  if (elev > 40) parts.push("Strong sun");

  return parts.join(", ");
}

// ============================================================
// MODERN INTERFACE (YOUR APP USES THIS)
// ============================================================

export function calculateComfort(data, options = {}) {
  const result = computeComfort(data);
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
      windy: result.windSpeed >= 10,
      harshSun: false
    },

    goldilocks:
      result.temp >= 65 &&
      result.temp <= 75 &&
      result.dewpoint >= 50 &&
      result.dewpoint <= 60 &&
      result.windSpeed < 12
  };
}
