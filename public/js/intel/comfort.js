// /intel/comfort.js
// FULL HYBRID — Narrative Engine + Asheville Comfort Score

import { LOCATION } from "../config/location.js";

// ------------------------------------------------------------
// SOLAR ELEVATION
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// DEW → RH
// ------------------------------------------------------------
function dewToRH(tempF, dewF) {
  const t = (tempF - 32) * 5/9;
  const d = (dewF - 32) * 5/9;

  const rh =
    100 *
    (Math.exp((17.625 * d) / (243.04 + d)) /
     Math.exp((17.625 * t) / (243.04 + t)));

  return Math.max(0, Math.min(100, rh));
}

// ------------------------------------------------------------
// ASHEVILLE COMFORT SCORE
// ------------------------------------------------------------
function computeComfortScore(temp, dew, wind, elev, windDir) {
  const rh = dewToRH(temp, dew);

  const tIdeal = 70;
  const tDiff = Math.abs(temp - tIdeal);
  const tScore = Math.min(tDiff / 35, 1);

  let drynessPenalty = 0;
  if (rh < 25) drynessPenalty = 1;
  else if (rh < 35) drynessPenalty = 0.75;
  else if (rh < 45) drynessPenalty = 0.5;
  else drynessPenalty = 0.2;

  let windPenalty = Math.min(wind / 25, 1) * 0.4;
  if (windDir && windDir.includes("W")) {
    windPenalty += 0.2;
  }

  let solarBonus = 0;
  if (elev > 20 && temp < 75) solarBonus = 0.15;

  let score =
    (tScore * 0.5) +
    (drynessPenalty * 0.9) +
    windPenalty -
    solarBonus;

  return Math.round(
    Math.max(0, Math.min(100, 100 - (score * 100)))
  );
}

// ------------------------------------------------------------
// COLOR + LABEL
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// WIND CHILL
// ------------------------------------------------------------
function computeWindChill(tempF, windMph) {
  if (tempF > 50 || windMph < 3) return tempF;
  return (
    35.74 +
    0.6215 * tempF -
    35.75 * Math.pow(windMph, 0.16) +
    0.4275 * tempF * Math.pow(windMph, 0.16)
  );
}

// ------------------------------------------------------------
// HUMIDITY FEEL
// ------------------------------------------------------------
function humidityFeel(dew) {
  if (dew <= 40) return "Dry and comfortable.";
  if (dew <= 55) return "Humidity stays manageable.";
  if (dew <= 65) return "A bit humid at times.";
  if (dew <= 70) return "Humid and noticeable.";
  return "Tropical and heavy.";
}

// ------------------------------------------------------------
// SUN FEEL
// ------------------------------------------------------------
function sunAngleFeel(elev) {
  if (elev <= 0) return "Nighttime calm.";
  if (elev < 10) return "Low sun adds a gentle warmth.";
  if (elev < 30) return "Morning sun gives a mild boost.";
  if (elev < 60) return "Daytime sun adds warmth.";
  return "Strong sun overhead.";
}

function isSolarHelpful(intel, elev) {
  const wu = intel.wu;
  if (!wu) return false;

  const cloud = wu.cloudCover ?? 100;
  const windDir = wu.windDir ?? "";
  const trend = intel.tempTrend ?? 0;

  return (
    elev > 15 &&
    cloud < 60 &&
    trend >= 0 &&
    !windDir.includes("W")
  );
}

// ------------------------------------------------------------
// PRECIP FEEL (RESTORED)
// ------------------------------------------------------------
function fallingPrecipFeel(intel) {
  const rate = intel.wu?.precipRate ?? 0;
  const type = intel.wu?.precipType ?? "";

  if (rate <= 0) return null;

  if (type === "snow" && rate < 0.1)
    return { emoji: "❄️", summary: "Light snow falling — a wintry feel." };

  if (type === "snow")
    return { emoji: "🌨️", summary: "Steady snow falling — bundle up out there." };

  if (type === "rain" && rate < 0.05)
    return { emoji: "🌦️", summary: "Light rain falling — a damp, cool feel." };

  if (type === "rain")
    return { emoji: "🌧️", summary: "Rain falling — a noticeably damp feel." };

  return null;
}

