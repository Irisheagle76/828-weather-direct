// ============================================================
// NARRATIVE ASSEMBLER — v8 (SIGNAL-AWARE INTELLIGENCE)
// Category-driven + intensity-scaled phrasing
// ============================================================

import { phrases } from "./phrases.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const random = arr => arr[Math.floor(Math.random() * arr.length)];
const maybe = (p = 0.5) => Math.random() < p;

// ------------------------------------------------------------
// CATEGORY TEMPLATE
// ------------------------------------------------------------
function getCategoryTemplate(category, isGoldilocks) {
  if (isGoldilocks) return categories.goldilocks;
  return categories[category] || categories.comfortable;
}

// ------------------------------------------------------------
// SIGNAL-DRIVEN PICKERS (🔥 KEY UPGRADE)
// ------------------------------------------------------------

// --- TEMPERATURE ---
function pickTempPhrase(intel) {
  const t = intel.signals?.temp ?? 70;

  if (t <= 35) return random(phrases.temperature.cold);
  if (t <= 50) return random(phrases.temperature.cool);
  if (t <= 75) return random(phrases.temperature.neutral);
  if (t <= 88) return random(phrases.temperature.warm);
  return random(phrases.temperature.hot);
}

// --- MOISTURE (dew point driven) ---
function pickMoisturePhrase(intel) {
  const dp = intel.signals?.dewPoint ?? 55;

  if (dp < 50) return random(phrases.moisture.dry);
  if (dp < 60) return random(phrases.moisture.neutral);
  if (dp < 67) return random(phrases.moisture.humid);
  return random(phrases.moisture.muggy);
}

// --- WIND ---
function pickWindPhrase(intel) {
  const gust = intel.signals?.windGust ?? 0;
  const wind = intel.signals?.windSpeed ?? 0;

  if (gust >= 30) return random(phrases.wind.gusty);
  if (wind >= 15) return random(phrases.wind.windy);
  if (wind >= 7) return random(phrases.wind.breezy);
  return random(phrases.wind.calm);
}

// --- LIGHT ---
function pickLightPhrase(intel) {
  const cloud = intel.signals?.cloudCover ?? 50;

  if (cloud > 80) return random(phrases.light.overcast);
  if (cloud < 30) return random(phrases.light.sunny);
  return random(phrases.light.filtered);
}

// --- MICROCLIMATE ---
function pickMicroPhrase(intel) {
  if (intel.confidence > 0.7)
    return random(phrases.microclimate.stable);

  if (intel.confidence < 0.4)
    return random(phrases.microclimate.mixed);

  return maybe(0.5)
    ? random(phrases.microclimate.valley)
    : random(phrases.microclimate.ridge);
}

// --- PATTERN ---
function pickPatternPhrase(intel) {
  if (intel.confidence < 0.4)
    return random(phrases.pattern.variable);

  if (intel.confidence > 0.7)
    return random(phrases.pattern.stable);

  return random(phrases.pattern.transitional);
}

// --- EDGE (NEW POWER) ---
function pickEdgePhrase(intel) {
  if (intel.confidence < 0.5 && maybe(0.4)) {
    return random(phrases.edges);
  }
  return null;
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
  let headline = random(base.headlines);

  if (!isGoldilocks) {
    const f = intel.dominantFactor;

    if (f === "rain") headline += " with periods of rain";
    if (f === "wind") headline += " with noticeable wind";
    if (f === "heat") headline += " with building heat";
    if (f === "cold") headline += " with a cool edge";
  }

  return headline;
}

// ------------------------------------------------------------
// BULLETS (UNCHANGED)
// ------------------------------------------------------------
function buildBullets(intel) {
  const { dominantFactor, secondaryFactors, confidence } = intel;

  const bullets = [];

  switch (dominantFactor) {
    case "rain": bullets.push("Rain plays a steady role through the period."); break;
    case "wind": bullets.push("Wind is a consistent factor affecting comfort."); break;
    case "heat": bullets.push("Warm temperatures shape the overall feel."); break;
    case "cold": bullets.push("Cool conditions dominate much of the time."); break;
    case "muggy": bullets.push("Moisture in the air adds a heavier feel."); break;
    case "fog": bullets.push("Reduced visibility is a recurring feature."); break;
    default: bullets.push("Conditions are shaped by multiple subtle factors.");
  }

  if (secondaryFactors?.includes("wind"))
    bullets.push("Breezes add variability at times.");

  if (secondaryFactors?.includes("rain"))
    bullets.push("Occasional precipitation mixes in.");

  if (secondaryFactors?.includes("muggy"))
    bullets.push("Humidity adds a slight heaviness at times.");

  if (confidence < 0.4)
    bullets.push("Conditions shift rather than staying consistent.");

  return bullets.slice(0, 3);
}

// ------------------------------------------------------------
// NARRATIVE (FULLY WIRED)
// ------------------------------------------------------------
function buildNarrative(intel, dayType, category, isGoldilocks) {
  const temporalFrame = temporal.choose(dayType, isGoldilocks);

  const base = getCategoryTemplate(category, isGoldilocks);
  const baseNarrative = random(base.narratives);

  const temp = pickTempPhrase(intel);
  const moisture = pickMoisturePhrase(intel);
  const wind = pickWindPhrase(intel);
  const light = pickLightPhrase(intel);
  const micro = pickMicroPhrase(intel);
  const pattern = pickPatternPhrase(intel);
  const edge = pickEdgePhrase(intel);

  let driver;

  if (isGoldilocks) {
    driver = "No single factor stands out — everything remains in balance.";
  } else {
    switch (intel.dominantFactor) {
      case "rain": driver = "Rain plays the central role in how it feels."; break;
      case "wind": driver = "Wind shapes the overall experience."; break;
      case "heat": driver = "Heat becomes the defining feature."; break;
      case "cold": driver = "Cool air defines the overall feel."; break;
      case "muggy": driver = "Humidity drives the heavier feel."; break;
      case "fog": driver = "Low visibility influences conditions."; break;
      default: driver = "No single factor fully dominates.";
    }
  }

  const intro = `${temporalFrame} ${baseNarrative}`;

  const detail = maybe(0.8)
    ? `${temp}, with ${moisture}.`
    : `${moisture}, paired with ${temp}.`;

  const support = `${light}, ${wind}, and ${pattern}.`;

  const terrain = maybe(0.6) ? `${micro}.` : "";
  const variability = edge ? `${edge}.` : "";

  return {
    narrative: `${intro} ${detail} ${driver} ${support} ${terrain} ${variability}`.trim(),
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
      version: "8.0",

      temporal: narrativeObj.temporal
    };
  }
};