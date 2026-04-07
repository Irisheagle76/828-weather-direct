// /public/js/modules/human-action-2/core-engine.js
// Human‑Action 2.0 — Core Engine (Rich Return, Hybrid Daypart Aware)
// Determines dominantFactor, confidence, secondaryFactors, and notes.
// This file does NOT handle phrasing — only logic and scoring.

/**
 * Expected single-snapshot data shape:
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
 *
 * Hybrid tomorrow shape (from buildTomorrowCurrent):
 * {
 *   morning: { ...single snapshot... },
 *   afternoon: { ...single snapshot... },
 *   stats: {
 *     tempMin, tempMax, tempSwing,
 *     windGustMax, windAvg,
 *     dewpointAvg, cloudAvg,
 *     rainTotal, snowTotal,
 *     coldStart, windImpact
 *   }
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
// Priority helpers
// ---------------------------------------------------------
function pickDominantFactor(factors) {
  const priority = [
    "blackIce",
    "freezingFog",
    "freeze",
    "frost",
    "snow",
    "storms",
    "coldRain",
    "warmRain",
    "rain",
    "mountainWind",
    "wind",
    "cold",
    "heat",
    "humidity",
    "muggy",
    "valleyFog",
    "ridgeFog",
    "fog",
    "smoke",
    "haze",
    "uv",
    "clouds",
    "sun",
    "inversion"
  ];

  for (const p of priority) {
    if (factors.includes(p)) return p;
  }

  return "default";
}

const severityRank = {
  blackIce: 10,
  freezingFog: 9,
  freeze: 9,
  frost: 8,
  snow: 7,
  storms: 7,
  coldRain: 6,
  warmRain: 6,
  rain: 6,
  mountainWind: 6,
  wind: 5,
  cold: 4,
  heat: 4,
  humidity: 3,
  muggy: 3,
  valleyFog: 3,
  ridgeFog: 3,
  fog: 3,
  smoke: 3,
  haze: 2,
  uv: 2,
  clouds: 2,
  sun: 1,
  inversion: 1,
  default: 0
};

// ---------------------------------------------------------
// Main scoring engine (now hybrid-aware)
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

  const isHybrid =
    data.morning &&
    data.afternoon &&
    data.stats;

  // -------------------------------------------------------
  // HYBRID MODE — tomorrow (morning + afternoon + stats)
  // -------------------------------------------------------
  if (isHybrid) {
    const morningEval = evaluateSingleSnapshotRich(data.morning);
    const afternoonEval = evaluateSingleSnapshotRich(data.afternoon);

    const hybrid = combineDayparts(morningEval, afternoonEval, data.stats);

    const notes = buildNotes(
      { factor: hybrid.dominantFactor, score: hybrid.confidence },
      hybrid.secondaryFactors,
      // pass afternoon snapshot as representative context
      data.afternoon
    );

    return {
      dominantFactor: hybrid.dominantFactor,
      confidence: hybrid.confidence,
      secondaryFactors: hybrid.secondaryFactors,
      notes
    };
  }

  // -------------------------------------------------------
  // SINGLE SNAPSHOT MODE — current conditions, etc.
  // -------------------------------------------------------
  return evaluateSingleSnapshotRich(data);
}

// =========================================================
// SINGLE SNAPSHOT EVALUATOR (original logic, extracted)
// =========================================================
function evaluateSingleSnapshotRich(data) {
  const safeNum = (v, def = null) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;

const temp = safeNum(data.temp);
const feelsLike = safeNum(data.feelsLike);
const dewpoint = safeNum(data.dewpoint);
const humidity = safeNum(data.humidity);

const windSpeed = safeNum(data.windSpeed, 0);
const windGust = safeNum(data.windGust, 0);

const precipType = data.precipType || "none";
const precipIntensity = safeNum(data.precipIntensity, 0);

const uvIndex = safeNum(data.uvIndex, 0);
const visibility = safeNum(data.visibility);
const cloudCover = safeNum(data.cloudCover);

const smokeIndex = safeNum(data.smokeIndex, 0);
const frostRisk = safeNum(data.frostRisk, 0);
const freezeRisk = safeNum(data.freezeRisk, 0);
const inversionRisk = safeNum(data.inversionRisk, 0);
const blackIceRisk = safeNum(data.blackIceRisk, 0);
const valleyFogRisk = safeNum(data.valleyFogRisk, 0);
const ridgeFogRisk = safeNum(data.ridgeFogRisk, 0);

const timestamp = safeNum(data.timestamp, Date.now());

const date = new Date(timestamp);
const hour = Number.isFinite(date.getTime()) ? date.getHours() : 12;
const isNight = hour >= 18 || hour <= 6;

  const seasonal = getSeasonalContext(timestamp);
  const scores = [];

  const validInputs = [
  temp,
  feelsLike,
  dewpoint,
  humidity,
  visibility,
  cloudCover
].filter(v => v !== null).length;

const dataQuality = validInputs / 6; // 0 → 1

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
const ws = typeof windSpeed === "number" && Number.isFinite(windSpeed) ? windSpeed : 0;
const wg = typeof windGust === "number" && Number.isFinite(windGust) ? windGust : 0;

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
    let fogScore = clamp((2 - visibility) / 2);

    if (isNight) fogScore *= 1.1;

    scores.push({
      factor: "fog",
      score: clamp(fogScore)
    });
  }

  if (visibility <= 1 && typeof temp === "number" && temp <= 32) {
    let freezeFogScore = clamp(0.7 + (32 - temp) / 40);

    if (isNight) freezeFogScore *= 1.1;

    scores.push({
      factor: "freezingFog",
      score: clamp(freezeFogScore)
    });
  }
}

 if (typeof valleyFogRisk === "number" && valleyFogRisk >= 0.4) {
  let score = clamp(valleyFogRisk);
  if (isNight) score *= 1.1;

  scores.push({
    factor: "valleyFog",
    score: clamp(score)
  });
}

if (typeof ridgeFogRisk === "number" && ridgeFogRisk >= 0.4) {
  let score = clamp(ridgeFogRisk);
  if (isNight) score *= 1.1;

  scores.push({
    factor: "ridgeFog",
    score: clamp(score)
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
// suppress UV at night
if (!isNight && typeof uvIndex === "number" && uvIndex >= 6) {
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
// Filter + weight + determine dominant factor (stabilized)
// ---------------------------------------------------------
const meaningful = scores
  .filter(s => s.score > 0.05)
  .map(s => ({
    ...s,
    weightedScore: s.score // ready for future time-weighting
  }));

if (meaningful.length === 0) {
  return {
    dominantFactor: "default",
    confidence: 0.2,
    secondaryFactors: [],
    notes: "No single factor stands out strongly; conditions are fairly balanced."
  };
}

// sort by weighted score (not raw score)
meaningful.sort((a, b) => b.weightedScore - a.weightedScore);

const top = meaningful[0];
const second = meaningful[1];
const third = meaningful[2];

// ---------------------------------------------------------
// Stabilize dominant factor (prevents jitter)
// ---------------------------------------------------------
let dominant = top;

if (second && Math.abs(top.weightedScore - second.weightedScore) < 0.15) {
  dominant = {
    factor: pickDominantFactor([top.factor, second.factor]),
    score: top.weightedScore
  };
}

// ---------------------------------------------------------
// Confidence (smoothed, less jumpy)
// ---------------------------------------------------------
const confidence = clamp(
  (dominant.score * 0.85 + meaningful.length * 0.05) *
  (0.6 + dataQuality * 0.4)
);

// ---------------------------------------------------------
// Secondary factors (clear + intentional)
// ---------------------------------------------------------
const secondaryFactors = [];

if (second && second.score >= 0.3 && second.factor !== dominant.factor) {
  secondaryFactors.push(second.factor);
}

if (third && third.score >= 0.3 && third.factor !== dominant.factor) {
  secondaryFactors.push(third.factor);
}

// ---------------------------------------------------------
// Notes (based on dominant)
// ---------------------------------------------------------
const notes = buildNotes(
  { factor: dominant.factor, score: dominant.score },
  secondaryFactors,
  data
);

// ---------------------------------------------------------
// Return
// ---------------------------------------------------------
return {
  dominantFactor: dominant.factor,
  confidence,
  secondaryFactors,
  notes
};

// =========================================================
// HYBRID DAYPART COMBINER
// =========================================================
function combineDayparts(morningEval, afternoonEval, stats) {
  const mFactors = [
    morningEval.dominantFactor,
    ...morningEval.secondaryFactors
  ];
  const aFactors = [
    afternoonEval.dominantFactor,
    ...afternoonEval.secondaryFactors
  ];

  // 1. Shared factors dominate
  const shared = mFactors.filter(f => aFactors.includes(f));
  if (shared.length > 0) {
    const dominantFactor = pickDominantFactor(shared);
    const confidence = Math.max(
      morningEval.confidence,
      afternoonEval.confidence
    );

    const allFactors = Array.from(new Set([...mFactors, ...aFactors]));
    const secondaryFactors = allFactors
      .filter(f => f !== dominantFactor)
      .slice(0, 2);

    return { dominantFactor, confidence, secondaryFactors };
  }

  // 2. Strong outliers from day-level stats
  if (stats && stats.coldStart) {
    return {
      dominantFactor: "cold",
      confidence: Math.max(morningEval.confidence, 0.7),
      secondaryFactors: dedupeSecondary([
        morningEval.dominantFactor,
        ...morningEval.secondaryFactors,
        afternoonEval.dominantFactor
      ], "cold")
    };
  }

  if (stats && stats.windImpact) {
    return {
      dominantFactor: "wind",
      confidence: Math.max(
        morningEval.confidence,
        afternoonEval.confidence,
        0.7
      ),
      secondaryFactors: dedupeSecondary([
        morningEval.dominantFactor,
        ...morningEval.secondaryFactors,
        afternoonEval.dominantFactor,
        ...afternoonEval.secondaryFactors
      ], "wind")
    };
  }

  if (stats && typeof stats.tempSwing === "number" &&
      Math.abs(stats.tempSwing) >= 15) {
    if (stats.tempSwing < 0) {
      return {
        dominantFactor: "cold",
        confidence: Math.max(
          morningEval.confidence,
          afternoonEval.confidence,
          0.7
        ),
        secondaryFactors: dedupeSecondary([
          morningEval.dominantFactor,
          afternoonEval.dominantFactor
        ], "cold")
      };
    }
    if (stats.tempSwing > 0) {
      return {
        dominantFactor: "heat",
        confidence: Math.max(
          morningEval.confidence,
          afternoonEval.confidence,
          0.7
        ),
        secondaryFactors: dedupeSecondary([
          morningEval.dominantFactor,
          afternoonEval.dominantFactor
        ], "heat")
      };
    }
  }

  // 3. Compare severity of dominant factors
  const mDom = morningEval.dominantFactor;
  const aDom = afternoonEval.dominantFactor;

  const mScore = severityRank[mDom] ?? 0;
  const aScore = severityRank[aDom] ?? 0;

  if (mScore > aScore) {
    return {
      dominantFactor: mDom,
      confidence: morningEval.confidence,
      secondaryFactors: morningEval.secondaryFactors
    };
  }

  if (aScore > mScore) {
    return {
      dominantFactor: aDom,
      confidence: afternoonEval.confidence,
      secondaryFactors: afternoonEval.secondaryFactors
    };
  }

  // 4. Equal severity but different type → lean afternoon
  return {
    dominantFactor: aDom,
    confidence: afternoonEval.confidence,
    secondaryFactors: afternoonEval.secondaryFactors
  };
}

function dedupeSecondary(list, dominant) {
  return Array.from(new Set(list.filter(f => f && f !== dominant))).slice(0, 2);
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
}
