// /public/js/modules/human-action-2/core-engine.js
// Human‑Action 2.0 — Core Engine (Rich Return)
// Determines dominantFactor, confidence, secondaryFactors, and notes
// This file does NOT handle phrasing — only logic and scoring.

/**
 * Expected data shape (conceptual):
 * {
 *   temp: number,            // °F
 *   feelsLike: number,       // °F
 *   dewpoint: number,        // °F
 *   humidity: number,        // 0–100
 *   windSpeed: number,       // mph
 *   windGust: number,        // mph
 *   precipType: "none" | "rain" | "snow",
 *   precipIntensity: number, // mm/hr or similar
 *   uvIndex: number,         // 0–11+
 *   visibility: number,      // miles
 *   cloudCover: number,      // 0–1
 *   smokeIndex: number,      // 0–1 (0 = none, 1 = heavy)
 *   frostRisk: number,       // 0–1
 *   freezeRisk: number,      // 0–1
 *   inversionRisk: number,   // 0–1
 *   blackIceRisk: number,    // 0–1
 *   valleyFogRisk: number,   // 0–1
 *   ridgeFogRisk: number,    // 0–1
 *   timestamp: number        // ms since epoch (local or UTC)
 * }
 */

// ---------------------------------------------------------
// Seasonal helpers
// ---------------------------------------------------------
function getSeasonFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1; // 1–12

  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

// Simple seasonal weighting: returns a multiplier for “cold” vs “heat” sensitivity
function getSeasonalContext(timestamp) {
  const season = getSeasonFromTimestamp(timestamp);

  switch (season) {
    case "winter":
      return { coldBias: 1.2, heatBias: 0.8 };
    case "summer":
      return { coldBias: 0.8, heatBias: 1.2 };
    case "spring":
    case "fall":
    default:
      return { coldBias: 1.0, heatBias: 1.0 };
  }
}

// Clamp helper
function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------
// Factor scoring helpers
// Each returns a score between 0 and 1
// ---------------------------------------------------------

function scoreCold(data, seasonal) {
  const feels = data.feelsLike ?? data.temp ?? 0;
  // Strong cold below 32, tapering up to ~50
  let base =
    feels <= 20 ? 1 :
    feels <= 32 ? 0.8 :
    feels <= 40 ? 0.6 :
    feels <= 50 ? 0.3 :
    0;

  return clamp(base * seasonal.coldBias);
}

function scoreHeat(data, seasonal) {
  const feels = data.feelsLike ?? data.temp ?? 0;
  // Strong heat above 88, tapering down to ~75
  let base =
    feels >= 95 ? 1 :
    feels >= 88 ? 0.8 :
    feels >= 82 ? 0.6 :
    feels >= 75 ? 0.3 :
    0;

  return clamp(base * seasonal.heatBias);
}

function scoreWind(data) {
  const wind = data.windSpeed ?? 0;
  const gust = data.windGust ?? wind;

  // Emphasize gusts
  const effective = Math.max(wind, gust * 0.8);

  let base =
    effective >= 30 ? 1 :
    effective >= 22 ? 0.8 :
    effective >= 15 ? 0.6 :
    effective >= 10 ? 0.3 :
    0;

  return clamp(base);
}

function scoreMountainWind(data) {
  // Use gusts as proxy; you can later refine with topographic metadata
  const gust = data.windGust ?? data.windSpeed ?? 0;

  let base =
    gust >= 40 ? 1 :
    gust >= 30 ? 0.8 :
    gust >= 25 ? 0.6 :
    gust >= 20 ? 0.3 :
    0;

  return clamp(base);
}

function scoreHumidity(data) {
  const humidity = data.humidity ?? 0;
  const dew = data.dewpoint ?? 0;
  const temp = data.temp ?? 0;

  // Muggy when dewpoint high and temp warm
  const dewComponent =
    dew >= 72 ? 1 :
    dew >= 68 ? 0.8 :
    dew >= 64 ? 0.6 :
    dew >= 60 ? 0.3 :
    0;

  const humidityComponent =
    humidity >= 85 ? 1 :
    humidity >= 75 ? 0.7 :
    humidity >= 65 ? 0.4 :
    0;

  const tempComponent =
    temp >= 80 ? 1 :
    temp >= 72 ? 0.7 :
    temp >= 65 ? 0.4 :
    0;

  const base = (dewComponent * 0.5) + (humidityComponent * 0.25) + (tempComponent * 0.25);
  return clamp(base);
}

