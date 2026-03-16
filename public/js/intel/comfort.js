// /intel/comfort.js
// Unified Comfort Engine — Wind, Humidity, Sun Angle, Precip, Feels‑Like, Emoji Variation

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

  return elevation * (180 / Math.PI); // degrees
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
// HUMIDITY FEEL (dewpoint-based)
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
  const sunFeel = sunAngleFeel(elev);

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

  // 7. Summary (micro‑phrasing)
  const summaryParts = [];

  if (state === "cold") summaryParts.push("Cold with a noticeable chill.");
  else if (state === "cool") summaryParts.push("Cool and manageable.");
  else if (state === "mild") summaryParts.push("Comfortable overall.");
  else if (state === "warm") summaryParts.push("Warm with a gentle edge.");
  else if (state === "hot") summaryParts.push("Hot and energetic.");

  summaryParts.push(humidFeel);
  summaryParts.push(sunFeel);

  const summary = summaryParts.filter(Boolean).join(" ");

  return {
    emoji,
    summary,
    feelsLike,
    windFeel: wind >= 15 ? "A noticeable breeze adds some edge." : "",
    humidityFeel: humidFeel,
    sunFeel,
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
