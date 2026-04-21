// ============================================================
// NARRATIVE ASSEMBLER — v10 (VOICE-FIRST, CLEAN)
// ============================================================

import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { phrases } from "./phrases.js";
import { buildBullets } from "./bullets.js";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const random = arr => arr?.length ? arr[Math.floor(Math.random() * arr.length)] : "";
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
function getWind(intel) {
  return intel?.signals?.wind ?? intel?.signals?.windSpeed ?? 0;
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

// ------------------------------------------------------------
// EMOJI
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
// BULLETS (UNCHANGED — already solid)
// ------------------------------------------------------------
function buildBullets(intel) {
  const { signals = {}, dominantFactor } = intel ?? {};
  const bullets = [];

  const t = signals.temp;
  const dp = signals.dewPoint;
  const wind = signals.wind ?? signals.windSpeed ?? 0;

  if (t <= 45) bullets.push("Cool temperatures add a noticeable chill.");
  else if (t >= 80) bullets.push("Warm temperatures begin to impact comfort.");

  if (dp < 50) bullets.push("Dry air makes conditions feel crisp.");
  else if (dp > 65) bullets.push("Humidity adds weight to the air.");

  if (wind > 12) bullets.push("A steady breeze affects how it feels.");
  else if (wind < 4) bullets.push("Winds remain light.");

  if (!bullets.length) {
    switch (dominantFactor) {
      case "heat": bullets.push("Warm temperatures shape the overall feel."); break;
      case "cold": bullets.push("Cool air dominates the feel."); break;
      case "wind": bullets.push("Wind is the primary factor."); break;
      default: bullets.push("Conditions remain relatively steady.");
    }
  }

  return bullets.slice(0, 3);
}

// ------------------------------------------------------------
// CLEAN NARRATIVE BUILDER (VOICE + SCORE ALIGNED)
// ------------------------------------------------------------
function buildNarrative(intel, dayType, category, isGoldilocks) {
  const safeIntel = intel ?? {};

  const temporalFrame = temporal.choose(dayType, isGoldilocks);
  const base = getCategoryTemplate(category, isGoldilocks);

  const score = safeIntel?.score ?? 75;

  // ------------------------------------------------------------
  // SCORE + CATEGORY BLEND (important)
  // ------------------------------------------------------------
  const categoryBase = random(base.narratives) || "";
  const scoreBase = random(getScoreTone(score)) || "";

  const baseNarrative =
    score >= 80 && scoreBase
      ? scoreBase
      : categoryBase;

  // normalize casing after temporal (only if needed)
  const intro = `${temporalFrame} ${
    baseNarrative.charAt(0).toLowerCase() + baseNarrative.slice(1)
  }`;

  // ------------------------------------------------------------
  // CORE SIGNALS (LIMITED)
  // ------------------------------------------------------------
  const temp = pickTempPhrase(safeIntel);
  const moisture = pickMoisturePhrase(safeIntel);
  const wind = pickWindPhrase(safeIntel);
  const light = pickLightPhrase(safeIntel);

  // prioritize strongest signals
  const candidates = [temp, moisture, wind].filter(Boolean).slice(0, 2);

  let narrative = intro;

  // ------------------------------------------------------------
  // SUPPORT PHRASES (CONTROLLED)
  // ------------------------------------------------------------
  if (candidates.length === 1) {
    narrative += `, with ${candidates[0]}`;
  } else if (candidates.length === 2) {
    narrative += `, with ${candidates[0]} and ${candidates[1]}`;
  }

  // optional sky layer (light touch)
  if (light && maybe(0.5)) {
    narrative += candidates.length
      ? `, and ${light}`
      : `, with ${light}`;
  }

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

    // DEBUG (remove later if you want)
    console.log("ASSEMBLE OUTPUT:", narrativeObj.narrative);

    return {
      emoji: "🌤️", // handled elsewhere if needed
      headline: null,

      narrative: narrativeObj.narrative,
      longNarrative: narrativeObj.narrative,

      bullets: buildBullets(intel), // ✅ FIXED

      category,
      goldilocks: isGoldilocks,
      version: "10.0",

      temporal: narrativeObj.temporal
    };
  }
};

function getScoreTone(score = 75) {
  if (score >= 92) {
    return ["about as good as it gets", "a near-perfect day", "hard to beat"];
  }
  if (score >= 85) {
    return ["a really nice day", "very comfortable overall", "easy to be outside"];
  }
  if (score >= 75) {
    return ["a comfortable, steady day", "generally comfortable overall", "a pretty nice setup"];
  }
  if (score >= 65) {
    return ["a decent day with a few small quirks", "some minor ups and downs", "not perfect, but manageable"];
  }
  if (score >= 55) {
    return ["a few rough edges show up", "conditions feel a bit uneven", "comfort dips at times"];
  }
  if (score >= 40) {
    return ["a tougher setup overall", "noticeable discomfort at times", "not especially comfortable"];
  }
  return ["a rough day overall", "conditions are hard to ignore", "comfort takes a hit"];
}