function scoreMuggy(data) {
  // More specific “air you can wear”
  const dew = data.dewpoint ?? 0;
  const humidity = data.humidity ?? 0;

  let base =
    dew >= 72 ? 1 :
    dew >= 68 ? 0.8 :
    dew >= 64 ? 0.6 :
    dew >= 60 ? 0.4 :
    0;

  if (humidity >= 85) base = Math.max(base, 0.8);

  return clamp(base);
}

function scoreRain(data) {
  const type = data.precipType ?? "none";
  const intensity = data.precipIntensity ?? 0;

  if (type !== "rain") return 0;

  let base =
    intensity >= 5 ? 1 :
    intensity >= 2 ? 0.8 :
    intensity >= 1 ? 0.6 :
    intensity > 0 ? 0.3 :
    0;

  return clamp(base);
}

function scoreColdRain(data) {
  const type = data.precipType ?? "none";
  const intensity = data.precipIntensity ?? 0;
  const feels = data.feelsLike ?? data.temp ?? 0;

  if (type !== "rain") return 0;

  const tempComponent =
    feels <= 35 ? 1 :
    feels <= 42 ? 0.8 :
    feels <= 48 ? 0.6 :
    0;

  const intensityComponent =
    intensity >= 3 ? 1 :
    intensity >= 1 ? 0.7 :
    intensity > 0 ? 0.4 :
    0;

  const base = (tempComponent * 0.6) + (intensityComponent * 0.4);
  return clamp(base);
}

function scoreWarmRain(data) {
  const type = data.precipType ?? "none";
  const intensity = data.precipIntensity ?? 0;
  const feels = data.feelsLike ?? data.temp ?? 0;

  if (type !== "rain") return 0;

  const tempComponent =
    feels >= 78 ? 1 :
    feels >= 72 ? 0.8 :
    feels >= 68 ? 0.6 :
    0;

  const intensityComponent =
    intensity >= 3 ? 1 :
    intensity >= 1 ? 0.7 :
    intensity > 0 ? 0.4 :
    0;

  const base = (tempComponent * 0.6) + (intensityComponent * 0.4);
  return clamp(base);
}

function scoreSnow(data) {
  const type = data.precipType ?? "none";
  const intensity = data.precipIntensity ?? 0;

  if (type !== "snow") return 0;

  let base =
    intensity >= 3 ? 1 :
    intensity >= 1 ? 0.8 :
    intensity > 0 ? 0.5 :
    0;

  return clamp(base);
}

function scoreStorms(data) {
  // Proxy: strong precip + gusty wind
  const intensity = data.precipIntensity ?? 0;
  const gust = data.windGust ?? data.windSpeed ?? 0;

  const precipComponent =
    intensity >= 5 ? 1 :
    intensity >= 3 ? 0.8 :
    intensity >= 1 ? 0.5 :
    0;

  const windComponent =
    gust >= 40 ? 1 :
    gust >= 30 ? 0.8 :
    gust >= 25 ? 0.6 :
    gust >= 20 ? 0.3 :
    0;

  const base = (precipComponent * 0.6) + (windComponent * 0.4);
  return clamp(base);
}

function scoreFog(data) {
  const vis = data.visibility ?? 10;

  let base =
    vis <= 0.25 ? 1 :
    vis <= 0.5 ? 0.9 :
    vis <= 1 ? 0.7 :
    vis <= 2 ? 0.5 :
    vis <= 4 ? 0.3 :
    0;

  return clamp(base);
}

function scoreValleyFog(data) {
  return clamp(data.valleyFogRisk ?? 0);
}

function scoreRidgeFog(data) {
  return clamp(data.ridgeFogRisk ?? 0);
}

