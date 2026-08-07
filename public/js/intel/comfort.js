// /js/intel/comfort.js

import { LOCATION } from "../config/location.js";

// One shared, versioned source of truth for every FeelScore consumer. Update
// this calibration and its regression matrix together when field observations
// reveal that the model does not match how conditions actually feel outdoors.
export const FEELSCORE_CALIBRATION = Object.freeze({
  version: "2026-08-07-humid-heat-v1",
  temperature: Object.freeze({
    idealMinF: 65,
    idealMaxF: 75,
    humidHeatMinF: 76
  }),
  dewpoint: Object.freeze({
    noticeableF: 60,
    muggyF: 65,
    veryMuggyF: 67,
    oppressiveF: 70
  }),
  scoreBands: Object.freeze({
    ideal: 90,
    great: 80,
    pleasant: 70,
    noticeable: 55,
    challenging: 40
  })
});

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

  const time =
    date.getHours() +
    date.getMinutes() / 60 +
    date.getSeconds() / 3600;

  const b = rad * ((360 / 365) * (day - 81));
  const equationOfTime =
    9.87 * Math.sin(2 * b) -
    7.53 * Math.cos(b) -
    1.5 * Math.sin(b);

  const timezoneOffsetHours = -date.getTimezoneOffset() / 60;
  const standardMeridian = timezoneOffsetHours * 15;
  const longitudeCorrection = 4 * (lon - standardMeridian);

  const solarTime =
    time +
    (equationOfTime + longitudeCorrection) / 60;

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
// PENALTIES (BALANCED)
// ============================================================

function computeTemperaturePenalty(temp) {
  if (temp == null) return 0.4;

  const { idealMinF, idealMaxF } = FEELSCORE_CALIBRATION.temperature;

  if (temp >= idealMinF && temp <= idealMaxF) return 0;

  if (temp < idealMinF) return clamp((idealMinF - temp) / 35, 0, 1);

  if (temp <= 82) return (temp - idealMaxF) / 20;
  if (temp <= 88) return 0.35 + (temp - 82) * 0.08;

  return clamp(0.8 + (temp - 88) * 0.04, 0, 1);
}

function computeDewPenalty(dew) {
  if (dew == null) return 0.15;

  const { noticeableF, muggyF, oppressiveF } = FEELSCORE_CALIBRATION.dewpoint;

  if (dew < 45) return 0.02;
  if (dew < 55) return 0.08;
  if (dew < noticeableF) return 0.18;
  if (dew < muggyF) return 0.32;
  if (dew < oppressiveF) {
    return 0.50 + ((dew - muggyF) / (oppressiveF - muggyF)) * 0.18;
  }

  return 0.70;
}

function computeHumidHeatPenalty(temp, dew) {
  if (!Number.isFinite(temp) || !Number.isFinite(dew)) return 0;
  const { humidHeatMinF } = FEELSCORE_CALIBRATION.temperature;
  const { muggyF } = FEELSCORE_CALIBRATION.dewpoint;
  if (temp < humidHeatMinF || dew < muggyF) return 0;

  const heatLoad = clamp((temp - humidHeatMinF) / 12, 0, 1);
  const moistureLoad = clamp((dew - muggyF) / 8, 0, 1);

  // Warm, moisture-rich air inhibits evaporative cooling. This interaction is
  // more uncomfortable than either the temperature or dew point in isolation.
  return 0.04 + heatLoad * 0.08 + moistureLoad * 0.06;
}

function computeWindPenalty(wind) {
  if (!Number.isFinite(wind)) return 0;

  if (wind < 5) return 0;
  if (wind < 12) return 0.03;
  if (wind < 20) return 0.10;

  return 0.22;
}

function computeSolarBonus(temp, elev) {
  if (elev < 10) return 0;

  if (temp < 55) return 0.06;
  if (temp < 65) return 0.05;
  if (temp < 72) return 0.03;
  if (temp < 78) return 0.015;

  return 0;
}

function normalizeProbability(value) {
  const n = num(value);
  if (n == null) return 0;
  return clamp(n > 1 ? n / 100 : n, 0, 1);
}

function getPrecipAmount(hour = {}) {
  return num(
    hour.precipAmount ??
    hour.precipitation ??
    hour.precipRate ??
    hour.precip_rate ??
    hour.rain
  ) ?? 0;
}

function getLightningDistanceMiles(lightning) {
  if (!lightning?.detected) return null;

  const miles =
    num(lightning.distanceMiles) ??
    num(lightning.distance_miles);

  if (miles != null) return miles;

  const km =
    num(lightning.distanceKm) ??
    num(lightning.distance_km);

  return km != null ? km * 0.621371 : null;
}

