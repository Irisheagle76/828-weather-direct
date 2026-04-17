// ============================================================
// NARRATIVE ASSEMBLER — v9 (CLEAN + SUPPORT ROLE)
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
// SIGNAL PICKERS (SAFE + NORMALIZED)
// ------------------------------------------------------------
function getWind(intel) {
  return (
    intel?.signals?.wind ??
    intel?.signals?.windSpeed ??
    0
  );
}

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
  const wind = getWind(intel);

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
// EMOJI (kept — still useful)
// ------------------------------------------------------------
function buildEmoji(intel) {
  switch (intel?.dominantFactor) {
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
// BULLETS (clean + reusable)
// ------------------------------------------------------------
function buildBullets(intel) {
  const { dominantFactor, secondaryFactors, confidence } = intel ?? {};
  const bullets = [];

  switch (dominantFactor) {
    case "rain": bullets.push("Rain plays a steady role."); break;
    case "wind": bullets.push("Wind affects how it feels."); break;
    case "heat": bullets.push("Warm temperatures shape conditions."); break;
    case "cold": bullets.push("Cool conditions dominate."); break;
    case "muggy": bullets.push("Humidity adds a heavier feel."); break;
    case "fog": bullets.push("Reduced visibility at times."); break;
    default: bullets.push("Conditions are generally stable.");
  }

  if (secondaryFactors?.includes("wind"))
    bullets.push("Breezes add some variation.");

  if (secondaryFactors?.includes("rain"))
    bullets.push("Occasional precipitation possible.");

  if (secondaryFactors?.includes("muggy"))
    bullets.push("Humidity fluctuates at times.");

  if (confidence < 0.4)
    bullets.push("Conditions may shift through the period.");

  return bullets.slice(0, 3);
}

// ------------------------------------------------------------
// LONG NARRATIVE (PRIMARY PURPOSE NOW)
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
    rain: "Rain plays the central role.",
    wind: "Wind shapes the experience.",
    heat: "Heat stands out the most.",
    cold: "Cool air defines the feel.",
    muggy: "Humidity drives the feel.",
    fog: "Low visibility is a factor."
  };

  const driver = isGoldilocks
    ? "No single factor dominates — things stay balanced."
    : DRIVER_MAP[safeIntel.dominantFactor] ||
      "No single factor dominates.";

  const intro = `${temporalFrame} ${baseNarrative}`;

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
// MASTER (SIMPLIFIED ROLE)
// ------------------------------------------------------------
export const assemble = {
  assemble(intel, dayType, category, isGoldilocks) {
    const narrativeObj = buildNarrative(intel, dayType, category, isGoldilocks);

    return {
      emoji: buildEmoji(intel),

      // ❌ headline removed (handled by unified voice system)
      headline: null,

      longNarrative: narrativeObj.narrative,
      bullets: buildBullets(intel),

      category,
      goldilocks: isGoldilocks,
      version: "9.0",

      temporal: narrativeObj.temporal
    };
  }
};