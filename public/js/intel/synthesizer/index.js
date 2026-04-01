// index.js
// ============================================================
// SYNTHESIZER ORCHESTRATOR
// This is the main entry point for narrative generation.
// It:
//  - Receives intel from your Human-Action engine
//  - Determines comfort category
//  - Detects Goldilocks
//  - Generates Today/Tomorrow narratives via assemble.js
//  - Applies strong diversity rules via contrast.js
//  - Returns final narrative object
// ============================================================
console.log("SYNTHESIZER VERSION: NEW v4");

import { assemble } from "./assemble.js";
import { contrast } from "./contrast.js";
import { emojiPools } from "./emojis.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { bulletPools } from "./bullets.js";

// ------------------------------------------------------------
// CATEGORY DETECTION
// ------------------------------------------------------------
function detectCategory(intel) {
  const score = intel?.comfortScore ?? 0;

  if (intel?.isGoldilocks) return "goldilocks";

  if (score >= 85) return "veryComfortable";
  if (score >= 65) return "comfortable";
  if (score >= 45) return "slightlyUncomfortable";
  if (score >= 25) return "uncomfortable";
  return "harsh";
}

// ------------------------------------------------------------
// GOLDILOCKS DETECTION
// ------------------------------------------------------------
function detectGoldilocks(intel) {
  return intel?.isGoldilocks === true;
}

// ------------------------------------------------------------
// POOL BUNDLER FOR CONTRAST ENGINE
// ------------------------------------------------------------
function buildContrastPools(category, isGoldilocks) {
  const cat = isGoldilocks ? categories.goldilocks : categories[category];

  return {
    emojiPool: isGoldilocks
      ? emojiPools.goldilocks
      : emojiPools[category],

    headlinePool: cat.headlines,
    narrativePool: cat.narratives,

    temporalPool: isGoldilocks
      ? [...temporal.goldilocksToday, ...temporal.goldilocksTomorrow]
      : [...temporal.today, ...temporal.tomorrow],

    bulletPool: isGoldilocks
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
  // 1. Detect categories
  const categoryToday = detectCategory(intelToday);
  const categoryTomorrow = detectCategory(intelTomorrow);

  // 2. Detect Goldilocks
  const goldToday = detectGoldilocks(intelToday);
  const goldTomorrow = detectGoldilocks(intelTomorrow);

  // 3. Generate raw narratives
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

  // 4. Apply strong contrast rules
  const pools = buildContrastPools(categoryTomorrow, goldTomorrow);
  const tomorrowFinal = contrast.applyContrast(todayRaw, tomorrowRaw, pools);

  // 5. Return final objects
  return {
    today: todayRaw,
    tomorrow: tomorrowFinal
  };
}