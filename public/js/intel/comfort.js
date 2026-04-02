// /intel/comfort.js
// ============================================================
// COMFORT ENGINE — v3.5 (Full Rewrite — Stable, Defensive, Complete)
// ============================================================

import { LOCATION } from "/js/config/location.js";

// ============================================================
// UTILITIES
// ============================================================

// Clamp number safely
function clamp(val, min, max) {
if (!Number.isFinite(val)) return min;
return Math.max(min, Math.min(max, val));
}

// Ensure number or null
function num(v) {
const n = Number(v);
return Number.isFinite(n) ? n : null;
}

// Ensure timestamp (ms)
function normalizeTimestamp(ts) {
if (!ts) return Date.now();
return ts < 1e12 ? ts * 1000 : ts;
}

// ============================================================
// SOLAR ELEVATION
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

// Critical: always ensure dew exists
function ensureDew(temp, dew) {
if (dew != null) return dew;
if (temp != null) return temp - 20; // stable fallback
return null;
}

// ============================================================
// COMFORT SCORE
// ============================================================

function computeComfortScore(temp, dew, wind, elev, windDir) {
if (temp == null || dew == null) return null;

const rh = dewToRH(temp, dew);
if (rh == null) return null;

// Temperature distance from ideal
const tScore = Math.min(Math.abs(temp - 70) / 35, 1);

// Dryness penalty
const drynessPenalty =
rh < 25 ? 1 :
rh < 35 ? 0.75 :
rh < 45 ? 0.5 : 0.2;

// Wind penalty
const w = Number.isFinite(wind) ? wind : 0;
let windPenalty = Math.min(w / 25, 1) * 0.4;

if (String(windDir ?? "").includes("W")) {
windPenalty += 0.2;
}

// Solar bonus
const solarBonus =
elev > 20 && temp < 75 ? 0.15 : 0;

const raw =
(tScore * 0.5) +
(drynessPenalty * 0.6) +
windPenalty -
solarBonus;

return Math.round(
clamp(100 - raw * 100, 0, 100)
);
}

// ============================================================
// COLOR + CATEGORY
// ============================================================

export function getComfortColor(score) {
if (score >= 80) return "#4f7cff";
if (score >= 65) return "#2ec4b6";
if (score >= 45) return "#ff9f1c";
return "#e63946";
}

export function getComfortLabel(score) {
if (score >= 80) return "Great";
if (score >= 65) return "Comfortable";
if (score >= 50) return "Dry";
if (score >= 35) return "Very Dry";
return "Harsh / Fire Risk";
}

function getCategory(score) {
if (score >= 80) return "Comfortable";
if (score >= 65) return "Slightly Uncomfortable";
if (score >= 45) return "Uncomfortable";
return "Harsh";
}

// ============================================================
// WIND CHILL
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
// HUMAN FEEL HELPERS
// ============================================================

function humidityHeadlinePhrase(dew) {
if (dew == null) return null;
if (dew <= 40) return "dry, comfortable air";
if (dew <= 55) return "manageable humidity";
if (dew <= 65) return "a bit of humidity";
if (dew <= 70) return "noticeable humidity";
return "very humid air";
}

function humidityFeel(dew) {
if (dew == null) return null;
if (dew <= 40) return "Dry and comfortable.";
if (dew <= 55) return "Humidity stays manageable.";
if (dew <= 65) return "A bit humid at times.";
if (dew <= 70) return "Humid and noticeable.";
return "Tropical and heavy.";
}

function sunAngleFeel(elev) {
if (elev <= 0) return "Nighttime calm.";
if (elev < 10) return "Low sun adds a gentle warmth.";
if (elev < 30) return "Morning sun gives a mild boost.";
if (elev < 60) return "Daytime sun adds warmth.";
return "Strong sun overhead.";
}

function isSolarHelpful(intel, elev) {
const src = intel?.tempest ?? intel?.wu ?? {};
const cloud = src.cloudCover ?? 100;
const windDir = String(src.windDir ?? "");
const trend = intel?.tempTrend ?? 0;

return (
elev > 15 &&
cloud < 60 &&
trend >= 0 &&
!windDir.includes("W")
);
}

// ============================================================
// TREND LOGIC
// ============================================================

function computeShortTermTrend(intel) {
const temps = intel?.hourly?.temperature_2m;
if (!temps) return null;

const t1 = temps[0];
const t3 = temps[2];

if (t1 == null || t3 == null) return null;

const delta = t3 - t1;

if (delta >= 4) return "warming quickly";
if (delta >= 2) return "warming gradually";
if (delta <= -4) return "cooling quickly";
if (delta <= -2) return "cooling gradually";

return null;
}

// ============================================================
// HEADLINE BUILDER
// ============================================================

function buildHeadline(category, dew) {
const phrase = humidityHeadlinePhrase(dew);

if (!phrase) return `${category}.`;

if (category === "Comfortable") return `Comfortable with ${phrase}.`;
if (category === "Slightly Uncomfortable") return `Slightly uncomfortable with ${phrase}.`;
if (category === "Uncomfortable") return `Uncomfortable due to ${phrase}.`;
return `Harsh conditions with ${phrase}.`;
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
const score = rawScore ?? 0; // critical stability

const category = getCategory(score);

const emojiMap = {
Comfortable: "🙂",
"Slightly Uncomfortable": "😐",
Uncomfortable: "😣",
Harsh: "🤯"
};

const emoji = emojiMap[category] ?? "😐";

const parts = [];

if (wind >= 15) {
parts.push("A noticeable breeze adds some edge.");
} else if (wind >= 8) {
parts.push("A light breeze moves through at times.");
}

if (isSolarHelpful(intel, elev)) {
parts.push(sunAngleFeel(elev));
}

const trend = computeShortTermTrend(intel);
if (trend) {
parts.push(`Expect conditions to be ${trend} soon.`);
}

return {
  category,
  emoji,
  headline: buildHeadline(category, dew),
  narrative: parts.length ? parts.join(" ") : null,

  comfortScore: score,
  feelsLike,

  temp,
  dewpoint: dew,
  humidity: dewToRH(temp, dew),
  windSpeed: wind,

  color: getComfortColor(score),
  label: getComfortLabel(score),

  scoreExplainer:
    "Comfort Score blends temperature, humidity, wind, and sun angle into a 0–100 scale."
};
}

// ============================================================
// FUTURE COMFORT
// ============================================================

export function buildFutureComfort(
hourlyNormalized,
computeComfortFn = computeComfort
) {
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

```
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
```

}

return items;
}

// ============================================================
// TIME FORMAT
// ============================================================

function formatHourLabel(ts) {
const d = new Date(ts);

const formatter = new Intl.DateTimeFormat("en-US", {
hour: "numeric",
hour12: true,
timeZone: "America/New_York"
});

const parts = formatter.formatToParts(d);
const hour = parts.find(p => p.type === "hour")?.value ?? "";
const suffix = parts.find(p => p.type === "dayPeriod")?.value?.toUpperCase() ?? "";

return `${hour} ${suffix}`;
}
