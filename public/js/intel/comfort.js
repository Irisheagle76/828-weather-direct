// /intel/comfort.js
// ============================================================
// COMFORT ENGINE — v4.0 FULL REWRITE (ROBUST + FEATURE COMPLETE)
// ============================================================

import { LOCATION } from "/js/config/location.js";

// ============================================================
// CONSTANTS
// ============================================================

const IDEAL_TEMP = 70;
const MAX_WIND_EFFECT = 25;

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
// SOLAR ENGINE
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
// HUMIDITY + DEW LOGIC
// ============================================================

function dewToRH(tempF, dewF) {
if (tempF == null || dewF == null) return null;

const t = (tempF - 32) * 5 / 9;
const d = (dewF - 32) * 5 / 9;

const rh =
100 *
(Math.exp((17.625 * d) / (243.04 + d)) /
Math.exp((17.625 * t) / (243.04 + t)));

return clamp(rh, 0, 100);
}

function ensureDew(temp, dew) {
if (dew != null) return dew;

if (temp != null) {
// fallback estimate
return temp - 18;
}

return null;
}

// ============================================================
// WIND CHILL / FEELS LIKE
// ============================================================

function computeWindChill(tempF, windMph) {
if (tempF == null) return null;
if (tempF > 50 || windMph < 3) return tempF;

return (
35.74 +
0.6215 * tempF -
35.75 * Math.pow(windMph, 0.16) +
0.4275 * tempF * Math.pow(windMph, 0.16)
);
}

// ============================================================
// SCORING ENGINE
// ============================================================

function computeTemperatureScore(temp) {
if (temp == null) return 1;
return Math.min(Math.abs(temp - IDEAL_TEMP) / 35, 1);
}

function computeHumidityPenalty(rh) {
if (rh == null) return 0.5;

if (rh < 25) return 1;
if (rh < 35) return 0.75;
if (rh < 45) return 0.5;
return 0.2;
}

function computeWindPenalty(wind, windDir) {
const w = Number.isFinite(wind) ? wind : 0;
let penalty = Math.min(w / MAX_WIND_EFFECT, 1) * 0.4;

if (String(windDir ?? "").includes("W")) {
penalty += 0.2;
}

return penalty;
}

function computeSolarBonus(temp, elev) {
if (elev > 20 && temp < 75) return 0.15;
return 0;
}

function computeComfortScore(temp, dew, wind, elev, windDir) {
if (temp == null || dew == null) return null;

const rh = dewToRH(temp, dew);
if (rh == null) return null;

const tScore = computeTemperatureScore(temp);
const humidityPenalty = computeHumidityPenalty(rh);
const windPenalty = computeWindPenalty(wind, windDir);
const solarBonus = computeSolarBonus(temp, elev);

const raw =
(tScore * 0.5) +
(humidityPenalty * 0.6) +
windPenalty -
solarBonus;

return Math.round(clamp(100 - raw * 100, 0, 100));
}

// ============================================================
// CATEGORY + VISUALS
// ============================================================

function getCategory(score) {
if (score >= 80) return "Comfortable";
if (score >= 65) return "Slightly Uncomfortable";
if (score >= 45) return "Uncomfortable";
return "Harsh";
}

export function getComfortColor(score) {
if (score >= 80) return "#4f7cff";
if (score >= 65) return "#2ec4b6";
if (score >= 45) return "#ff9f1c";
return "#e63946";
}

function getEmoji(category) {
return {
Comfortable: "🙂",
"Slightly Uncomfortable": "😐",
Uncomfortable: "😣",
Harsh: "🤯"
}[category] || "😐";
}

// ============================================================
// HUMAN NARRATIVE ENGINE
// ============================================================

function humidityPhrase(dew) {
if (dew == null) return null;
if (dew <= 40) return "dry air";
if (dew <= 55) return "comfortable humidity";
if (dew <= 65) return "slightly humid air";
if (dew <= 70) return "humid air";
return "very humid conditions";
}

function sunPhrase(elev) {
if (elev <= 0) return "nighttime calm";
if (elev < 10) return "low-angle sunlight";
if (elev < 30) return "morning sunlight";
if (elev < 60) return "daytime sunshine";
return "strong overhead sun";
}

function windPhrase(wind) {
if (wind >= 20) return "strong winds";
if (wind >= 12) return "noticeable breeze";
if (wind >= 6) return "light breeze";
return null;
}

function buildHeadline(category, dew) {
const phrase = humidityPhrase(dew);

if (!phrase) return `${category}.`;

if (category === "Comfortable") return `Comfortable with ${phrase}.`;
if (category === "Slightly Uncomfortable") return `Slightly uncomfortable with ${phrase}.`;
if (category === "Uncomfortable") return `Uncomfortable due to ${phrase}.`;
return `Harsh conditions with ${phrase}.`;
}

function buildNarrative(temp, dew, wind, elev) {
const parts = [];

const windText = windPhrase(wind);
if (windText) parts.push(windText);

const sunText = sunPhrase(elev);
if (sunText) parts.push(sunText);

return parts.length ? parts.join(", ") + "." : null;
}

// ============================================================
// MAIN ENGINE
// ============================================================

export function computeComfort(intel) {
  const src = intel?.tempest ?? intel?.wu ?? {};

  const temp = num(src.temp);
  const dew = ensureDew(temp, num(src.dewPoint));
  const wind = num(src.windSpeed) ?? 0;
  const windDir = src.windDir ?? "";
  const timestamp = normalizeTimestamp(src.obsTimeLocal);

  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const feelsLike = computeWindChill(temp, wind);

  const rawScore = computeComfortScore(temp, dew, wind, elev, windDir);
  const score = rawScore ?? 0;

  const category = getCategory(score);

  return {
    category,
    emoji: getEmoji(category),
    comfortScore: score,
    feelsLike,

    temp,
    dewpoint: dew,
    humidity: dewToRH(temp, dew),
    windSpeed: wind,

    color: getComfortColor(score),
    headline: buildHeadline(category, dew),
    narrative: buildNarrative(temp, dew, wind, elev),

    scoreExplainer:
      "Comfort Score blends temperature, humidity, wind, and sun angle into a 0–100 scale."
  };
}

// ============================================================
// FUTURE COMFORT
// ============================================================

export function buildFutureComfort(hourlyNormalized, computeComfortFn = computeComfort) {
  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length === 0) {
    return [];
  }

  const now = Date.now();

  const getTs = h =>
    h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp;

  let startIndex = hourlyNormalized.findIndex(h => getTs(h) >= now);

  if (startIndex === -1) {
    startIndex = hourlyNormalized.length - 1;
  }

  const items = [];

  for (let i = 0; i < 6; i++) {
    const idx = startIndex + i;
    if (idx >= hourlyNormalized.length) break;

    const h = hourlyNormalized[idx];
    const ts = getTs(h);

    const c = computeComfortFn({
      wu: {
        temp: h.temperatureF ?? null,
        dewPoint: h.dewpointF ?? null,
        windSpeed: h.wind_speed ?? 0,
        windDir: h.wind_dir ?? "",
        obsTimeLocal: ts
      }
    });

    items.push({
      index: idx,
      time: ts,
      hourLabel: formatHourLabel(ts),
      comfortScore: c?.comfortScore ?? 0,
      color: c?.color,
      label: c?.category,
      emoji: c?.emoji,
      temp: h.temperatureF ?? null,
      dew: h.dewpointF ?? null,
      wind: h.wind_speed ?? null
    });
  }

  return items;
}