function computeWeatherDisruptionPenalty(hour = {}) {
  const amount = getPrecipAmount(hour);
  const probability = normalizeProbability(
    hour.precipProbability ??
    hour.precipitation_probability ??
    hour.pop
  );

  let precipPenalty = 0;

  if (amount >= 0.25) precipPenalty = 0.22;
  else if (amount >= 0.10) precipPenalty = 0.16;
  else if (amount >= 0.03) precipPenalty = 0.10;
  else if (amount >= 0.005) precipPenalty = 0.05;

  const probabilityPenalty =
    amount > 0
      ? 0
      : probability >= 0.7
        ? 0.10
        : probability >= 0.5
          ? 0.07
          : probability >= 0.3
            ? 0.04
            : 0;

  const lightningDistance = getLightningDistanceMiles(hour.lightning);
  const lightningCount =
    num(hour.lightning_strike_count) ??
    num(hour.lightningStrikeCount) ??
    0;

  let thunderPenalty = 0;

  if (lightningDistance != null) {
    if (lightningDistance <= 3) thunderPenalty = 0.35;
    else if (lightningDistance <= 6) thunderPenalty = 0.28;
    else if (lightningDistance <= 10) thunderPenalty = 0.22;
    else thunderPenalty = 0.16;
  } else if (lightningCount > 0) {
    thunderPenalty = 0.22;
  } else if (hour.thunder) {
    thunderPenalty = 0.18;
  } else if (normalizeProbability(hour.thunderProb ?? hour.thunderProbability) >= 0.3) {
    thunderPenalty = 0.12;
  }

  return clamp(
    Math.max(precipPenalty, probabilityPenalty) + thunderPenalty,
    0,
    0.45
  );
}

// ============================================================
// SCORE
// ============================================================

function computeComfortScore(temp, dew, wind, elev, weatherPenalty = 0) {
  if (temp == null) return null;

  const t = computeTemperaturePenalty(temp);
  const d = computeDewPenalty(dew);
  const w = computeWindPenalty(wind);
  const s = computeSolarBonus(temp, elev);
  const humidHeat = computeHumidHeatPenalty(temp, dew);

  const raw =
    (t * 0.55) +
    (d * 0.45) +
    humidHeat +
    w -
    s +
    weatherPenalty;

  let score = 100 - raw * 100;
  score = Math.round(clamp(score, 30, 98));

  return score;
}

// ============================================================
// CATEGORY
// ============================================================

function getCategory(score) {
  if (score >= 80) return "Comfortable";
  if (score >= 65) return "Pleasant";
  if (score >= 50) return "Mixed";
  return "Uncomfortable";
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
// CORE ENGINE
// ============================================================

function computeComfort(hour) {
  const temp = num(hour.temperatureF ?? hour.temp);

  const dew =
    num(hour.dewpointF ?? hour.dewPoint);

  const wind =
    num(hour.wind ?? hour.windSpeed ?? hour.wind_speed) ?? 0;

  const timestamp = normalizeTimestamp(
    hour.ts ?? hour.timestamp ?? hour.obsTimeLocal
  );

  const elev = computeSolarElevation(
    timestamp,
    LOCATION.lat,
    LOCATION.lon
  );

  const weatherPenalty = computeWeatherDisruptionPenalty(hour);

  const score = computeComfortScore(
    temp,
    dew,
    wind,
    elev,
    weatherPenalty
  );

  return {
    comfortScore: score,
    category: getCategory(score),
    emoji: getEmoji(score),
    color: getComfortColor(score),

    temp,
    dewpoint: dew,
    windSpeed: wind,
    weatherPenalty
  };
}

// ============================================================
// AFTERNOON WINDOW ANALYSIS (PRESERVED)
// ============================================================

export function analyzeAfternoonWindow(hours) {
  const window = hours.filter(h => {
    const hr = new Date(h.timestamp).getHours();
    return hr >= 13 && hr <= 16;
  });

  const scored = window.map(h => {
    const c = computeComfort(h);

    return {
      time: h.timestamp,
      score: c?.comfortScore ?? null,
      temp: h.temperatureF,
      dew: h.dewpointF
    };
  });

  const scores = scored.map(s => s.score).filter(Boolean);

  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;

  return {
    avgScore: avg,
    minScore: scores.length ? Math.min(...scores) : null,
    maxScore: scores.length ? Math.max(...scores) : null,
    hours: scored
  };
}

// ============================================================
// PUBLIC API (CRITICAL EXPORT)
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
    weatherPenalty: result.weatherPenalty,

    flags: {
      veryHot: result.temp >= 88,
      veryHumid: Number.isFinite(result.dewpoint) && result.dewpoint >= 67,
      crisp: Number.isFinite(result.dewpoint) && result.dewpoint < 55,
      windy: result.windSpeed >= 12
    },

    goldilocks:
      result.temp >= 65 &&
      result.temp <= 75 &&
      result.dewpoint >= 50 &&
      result.dewpoint <= 60 &&
      result.windSpeed < 12
  };
}