function scoreFreezingFog(data) {
  const fogScore = scoreFog(data);
  const temp = data.temp ?? 0;

  if (fogScore === 0) return 0;

  const tempComponent =
    temp <= 25 ? 1 :
    temp <= 30 ? 0.8 :
    temp <= 32 ? 0.6 :
    0;

  return clamp((fogScore * 0.6) + (tempComponent * 0.4));
}

function scoreFrost(data) {
  return clamp(data.frostRisk ?? 0);
}

function scoreFreeze(data) {
  return clamp(data.freezeRisk ?? 0);
}

function scoreBlackIce(data) {
  return clamp(data.blackIceRisk ?? 0);
}

function scoreSmoke(data) {
  const smokeIndex = data.smokeIndex ?? 0;
  let base =
    smokeIndex >= 0.8 ? 1 :
    smokeIndex >= 0.6 ? 0.8 :
    smokeIndex >= 0.4 ? 0.6 :
    smokeIndex >= 0.2 ? 0.3 :
    0;

  return clamp(base);
}

function scoreHaze(data) {
  // Light haze proxy: moderate visibility reduction without strong fog
  const vis = data.visibility ?? 10;
  const fogScore = scoreFog(data);

  if (fogScore > 0.4) return 0; // let fog own it

  let base =
    vis <= 5 ? 0.7 :
    vis <= 7 ? 0.5 :
    vis <= 9 ? 0.3 :
    0;

  return clamp(base);
}

function scoreUV(data) {
  const uv = data.uvIndex ?? 0;

  let base =
    uv >= 9 ? 1 :
    uv >= 7 ? 0.8 :
    uv >= 5 ? 0.6 :
    uv >= 3 ? 0.3 :
    0;

  return clamp(base);
}

function scoreSun(data) {
  const clouds = data.cloudCover ?? 0;
  const vis = data.visibility ?? 10;

  // Clear, good visibility
  let base =
    clouds <= 0.1 && vis >= 8 ? 1 :
    clouds <= 0.25 && vis >= 6 ? 0.7 :
    clouds <= 0.4 && vis >= 5 ? 0.4 :
    0;

  return clamp(base);
}

function scoreClouds(data) {
  const clouds = data.cloudCover ?? 0;

  let base =
    clouds >= 0.9 ? 1 :
    clouds >= 0.75 ? 0.8 :
    clouds >= 0.6 ? 0.6 :
    clouds >= 0.5 ? 0.4 :
    0;

  return clamp(base);
}

function scoreInversion(data) {
  return clamp(data.inversionRisk ?? 0);
}

// ---------------------------------------------------------
// Main evaluation
// ---------------------------------------------------------

export function evaluateHumanActionFactors(data) {
  const seasonal = getSeasonalContext(data.timestamp ?? Date.now());

  // Compute scores for all factors
  const scores = [
    { factor: "cold", score: scoreCold(data, seasonal) },
    { factor: "heat", score: scoreHeat(data, seasonal) },
    { factor: "wind", score: scoreWind(data) },
    { factor: "mountainWind", score: scoreMountainWind(data) },
    { factor: "humidity", score: scoreHumidity(data) },
    { factor: "muggy", score: scoreMuggy(data) },
    { factor: "rain", score: scoreRain(data) },
    { factor: "coldRain", score: scoreColdRain(data) },
    { factor: "warmRain", score: scoreWarmRain(data) },
    { factor: "snow", score: scoreSnow(data) },
    { factor: "storms", score: scoreStorms(data) },
    { factor: "fog", score: scoreFog(data) },
    { factor: "valleyFog", score: scoreValleyFog(data) },
    { factor: "ridgeFog", score: scoreRidgeFog(data) },
    { factor: "freezingFog", score: scoreFreezingFog(data) },
    { factor: "frost", score: scoreFrost(data) },
    { factor: "freeze", score: scoreFreeze(data) },
    { factor: "blackIce", score: scoreBlackIce(data) },
    { factor: "smoke", score: scoreSmoke(data) },
    { factor: "haze", score: scoreHaze(data) },
    { factor: "uv", score: scoreUV(data) },
    { factor: "sun", score: scoreSun(data) },
    { factor: "clouds", score: scoreClouds(data) },
    { factor: "inversion", score: scoreInversion(data) }
  ];

  // Filter out near-zero scores to reduce noise
  const meaningful = scores.filter(s => s.score > 0.05);

  if (meaningful.length === 0) {
    return {
      dominantFactor: "default",
      confidence: 0.2,
      secondaryFactors: [],
      notes: "No single factor stands out strongly; conditions are fairly balanced."
    };
  }

  // Sort by score descending
  meaningful.sort((a, b) => b.score - a.score);

  const top = meaningful[0];
  const second = meaningful[1];
  const third = meaningful[2];

  // Normalize confidence to 0–1 (top score already in that range)
  const confidence = clamp(top.score);

  const secondaryFactors = [];
  if (second && second.score >= 0.3) secondaryFactors.push(second.factor);
  if (third && third.score >= 0.3) secondaryFactors.push(third.factor);

  const notes = buildNotes(top, secondaryFactors, data);

  return {
    dominantFactor: top.factor,
    confidence,
    secondaryFactors,
    notes
  };
}

