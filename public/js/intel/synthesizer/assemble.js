// ============================================================
// NARRATIVE ASSEMBLER — v6 (FULLY INTEL-DRIVEN)
// ============================================================

import { phrases } from "./phrases.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const random = arr => arr[Math.floor(Math.random() * arr.length)];

// ------------------------------------------------------------
// PHRASE HELPERS (INTEL-DRIVEN)
// ------------------------------------------------------------
function pickTempPhrase(intel) {
  const f = intel.dominantFactor;

  if (f === "cold") return random(phrases.temperature.cold);
  if (f === "heat") return random(phrases.temperature.hot);

  return random(phrases.temperature.neutral);
}

function pickMoisturePhrase(intel) {
  const f = intel.dominantFactor;

  if (f === "muggy") return random(phrases.moisture.muggy);
  if (f === "humidity") return random(phrases.moisture.humid);

  return random(phrases.moisture.neutral);
}

function pickWindPhrase(intel) {
  if (intel.secondaryFactors?.includes("wind")) {
    return random(phrases.wind.breezy);
  }

  return random(phrases.wind.calm);
}

function pickLightPhrase(intel) {
  const f = intel.dominantFactor;

  if (f === "rain" || f === "fog") {
    return random(phrases.light.overcast);
  }

  if (f === "sun") {
    return random(phrases.light.sunny);
  }

  return random(phrases.light.filtered);
}

function pickPatternPhrase(intel) {
  if (intel.confidence < 0.4) {
    return random(phrases.pattern.variable);
  }

  if (intel.confidence > 0.7) {
    return random(phrases.pattern.stable);
  }

  return random(phrases.pattern.transitional);
}

// ------------------------------------------------------------
// CATEGORY TEMPLATE (tone only)
// ------------------------------------------------------------
function getCategoryTemplate(category, isGoldilocks) {
  if (isGoldilocks) return categories.goldilocks;
  return categories[category] || categories.comfortable;
}

// ------------------------------------------------------------
// EMOJI
// ------------------------------------------------------------
function buildEmoji(intel) {
  switch (intel.dominantFactor) {
    case "rain": return "🌧️";
    case "snow": return "❄️";
    case "wind": return "💨";
    case "heat": return "🥵";
    case "cold": return "🥶";
    case "muggy": return "😓";
    case "fog": return "🌫️";
    case "sun": return "😎";
    default: return "😐";
  }
}

// ------------------------------------------------------------
// HEADLINE
// ------------------------------------------------------------
function buildHeadline(intel, category, isGoldilocks) {
  const base = getCategoryTemplate(category, isGoldilocks);
  const baseHeadline = random(base.headlines);

  const f = intel.dominantFactor;

  if (f === "rain") return `${baseHeadline} with steady rain`;
  if (f === "wind") return `${baseHeadline} with noticeable wind`;
  if (f === "heat") return `${baseHeadline} with building warmth`;
  if (f === "cold") return `${baseHeadline} with a cool edge`;

  return baseHeadline;
}

// ------------------------------------------------------------
// BULLETS
// ------------------------------------------------------------
function buildBullets(intel) {
  const { dominantFactor, secondaryFactors, confidence } = intel;

  const bullets = [];

  // Primary
  switch (dominantFactor) {
    case "rain":
      bullets.push("Rain plays a steady role through the period.");
      break;
    case "wind":
      bullets.push("Wind is a consistent factor affecting comfort.");
      break;
    case "heat":
      bullets.push("Warm temperatures shape the overall feel.");
      break;
    case "cold":
      bullets.push("Cool conditions dominate much of the time.");
      break;
    case "muggy":
      bullets.push("Moisture in the air adds a heavier feel.");
      break;
    case "fog":
      bullets.push("Reduced visibility is a recurring feature.");
      break;
    default:
      bullets.push("Conditions are shaped by multiple subtle factors.");
  }

  // Secondary
  if (secondaryFactors?.includes("wind")) {
    bullets.push("Breezes add variability at times.");
  }

  if (secondaryFactors?.includes("rain")) {
    bullets.push("Occasional precipitation mixes in.");
  }

  if (secondaryFactors?.includes("muggy")) {
    bullets.push("Humidity adds a slight heaviness at times.");
  }

  // Variability
  if (confidence < 0.4) {
    bullets.push("Conditions shift rather than staying consistent.");
  }

  return bullets.slice(0, 3);
}

// ------------------------------------------------------------
// NARRATIVE
// ------------------------------------------------------------
function buildNarrative(intel, dayType, category, isGoldilocks) {
  const temporalFrame = temporal.choose(dayType, isGoldilocks);

  const tempPhrase = pickTempPhrase(intel);
  const moisturePhrase = pickMoisturePhrase(intel);
  const windPhrase = pickWindPhrase(intel);
  const lightPhrase = pickLightPhrase(intel);
  const patternPhrase = pickPatternPhrase(intel);

  const f = intel.dominantFactor;

  let driverLine;

  switch (f) {
    case "rain":
      driverLine = "Rain is the main driver of how it feels.";
      break;
    case "wind":
      driverLine = "Wind plays a major role in the overall feel.";
      break;
    case "heat":
      driverLine = "Warmth is the defining feature of the period.";
      break;
    case "cold":
      driverLine = "Cool conditions define much of the experience.";
      break;
    case "muggy":
      driverLine = "Humidity shapes the feel of the air.";
      break;
    case "fog":
      driverLine = "Low visibility influences conditions.";
      break;
    default:
      driverLine = "No single factor dominates completely.";
  }

  const sentence1 = `${temporalFrame} ${tempPhrase} and ${moisturePhrase}.`;
  const sentence2 = `${driverLine}`;
  const sentence3 = `${lightPhrase} and ${windPhrase}, with ${patternPhrase}.`;

  return {
    narrative: `${sentence1} ${sentence2} ${sentence3}`,
    temporal: temporalFrame
  };
}

// ------------------------------------------------------------
// MASTER
// ------------------------------------------------------------
export const assemble = {
  assemble(intel, dayType, category, isGoldilocks) {
    const narrativeObj = buildNarrative(intel, dayType, category, isGoldilocks);

    return {
      emoji: buildEmoji(intel),

      headline: buildHeadline(intel, category, isGoldilocks),

      notes: narrativeObj.narrative,

      bullets: buildBullets(intel),

      category,
      goldilocks: isGoldilocks,
      version: "6.0",

      temporal: narrativeObj.temporal
    };
  }
};