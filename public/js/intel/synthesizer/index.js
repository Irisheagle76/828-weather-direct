// ============================================================
// SYNTHESIZER ORCHESTRATOR — v7 (PRECIP + BULLET SYNC)
// Adds dominant precip driver + bullet reconciliation
// ============================================================

console.log("SYNTHESIZER VERSION: 7.0");

import { assemble } from "./assemble.js";
import { contrast } from "./contrast.js";
import { emojiPools } from "./emojis.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { buildBullets } from "./bullets.js";

// ------------------------------------------------------------
// 🌧️ PRECIP + BULLET SYNC HELPERS
// ------------------------------------------------------------
function getPrecipSignal(intel) {
  const pop = intel?.precipProbability ?? 0;
  const qpf = intel?.precipAmount ?? 0;

  if (pop >= 70 || qpf >= 0.25) return "high";
  if (pop >= 40 || qpf >= 0.05) return "moderate";
  if (pop >= 20) return "low";
  return "none";
}

function buildPrecipNarrative(intel, signal) {
  let headline;
  let narrative;

  if (signal === "high") {
    headline = "Rain moves in tomorrow";
    narrative =
      "Rain will be a defining part of the day, bringing a clear break from the recent dry pattern.";
  }

  if (signal === "moderate") {
    headline = "Rain chances return";
    narrative =
      "Not a washout, but rain will be around at times and noticeable through the day.";
  }

  if (signal === "low") {
    headline = "A few showers possible";
    narrative =
      "Most of the day stays dry, but a few passing showers are possible.";
  }

  if (signal !== "none" && intel?.droughtSignal) {
    narrative += " After such a long dry stretch, even light rain will stand out.";
  }

  return { headline, narrative };
}

function syncBulletsForPrecip(bullets = [], intel, signal) {
  if (signal === "none") return bullets;

  let next = [...(bullets || [])];

  // ------------------------------------------------------------
  // REMOVE CONFLICTING BULLETS
  // ------------------------------------------------------------
  next = next.filter(b =>
    !/perfect|ideal|great outdoor|excellent/i.test(b)
  );

  // ------------------------------------------------------------
  // ADD PRECIP BULLETS (FRONT PRIORITY)
  // ------------------------------------------------------------
  if (signal === "high") {
    next.unshift("Rain likely throughout the day");
  }

  if (signal === "moderate") {
    next.unshift("Periods of rain expected");
  }

  if (signal === "low") {
    next.unshift("A few passing showers possible");
  }

  // ------------------------------------------------------------
  // DROUGHT CONTEXT
  // ------------------------------------------------------------
  if (intel?.droughtSignal && signal !== "none") {
    next.push("Helpful rain after a prolonged dry stretch");
  }

  return next.slice(0, 4);
}

// ------------------------------------------------------------
// CATEGORY DETECTOR (INTEL-DRIVEN)
// ------------------------------------------------------------
function detectCategory(intel) {
  if (!intel) return "comfortable";

  const f = intel.dominantFactor;
  const confidence = intel.confidence ?? 0.5;

  if (
    ["blackIce", "freeze", "freezingFog", "snow", "storms"].includes(f) ||
    confidence > 0.75
  ) {
    return "harsh";
  }

  if (
    ["rain", "coldRain", "warmRain", "mountainWind", "wind"].includes(f)
  ) {
    return "uncomfortable";
  }

  if (
    ["cold", "heat", "humidity", "muggy", "fog"].includes(f)
  ) {
    return "slightlyUncomfortable";
  }

  if (f === "sun" && confidence > 0.5) {
    return "veryComfortable";
  }

  return "comfortable";
}

// ------------------------------------------------------------
// GOLDILOCKS FLAG
// ------------------------------------------------------------
function isGoldilocks(category) {
  return category === "veryComfortable";
}

// ------------------------------------------------------------
// CONTRAST POOLS
// ------------------------------------------------------------
function buildContrastPools(category, isGoldilocksFlag) {
  const cat = isGoldilocksFlag ? categories.goldilocks : categories[category];

  return {
    emojiPool: isGoldilocksFlag
      ? emojiPools.goldilocks
      : emojiPools[category],

    headlinePool: cat.headlines,
    narrativePool: cat.narratives,

    temporalPool: isGoldilocksFlag
      ? [...temporal.goldilocksToday, ...temporal.goldilocksTomorrow]
      : [...temporal.today, ...temporal.tomorrow]
  };
}

// ------------------------------------------------------------
// MASTER GENERATOR
// ------------------------------------------------------------
export function generateNarrative(intelToday, intelTomorrow) {

  // ------------------------------------------------------------
  // 1. CATEGORY
  // ------------------------------------------------------------
  const categoryToday = detectCategory(intelToday);
  const categoryTomorrow = detectCategory(intelTomorrow);

  const goldToday = isGoldilocks(categoryToday);
  const goldTomorrow = isGoldilocks(categoryTomorrow);

  // ------------------------------------------------------------
  // 2. BASE ASSEMBLY
  // ------------------------------------------------------------
  const todayRaw = assemble.assemble(
    intelToday,
    "today",
    categoryToday,
    goldToday
  );

  let tomorrowRaw = assemble.assemble(
    intelTomorrow,
    "tomorrow",
    categoryTomorrow,
    goldTomorrow
  );

  // ------------------------------------------------------------
  // 🌧️ 3. PRECIP DRIVER (NARRATIVE + BULLETS)
  // ------------------------------------------------------------
  const precipSignal = getPrecipSignal(intelTomorrow);

  if (precipSignal === "high" || precipSignal === "moderate") {
    const precip = buildPrecipNarrative(intelTomorrow, precipSignal);

    const syncedBullets = syncBulletsForPrecip(
      tomorrowRaw.bullets,
      intelTomorrow,
      precipSignal
    );

    tomorrowRaw = {
      ...tomorrowRaw,
      headline: precip.headline,
      narrative: precip.narrative,
      longNarrative: precip.narrative,
      bullets: syncedBullets,
      dominantDriver: "precip"
    };
  }

  // ------------------------------------------------------------
  // 4. CONTRAST
  // ------------------------------------------------------------
  const pools = buildContrastPools(categoryTomorrow, goldTomorrow);

  const contrasted = contrast.applyContrast(todayRaw, tomorrowRaw, pools);

  // ------------------------------------------------------------
  // 5. FINAL MERGE (PROTECT NARRATIVE + BULLETS)
  // ------------------------------------------------------------
  const tomorrowFinal = {
    ...contrasted,
    narrative: tomorrowRaw.narrative,
    longNarrative: tomorrowRaw.narrative,
    bullets: tomorrowRaw.bullets
  };

  // ------------------------------------------------------------
  // DEBUG
  // ------------------------------------------------------------
  console.log("PRECIP SIGNAL:", precipSignal);
  console.log("TOMORROW RAW:", tomorrowRaw);
  console.log("TOMORROW FINAL:", tomorrowFinal);

  // ------------------------------------------------------------
  // 6. RETURN
  // ------------------------------------------------------------
  return {
    today: {
      ...todayRaw,
      score: intelToday?.score
    },
    tomorrow: {
      ...tomorrowFinal,
      score: intelTomorrow?.score
    }
  };
}