// ---------------------------------------------------------
// Notes builder — short explanation for debugging / future UX
// ---------------------------------------------------------
function buildNotes(top, secondaryFactors, data) {
  const factor = top.factor;
  const pieces = [];

  switch (factor) {
    case "cold":
      pieces.push("Cold dominates due to low feels-like temperatures.");
      break;
    case "heat":
      pieces.push("Heat dominates with elevated feels-like temperatures.");
      break;
    case "wind":
      pieces.push("Wind stands out with noticeable sustained speeds or gusts.");
      break;
    case "mountainWind":
      pieces.push("Mountain winds and gusts are the primary driver today.");
      break;
    case "humidity":
      pieces.push("Humidity is a key factor, adding heaviness to the air.");
      break;
    case "muggy":
      pieces.push("High dewpoints create a muggy, slow-moving feel.");
      break;
    case "rain":
      pieces.push("Rain is the main story based on precip intensity.");
      break;
    case "coldRain":
      pieces.push("Cold rain dominates with chilly temps and steady precip.");
      break;
    case "warmRain":
      pieces.push("Warm rain and tropical moisture shape how the day feels.");
      break;
    case "snow":
      pieces.push("Snowfall is the primary factor affecting conditions.");
      break;
    case "storms":
      pieces.push("Storm energy and gusty winds are the leading influence.");
      break;
    case "fog":
      pieces.push("Reduced visibility from fog is the main impact.");
      break;
    case "valleyFog":
      pieces.push("Valley fog is the standout feature, especially in low spots.");
      break;
    case "ridgeFog":
      pieces.push("Ridge-top fog is the primary factor at higher elevations.");
      break;
    case "freezingFog":
      pieces.push("Freezing fog creates icing concerns on exposed surfaces.");
      break;
    case "frost":
      pieces.push("Frost risk is elevated, especially around sunrise.");
      break;
    case "freeze":
      pieces.push("Freeze conditions dominate with sub-freezing temps.");
      break;
    case "blackIce":
      pieces.push("Black ice risk is a key concern, especially early.");
      break;
    case "smoke":
      pieces.push("Wildfire smoke or particulates are reducing air quality and visibility.");
      break;
    case "haze":
      pieces.push("Haze is softening light and trimming visibility.");
      break;
    case "uv":
      pieces.push("High UV levels are a notable factor under stronger sun.");
      break;
    case "sun":
      pieces.push("Bright sun and clear skies are the main story.");
      break;
    case "clouds":
      pieces.push("Cloud cover is shaping the feel of the day.");
      break;
    case "inversion":
      pieces.push("A temperature inversion is driving ridge/valley differences.");
      break;
    default:
      pieces.push("No single factor dominates strongly.");
  }

  if (secondaryFactors.length > 0) {
    pieces.push(`Secondary influences: ${secondaryFactors.join(", ")}.`);
  }

  return pieces.join(" ");
}