// ------------------------------------------------------------
// TREND + DROP (RESTORED)
// ------------------------------------------------------------
function computeShortTermTrend(intel) {
  const temps = intel.hourly?.temperature_2m;
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

function computeTempDropFeel(intel) {
  const wu = intel.wu;
  if (!wu) return null;

  const hour = new Date(wu.obsTimeLocal).getHours();
  if (hour < 11) return null;

  const current = wu.temp;
  const high = intel?.today?.stats?.maxTemp ?? current;

  const drop = high - current;

  if (drop >= 20) return "a sharp drop compared to earlier today";
  if (drop >= 12) return "noticeably colder than earlier today";
  if (drop >= 6) return "a cooler turn compared to earlier today";

  return null;
}

// ------------------------------------------------------------
// MAIN ENGINE
// ------------------------------------------------------------
export function computeComfort(intel) {
  const wu = intel.wu;
  if (!wu) return {};

  const temp = wu.temp ?? 0;
  const dew = wu.dewPoint ?? 0;
  const wind = wu.windSpeed ?? 0;
  const windDir = wu.windDir ?? "";
  const timestamp = wu.obsTimeLocal ?? Date.now();

  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const feelsLike = computeWindChill(temp, wind);

  // ⭐ NEW SCORE
  const comfortScore = computeComfortScore(temp, dew, wind, elev, windDir);

  // --- precip override
  const precipOverride = fallingPrecipFeel(intel);
  if (precipOverride) {
    return {
      ...precipOverride,
      comfortScore,
      label: getComfortLabel(comfortScore),
      color: getComfortColor(comfortScore)
    };
  }

  // --- state
  let state = "mild";
  if (feelsLike <= 32) state = "cold";
  else if (feelsLike <= 50) state = "cool";
  else if (feelsLike <= 70) state = "mild";
  else if (feelsLike <= 85) state = "warm";
  else state = "hot";

  const emoji = pickComfortEmoji(state);

  let baseFeel =
    state === "cold" ? "Cold with a noticeable chill" :
    state === "cool" ? "Cool and manageable" :
    state === "warm" ? "Warm with a gentle edge" :
    state === "hot" ? "Hot and energetic" :
    "Comfortable overall";

  const dropFeel = computeTempDropFeel(intel);
  const trend = computeShortTermTrend(intel);

  let firstSentence = `${baseFeel}.`;

  if (dropFeel) {
    firstSentence = `${baseFeel} — ${dropFeel}.`;
  } else if (trend) {
    firstSentence = `${baseFeel} — ${trend} over the next few hours.`;
  }

  const parts = [firstSentence];

  const humidText = humidityFeel(dew);
  if (humidText) parts.push(humidText);

  if (isSolarHelpful(intel, elev)) {
    parts.push(sunAngleFeel(elev));
  }

  if (wind >= 15) {
    parts.push("A noticeable breeze adds some edge.");
  }

  // 🔥 fire messaging overlay
  if (comfortScore < 45) {
    parts.push("Dry air and wind are increasing fire danger.");
  }

  return {
    emoji,
    summary: parts.join(" "),
    comfortScore,
    label: getComfortLabel(comfortScore),
    color: getComfortColor(comfortScore),
    feelsLike
  };
}

// ------------------------------------------------------------
// FUTURE BUILDER
// ------------------------------------------------------------
export function buildFutureComfort(hourly, futureWindow, computeComfort) {
  if (!hourly || !futureWindow?.length) return [];

  return futureWindow.map(idx => {
    const intelForHour = {
      wu: {
        temp: hourly.temperature_2m[idx],
        dewPoint: hourly.dewpoint_2m[idx],
        windSpeed: hourly.wind_speed_10m[idx],
        windDir: hourly.wind_direction_10m?.[idx] ?? "",
        obsTimeLocal: hourly.time[idx]
      },
      hourly
    };

    const c = computeComfort(intelForHour);

    return {
      time: hourly.time[idx],
      hourLabel: formatHourLabel(hourly.time[idx]),
      comfortScore: c.comfortScore,
      color: c.color,
      label: c.label,
      emoji: c.emoji
    };
  });
}

function formatHourLabel(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h} ${suffix}`;
}