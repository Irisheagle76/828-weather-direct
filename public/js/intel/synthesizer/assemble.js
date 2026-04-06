// ============================================================
// NARRATIVE ASSEMBLER — v8.1 (FULLY SAFE + CLEAN)
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
// SIGNAL PICKERS (SAFE)
// ------------------------------------------------------------

function pickTempPhrase(intel) {
  const t = intel?.signals?.temp ?? 70;

  if (t <= 35) return random(phrases.temperature.cold);
  if (t <= 50) return random(phrases.temperature.cool);
  if (t <= 75) return random(phrases.temperature.neutral);
  if (t <= 88) return random(phrases.temperature.warm);
  return random(phrases.temperature.hot);
}

function pickMoisturePhrase(intel) {
  const dp = intel?.signals?.dewPoint ?? 55;

  if (dp < 50) return random(phrases.moisture.dry);
  if (dp < 60) return random(phrases.moisture.neutral);
  if (dp < 67) return random(phrases.moisture.humid);
  return random(phrases.moisture.muggy);
}

function pickWindPhrase(intel) {
  const gust = intel?.signals?.windGust ?? 0;
  const wind = intel?.signals?.windSpeed ?? 0;

  if (gust >= 30) return random(phrases.wind.gusty);
  if (wind >= 15) return random(phrases.wind.windy);
  if (wind >= 7) return random(phrases.wind.breezy);
  return random(phrases.wind.calm);
}

function pickLightPhrase(intel) {
  const cloud = intel?.signals?.cloudCover ?? 50;

  if (cloud > 80) return random(phrases.light.overcast);
  if (cloud < 30) return random(phrases.light.sunny);
  return random(phrases.light.filtered);
}

function pickMicroPhrase(intel) {
  const confidence = intel?.confidence ?? 0.5;

  if (confidence < 0.4)
    return random(phrases.microclimate.mixed);

  return maybe(0.5)
    ? random(phrases.microclimate.valley)
    : random(phrases.microclimate.ridge);
}

function pickPatternPhrase(intel) {
  const confidence = intel?.confidence ?? 0.5;

  if (confidence < 0.4)
    return random(phrases.pattern.variable);

  if (confidence > 0.7)
    return random(phrases.pattern.stable);

  return random(phrases.pattern.transitional);
}

function pickEdgePhrase(intel) {
  const confidence = intel?.confidence ?? 0.5;

  if (confidence < 0.5 && maybe(0.4)) {
    return random(phrases.edges);
  }
  return null;
}

// ------------------------------------------------------------
// EMOJI
// ------------------------------------------------------------
function buildEmoji(intel) {
  const f = intel?.dominantFactor;

  switch (f) {
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
  const safeIntel = intel ?? {};
  const base = getCategoryTemplate(category, isGoldilocks);

  let headline = random(base.headlines);

  if (!isGoldilocks) {
    const f = safeIntel.dominantFactor;

    if (f === "rain") headline += " with periods of rain";
    if (f === "wind") headline += " with noticeable wind";
    if (f === "heat") headline += " with building heat";
    if (f === "cold") headline += " with a cool edge";
  }

  return headline;
}

// ------------------------------------------------------------
// BULLETS
// ------------------------------------------------------------
function buildBullets(intel) {
  const safeIntel = intel ?? {};
  const { dominantFactor, secondaryFactors, confidence } = safeIntel;

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
// NARRATIVE
// ------------------------------------------------------------
function buildNarrative(intel, dayType, category, isGoldilocks) {
  const safeIntel = intel ?? {};

  const temporalFrame = temporal.choose(dayType, isGoldilocks);
  const base = getCategoryTemplate(category, isGoldilocks);
  const baseNarrative = random(base.narratives);

  const temp = pickTempPhrase(safeIntel);
  const moisture = pickMoisturePhrase(safeIntel);
  const wind = pickWindPhrase(safeIntel);
  const light = pickLightPhrase(safeIntel);
  const micro = pickMicroPhrase(safeIntel);
  const pattern = pickPatternPhrase(safeIntel);
  const edge = pickEdgePhrase(safeIntel);

  const DRIVER_MAP = {
    rain: "Rain plays the central role in how it feels.",
    wind: "Wind shapes the overall experience.",
    heat: "Heat becomes the defining feature.",
    cold: "Cool air defines the overall feel.",
    muggy: "Humidity drives the heavier feel.",
    fog: "Low visibility influences conditions."
  };

  const driver = isGoldilocks
    ? "No single factor stands out — everything remains in balance."
    : DRIVER_MAP[safeIntel.dominantFactor] ||
      "No single factor fully dominates.";

  const intro = `${temporalFrame} ${baseNarrative}`;

  // ✅ CLEAN DETAIL HANDLING
  const detailParts = [temp, moisture].filter(Boolean);

  let detail = "";
  if (detailParts.length === 2) {
    detail = maybe(0.8)
      ? `${detailParts[0]}, with ${detailParts[1]}.`
      : `${detailParts[1]}, paired with ${detailParts[0]}.`;
  } else if (detailParts.length === 1) {
    detail = `${detailParts[0]}.`;
  }

  const support = `${light}, ${wind}, and ${pattern}.`;

  const optionalParts = [
    maybe(0.6) ? `${micro}.` : null,
    edge ? `${edge}.` : null
  ].filter(Boolean);

  const narrative = [
    intro,
    detail,
    driver,
    support,
    ...optionalParts
  ].join(" ");

  return {
    narrative: narrative.trim(),
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
      version: "8.1",

      temporal: narrativeObj.temporal
    };
  }
};