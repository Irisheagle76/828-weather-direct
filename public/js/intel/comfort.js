// /intel/comfort.js
// Unified Comfort Engine — Wind, Humidity, Sun Angle, Precip, Feels‑Like, Trend Logic
// Tempest-integrated version (Tempest provides today's high)

import { LOCATION } from "../config/location.js";

// ------------------------------------------------------------
// SOLAR ELEVATION (NOAA simplified algorithm)
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
// WIND CHILL (NWS formula)
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
// SUN ANGLE FEEL
// ------------------------------------------------------------
function sunAngleFeel(elev) {
  if (elev <= 0) return "Nighttime calm.";
  if (elev < 10) return "Low sun adds a gentle warmth.";
  if (elev < 30) return "Morning sun gives a mild boost.";
  if (elev < 60) return "Daytime sun adds warmth.";
  return "Strong sun overhead.";
}

// ------------------------------------------------------------
// CONTEXT-AWARE SOLAR FILTER
// ------------------------------------------------------------
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
    windDir !== "NW"
  );
}

// ------------------------------------------------------------
// TEMPEST-BASED MORNING HIGH
// ------------------------------------------------------------
function computeObservedMorningHigh(intel) {
  const tempestHigh = intel?.today?.stats?.maxTemp;
  if (tempestHigh != null) return tempestHigh;

  return intel?.wu?.temp ?? null;
}

// ------------------------------------------------------------
// TEMPERATURE DROP FEEL
// ------------------------------------------------------------
function computeTempDropFeel(intel) {
  const wu = intel.wu;
  if (!wu) return null;

  const current = wu.temp ?? null;
  const morningHigh = computeObservedMorningHigh(intel);

  if (current == null || morningHigh == null) return null;

  const drop = morningHigh - current;

  if (drop >= 20) return "a sharp drop compared to earlier today";
  if (drop >= 12) return "noticeably colder than earlier";
  if (drop >= 6) return "a cooler turn compared to this morning";

  return null;
}

// ------------------------------------------------------------
// FALLING PRECIP COMFORT
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
// EMOJI VARIATION
// ------------------------------------------------------------
function pickComfortEmoji(state) {
  const map = {
    cold: ["🥶", "❄️", "🧊"],
    cool: ["🧥", "🍃", "🌫️"],
    mild: ["🙂", "🌤️", "🍂"],
    warm: ["🌞", "😎", "🌤️"],
    hot: ["🥵", "🔥", "🌞"],
    humid: ["💧", "🌫️", "😅"],
    gloomy: ["☁️", "🌫️", "😐"],
    night: ["🌙", "✨", "🌌"]
  };

  const arr = map[state] ?? ["🌤️"];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ------------------------------------------------------------
// MAIN COMFORT ENGINE
// ------------------------------------------------------------
export function computeComfort(intel) {
  const wu = intel.wu;
  if (!wu) return { emoji: "", summary: "" };

  const temp = wu.temp ?? 0;
  const dew = wu.dewPoint ?? 0;
  const wind = wu.windSpeed ?? 0;
  const timestamp = wu.obsTimeLocal ?? Date.now();

  // 1. Falling precip override
  const precipOverride = fallingPrecipFeel(intel);
  if (precipOverride) return precipOverride;

  // 2. Solar elevation
  const elev = computeSolarElevation(timestamp, LOCATION.lat, LOCATION.lon);
  const rawSunFeel = sunAngleFeel(elev);

  // 3. Wind chill
  const feelsLike = computeWindChill(temp, wind);

  // 4. Humidity feel
  const humidFeel = humidityFeel(dew);

  // 5. Temperature comfort state
  let state = "mild";
  if (feelsLike <= 32) state = "cold";
  else if (feelsLike <= 50) state = "cool";
  else if (feelsLike <= 70) state = "mild";
  else if (feelsLike <= 85) state = "warm";
  else state = "hot";

  // 6. Emoji
  const emoji = pickComfortEmoji(state);

  // 7. TREND-AWARE FIRST SENTENCE
  let baseFeel = "";
  if (state === "cold") baseFeel = "Cold with a noticeable chill";
  else if (state === "cool") baseFeel = "Cool and manageable";
  else if (state === "mild") baseFeel = "Comfortable overall";
  else if (state === "warm") baseFeel = "Warm with a gentle edge";
  else if (state === "hot") baseFeel = "Hot and energetic";

  const dropFeel = computeTempDropFeel(intel);

  const firstSentence = dropFeel
    ? `${baseFeel} — ${dropFeel}.`
    : `${baseFeel}.`;

  const summaryParts = [firstSentence];

  // 8. Humidity
  summaryParts.push(humidFeel);

  // 9. Solar boost
  if (isSolarHelpful(intel, elev)) {
    summaryParts.push(rawSunFeel);
  }

  // 10. Wind
  if (wind >= 15) {
    summaryParts.push("A noticeable breeze adds some edge.");
  }

  const summary = summaryParts.filter(Boolean).join(" ");

  return {
    emoji,
    summary,
    feelsLike,
    humidityFeel: humidFeel,
    sunFeel: isSolarHelpful(intel, elev) ? rawSunFeel : "",
    precipFeel: precipOverride?.summary ?? "",
    raw: {
      temp,
      dew,
      wind,
      elev,
      feelsLike
    }
  };
}
