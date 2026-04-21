// ============================================================
// SYNTHESIZER ORCHESTRATOR — v5 (INTEL-ALIGNED)
// Fully aligned with engine → aggregate → assemble pipeline
// ============================================================

console.log("SYNTHESIZER VERSION: 5.0");

import { assemble } from "./assemble.js";
import { contrast } from "./contrast.js";
import { emojiPools } from "./emojis.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { bulletPools } from "./bullets.js";

// ------------------------------------------------------------
// CATEGORY DETECTOR (INTEL-DRIVEN)
// ------------------------------------------------------------
function detectCategory(intel) {
  if (!intel) return "comfortable";

  const f = intel.dominantFactor;
  const confidence = intel.confidence ?? 0.5;

  // HARSH — strong hazards or high confidence signal
  if (
    ["blackIce", "freeze", "freezingFog", "snow", "storms"].includes(f) ||
    confidence > 0.75
  ) {
    return "harsh";
  }

  // UNCOMFORTABLE — persistent disruptive factors
  if (
    ["rain", "coldRain", "warmRain", "mountainWind", "wind"].includes(f)
  ) {
    return "uncomfortable";
  }

  // SLIGHTLY UNCOMFORTABLE — moderate influence
  if (
    ["cold", "heat", "humidity", "muggy", "fog"].includes(f)
  ) {
    return "slightlyUncomfortable";
  }

  // VERY COMFORTABLE — pleasant dominant conditions
  if (f === "sun" && confidence > 0.5) {
    return "veryComfortable";
  }

  return "comfortable";
}

// ------------------------------------------------------------
// GOLDILOCKS FLAG (DERIVED, NOT DUPLICATED)
// ------------------------------------------------------------
function isGoldilocks(category) {
  return category === "veryComfortable";
}

// ------------------------------------------------------------
// POOL BUNDLER (FOR CONTRAST ENGINE ONLY)
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
      : [...temporal.today, ...temporal.tomorrow],

    bulletPool: isGoldilocksFlag
      ? bulletPools.goldilocks
      : [
          ...bulletPools.temperature,
          ...bulletPools.moisture,
          ...bulletPools.wind,
          ...bulletPools.light,
          ...bulletPools.microclimate,
          ...bulletPools.pattern
        ]
  };
}

// ------------------------------------------------------------
// MASTER GENERATOR
// ------------------------------------------------------------
export function generateNarrative(intelToday, intelTomorrow) {

  // 1. CATEGORY (INTEL-DRIVEN)
  const categoryToday = detectCategory(intelToday);
  const categoryTomorrow = detectCategory(intelTomorrow);

  // 2. GOLDILOCKS (DERIVED FROM CATEGORY)
  const goldToday = isGoldilocks(categoryToday);
  const goldTomorrow = isGoldilocks(categoryTomorrow);

  // 3. BUILD BASE NARRATIVES (FULLY INTEL-DRIVEN)
  const todayRaw = assemble.assemble(
    intelToday,
    "today",
    categoryToday,
    goldToday
  );

  const tomorrowRaw = assemble.assemble(
    intelTomorrow,
    "tomorrow",
    categoryTomorrow,
    goldTomorrow
  );

  // 4. APPLY CONTRAST (OPTIONAL LAYER)
  const pools = buildContrastPools(categoryTomorrow, goldTomorrow);
const contrasted = contrast.applyContrast(todayRaw, tomorrowRaw, pools);

// ✅ KEEP your new narrative
const tomorrowFinal = {
  ...contrasted,
  narrative: tomorrowRaw.narrative,
  longNarrative: tomorrowRaw.narrative
};

  // 5. RETURN FINAL OUTPUT
  return {
    today: todayRaw,
    tomorrow: tomorrowFinal
  };
}