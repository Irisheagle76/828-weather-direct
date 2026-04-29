// ============================================================
// NARRATIVE ASSEMBLER — v11 (FULL CLEAN, NO LOSS)
// ============================================================

import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { phrases } from "./phrases.js";
import { buildBullets } from "./bullets.js";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const random = arr =>
  Array.isArray(arr) && arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : "";

const maybe = (p = 0.5) => Math.random() < p;

// ------------------------------------------------------------
// CATEGORY TEMPLATE
// ------------------------------------------------------------
function getCategoryTemplate(category, isGoldilocks) {
  if (isGoldilocks) return categories.goldilocks;
  return categories[category] || categories.comfortable;
}

// ------------------------------------------------------------
// SAFE SIGNAL RESOLUTION (KEY FIX)
// supports BOTH signals + flat structure
// ------------------------------------------------------------
function getTemp(intel) {
  return (
    intel?.signals?.temp ??
    intel?.temperature ??
    intel?.temp ??
    70
  );
}

function getDewpoint(intel) {
  return (
    intel?.signals?.dewPoint ??
    intel?.dewpoint ??
    intel?.dewpointF ??
    55
  );
}

function getWind(intel) {
  return (
    intel?.signals?.wind ??
    intel?.signals?.windSpeed ??
    intel?.windSpeed ??
    0
  );
}

function getGust(intel) {
  return intel?.signals?.windGust ?? intel?.windGust ?? 0;
}

function getCloud(intel) {
  return (
    intel?.signals?.cloudCover ??
    intel?.cloudCover ??
    intel?.clouds ??
    50
  );
}

// ------------------------------------------------------------
// PHRASE PICKERS
// ------------------------------------------------------------
function pickTempPhrase(intel) {
  const t = getTemp(intel);

  if (t <= 35) return random(phrases.temperature.cold);
  if (t <= 50) return random(phrases.temperature.cool);
  if (t <= 75) return random(phrases.temperature.neutral);
  if (t <= 88) return random(phrases.temperature.warm);
  return random(phrases.temperature.hot);
}

function pickMoisturePhrase(intel) {
  const dp = getDewpoint(intel);

  if (dp < 50) return random(phrases.moisture.dry);
  if (dp < 60) return random(phrases.moisture.neutral);
  if (dp < 67) return random(phrases.moisture.humid);
  return random(phrases.moisture.muggy);
}

function pickWindPhrase(intel) {
  const gust = getGust(intel);
  const wind = getWind(intel);

  if (gust >= 30) return random(phrases.wind.gusty);
  if (wind >= 15) return random(phrases.wind.windy);
  if (wind >= 7) return random(phrases.wind.breezy);
  return random(phrases.wind.calm);
}

function pickLightPhrase(intel) {
  const cloud = getCloud(intel);

  if (cloud > 80) return random(phrases.light.overcast);
  if (cloud < 30) return random(phrases.light.sunny);
  return random(phrases.light.filtered);
}

// ------------------------------------------------------------
// EMOJI (UNCHANGED — STILL VALID)
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
// CLEAN NARRATIVE BUILDER
// ------------------------------------------------------------
function buildNarrative(intel, dayType, category, isGoldilocks) {
  const safeIntel = intel ?? {};

  const temporalFrame = temporal.choose(dayType, isGoldilocks);
  const base = getCategoryTemplate(category, isGoldilocks);

  const score = safeIntel?.score ?? 75;

  // ------------------------------------------------------------
  // CATEGORY FIRST (PRIMARY VOICE)
  // ------------------------------------------------------------
  const categoryBase = random(base.headlines)

  // ------------------------------------------------------------
  // SCORE (LIGHT INFLUENCE — NOT OVERRIDING)
  // ------------------------------------------------------------
  const scoreTone = random(getScoreTone(score));

const baseNarrative =
  score >= 90 && maybe(0.3) && !categoryBase.includes("good")
    ? scoreTone
    : categoryBase;

  const intro = `${temporalFrame} ${
    baseNarrative.charAt(0).toLowerCase() + baseNarrative.slice(1)
  }`;

// ------------------------------------------------------------
// CORE SIGNALS
// ------------------------------------------------------------
let temp = pickTempPhrase(safeIntel);

// Reduce repetition (comfortable → mild)
if (/comfortable/i.test(temp) && /comfortable/i.test(categoryBase)) {
  temp = temp.replace(/comfortable/i, "mild");
}

const moisture = pickMoisturePhrase(safeIntel);
const wind = pickWindPhrase(safeIntel);
const light = pickLightPhrase(safeIntel);

// Prioritize top 2 core signals
const core = [temp, moisture, wind].filter(Boolean).slice(0, 2);

let narrative = intro;

// ------------------------------------------------------------
// CORE PHRASE JOINER
// ------------------------------------------------------------
const joinPhrases = (arr) => {
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(", ")}, and ${arr[arr.length - 1]}`;
};

// ------------------------------------------------------------
// CONNECTOR VARIATION
// ------------------------------------------------------------
if (core.length) {
  const connectors = ["with", "bringing", "featuring"];
  const connector = random(connectors);

const connectors = [
  "with",
  "featuring",
  "highlighted by"
];

const connector = random(connectors);

// 👇 CRITICAL FIX: remove gerund stacking
const cleanedCore = core.map(p =>
  p.replace(/^temperatures\s+holding/i, "temperatures hold")
);

narrative += `, ${connector} ${joinPhrases(cleanedCore)}`;
}

// ------------------------------------------------------------
// LIGHT / SKY ADDITION
// ------------------------------------------------------------
if (light && maybe(0.5)) {
 const lightJoiners = ["with", "and", "along with"];
  const joiner = random(lightJoiners);

  narrative += core.length
    ? `, ${joiner} ${light}`
    : `, ${light}`;
}

// ------------------------------------------------------------
// FINALIZE
// ------------------------------------------------------------
narrative += ".";

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

    const narrativeObj = buildNarrative(
      intel,
      dayType,
      category,
      isGoldilocks
    );

    console.log("ASSEMBLE OUTPUT:", narrativeObj.narrative);

    return {
      emoji: buildEmoji(intel),
      headline: null,

      narrative: narrativeObj.narrative,
      longNarrative: narrativeObj.narrative,

      bullets: buildBullets(intel), // ✅ now correctly external

      category,
      goldilocks: isGoldilocks,
      version: "11.0",

      temporal: narrativeObj.temporal
    };
  }
};

// ------------------------------------------------------------
// SCORE TONE (KEPT — BUT USED LIGHTLY)
// ------------------------------------------------------------
function getScoreTone(score = 75) {
  if (score >= 92) {
    return ["about as good as it gets", "a near-perfect day", "hard to beat"];
  }
  if (score >= 85) {
    return ["a really nice day", "easy to be outside"];
  }
  if (score >= 75) {
    return ["a pretty comfortable day", "generally comfortable"];
  }
  if (score >= 65) {
    return ["a few small quirks show up", "some ups and downs"];
  }
  if (score >= 55) {
    return ["a bit uneven at times", "comfort dips here and there"];
  }
  if (score >= 40) {
    return ["a tougher setup overall", "noticeable discomfort"];
  }
  return ["a rough day overall", "conditions are hard to ignore"];
}