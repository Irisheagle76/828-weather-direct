// /public/js/modules/human-action-2/core-engine.js
// Human‑Action 2.0 — Core Engine (Rich Return)
// Determines dominantFactor, confidence, secondaryFactors, and notes.
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
 *   smokeIndex: number,      // 0–1
 *   frostRisk: number,       // 0–1
 *   freezeRisk: number,      // 0–1
 *   inversionRisk: number,   // 0–1
 *   blackIceRisk: number,    // 0–1
 *   valleyFogRisk: number,   // 0–1
 *   ridgeFogRisk: number,    // 0–1
 *   timestamp: number        // ms since epoch
 * }
 */

// ---------------------------------------------------------
// Seasonal helpers
// ---------------------------------------------------------
function getSeasonFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;

  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "fall";
}

function getSeasonalContext(timestamp) {
  const season = getSeasonFromTimestamp(timestamp);

  switch (season) {
    case "winter":
      return { coldBias: 1.2, heatBias: 0.8 };
    case "summer":
      return { coldBias: 0.8, heatBias: 1.2 };
    default:
      return { coldBias: 1.0, heatBias: 1.0 };
  }
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------
// Main scoring engine
// ---------------------------------------------------------
export function evaluateHumanActionFactors(data) {
  if (!data || typeof data !== "object") {
    return {
      dominantFactor: "default",
      confidence: 0.1,
      secondaryFactors: [],
      notes: "Insufficient data for evaluation."
    };
  }

  const {
    temp,
    feelsLike,
    dewpoint,
    humidity,
    windSpeed,
    windGust,
    precipType,
    precipIntensity,
    uvIndex,
    visibility,
    cloudCover,
    smokeIndex,
    frostRisk,
    freezeRisk,
    inversionRisk,
    blackIceRisk,
    valleyFogRisk,
    ridgeFogRisk,
    timestamp
  } = data;

  const seasonal = getSeasonalContext(timestamp);
  const scores = [];
    // -----------------------------
  // Temperature factors
  // -----------------------------
  if (typeof feelsLike === "number") {
    if (feelsLike <= 40) {
      scores.push({
        factor: "cold",
        score: clamp((40 - feelsLike) / 40 * seasonal.coldBias)
      });
    }
    if (feelsLike >= 80) {
      scores.push({
        factor: "heat",
        score: clamp((feelsLike - 80) / 40 * seasonal.heatBias)
      });
    }
  }

  // -----------------------------
  // Humidity / Dewpoint
  // -----------------------------
  if (typeof dewpoint === "number" && dewpoint >= 65) {
    scores.push({
      factor: "muggy",
      score: clamp((dewpoint - 65) / 20)
    });
  }

  if (typeof humidity === "number" && typeof dewpoint === "number") {
    if (humidity >= 80 && dewpoint >= 60) {
      scores.push({
        factor: "humidity",
        score: clamp((humidity - 80) / 20)
      });
    }
  }

  // -----------------------------
  // Wind
  // -----------------------------
  if (typeof windSpeed === "number" || typeof windGust === "number") {
    const ws = windSpeed || 0;
    const wg = windGust || 0;

    if (ws >= 15 || wg >= 25) {
      scores.push({
        factor: "wind",
        score: clamp((ws + wg * 0.5) / 40)
      });
    }

    if (wg >= 35) {
      scores.push({
        factor: "mountainWind",
        score: clamp(wg / 50)
      });
    }
  }

  // -----------------------------
  // Precipitation
  // -----------------------------
  if (precipType === "rain" && typeof precipIntensity === "number") {
    if (precipIntensity > 0.5) {
      scores.push({
        factor: "rain",
        score: clamp(precipIntensity / 5)
      });
    }

    if (precipIntensity > 0.3 && typeof feelsLike === "number") {
      if (feelsLike <= 45) {
        scores.push({
          factor: "coldRain",
          score: clamp(0.6 + (45 - feelsLike) / 40)
        });
      } else if (feelsLike >= 70) {
        scores.push({
          factor: "warmRain",
          score: clamp(0.6 + (feelsLike - 70) / 40)
        });
      }
    }
  }

  if (precipType === "snow" && typeof precipIntensity === "number") {
    if (precipIntensity > 0.2) {
      scores.push({
        factor: "snow",
        score: clamp(precipIntensity / 2)
      });
    }
  }

  // -----------------------------
  // Fog / Visibility
  // -----------------------------
  if (typeof visibility === "number") {
    if (visibility <= 2) {
      scores.push({
        factor: "fog",
        score: clamp((2 - visibility) / 2)
      });
    }
    if (visibility <= 1 && typeof temp === "number" && temp <= 32) {
      scores.push({
        factor: "freezingFog",
        score: clamp(0.7 + (32 - temp) / 40)
      });
    }
  }

  if (typeof valleyFogRisk === "number" && valleyFogRisk >= 0.4) {
    scores.push({
      factor: "valleyFog",
      score: clamp(valleyFogRisk)
    });
  }

  if (typeof ridgeFogRisk === "number" && ridgeFogRisk >= 0.4) {
    scores.push({
      factor: "ridgeFog",
      score: clamp(ridgeFogRisk)
    });
  }

  // -----------------------------
  // Winter hazards
  // -----------------------------
  if (typeof frostRisk === "number" && frostRisk >= 0.4) {
    scores.push({
      factor: "frost",
      score: clamp(frostRisk)
    });
  }

  if (typeof freezeRisk === "number" && freezeRisk >= 0.4) {
    scores.push({
      factor: "freeze",
      score: clamp(freezeRisk)
    });
  }

  if (typeof blackIceRisk === "number" && blackIceRisk >= 0.3) {
    scores.push({
      factor: "blackIce",
      score: clamp(blackIceRisk)
    });
  }

  // -----------------------------
  // Air quality / smoke
  // -----------------------------
  if (typeof smokeIndex === "number" && smokeIndex >= 0.3) {
    scores.push({
      factor: "smoke",
      score: clamp(smokeIndex)
    });
  }

  // -----------------------------
  // UV / Sun / Clouds
  // -----------------------------
  if (typeof uvIndex === "number" && uvIndex >= 6) {
    scores.push({
      factor: "uv",
      score: clamp((uvIndex - 6) / 6)
    });
  }

  if (typeof cloudCover === "number") {
    if (cloudCover <= 0.2) {
      scores.push({
        factor: "sun",
        score: clamp((0.2 - cloudCover) * 2)
      });
    }
    if (cloudCover >= 0.8) {
      scores.push({
        factor: "clouds",
        score: clamp((cloudCover - 0.8) * 2)
      });
    }
  }

  // -----------------------------
  // Inversion
  // -----------------------------
  if (typeof inversionRisk === "number" && inversionRisk >= 0.3) {
    scores.push({
      factor: "inversion",
      score: clamp(inversionRisk)
    });
  }
    // ---------------------------------------------------------
  // Filter + sort + determine dominant factor
  // ---------------------------------------------------------
  const meaningful = scores.filter(s => s.score > 0.05);

  if (meaningful.length === 0) {
    return {
      dominantFactor: "default",
      confidence: 0.2,
      secondaryFactors: [],
      notes: "No single factor stands out strongly; conditions are fairly balanced."
    };
  }

  meaningful.sort((a, b) => b.score - a.score);

  const top = meaningful[0];
  const second = meaningful[1];
  const third = meaningful[2];

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
// Notes builder
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