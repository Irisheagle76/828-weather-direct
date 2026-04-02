// index.js
// ============================================================
// SYNTHESIZER ORCHESTRATOR (v4.1)
// Human‑Action category engine + Goldilocks + narrative assembly
// ============================================================

console.log("SYNTHESIZER VERSION: 4.1");

import { assemble } from "./assemble.js";
import { contrast } from "./contrast.js";
import { emojiPools } from "./emojis.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { bulletPools } from "./bullets.js";

// ------------------------------------------------------------
// HUMAN‑ACTION CATEGORY DETECTOR (v2.3)
// ------------------------------------------------------------
function detectCategory(intel) {
  if (!intel || !intel.snapshot) return "comfortable";

  const s = intel.snapshot;

  const temp = s.temp ?? null;
  const dew = s.dewPoint ?? null;
  const humidity = s.humidity ?? null;
  const wind = s.windSpeed ?? null;
  const gust = s.windGust ?? null;
  const precip = s.precipType ?? "";
  const fogValley = intel.valleyFogRisk ?? false;
  const fogRidge = intel.ridgeFogRisk ?? false;
  const smoke = intel.smokeIndex ?? 0;
  const frost = intel.frostRisk ?? false;
  const freeze = intel.freezeRisk ?? false;
  const blackIce = intel.blackIceRisk ?? false;

  // GOLDILOCKS (premium mode)
  const isGoldilocks =
    wind < 5 &&
    humidity < 60 &&
    dew < 55 &&
    !precip &&
    !fogValley &&
    !fogRidge &&
    smoke < 20 &&
    !frost &&
    !freeze &&
    !blackIce;

  if (isGoldilocks) return "veryComfortable";

  // HARSH (any impactful hazard)
  if (
    wind >= 30 ||
    gust >= 40 ||
    dew >= 70 ||
    humidity >= 90 ||
    precip === "heavy" ||
    fogRidge ||
    smoke >= 60 ||
    frost ||
    freeze ||
    blackIce
  ) {
    return "harsh";
  }

  // UNCOMFORTABLE (clear, persistent stressors)
  if (
    wind >= 20 ||
    dew >= 65 ||
    humidity >= 80 ||
    precip === "moderate" ||
    fogValley ||
    smoke >= 40
  ) {
    return "uncomfortable";
  }

  // SLIGHTLY UNCOMFORTABLE (mild stressors)
  if (
    wind >= 10 ||
    dew >= 60 ||
    humidity >= 70 ||
    precip === "light" ||
    smoke >= 20
  ) {
    return "slightlyUncomfortable";
  }

  // COMFORTABLE (default)
  return "comfortable";
}

// ------------------------------------------------------------
// GOLDILOCKS DETECTOR (boolean flag)
// ------------------------------------------------------------
function detectGoldilocks(intel) {
  if (!intel || !intel.snapshot) return false;

  const s = intel.snapshot;

  return (
    s.windSpeed < 5 &&
    s.humidity < 60 &&
    s.dewPoint < 55 &&
    !s.precipType &&
    !intel.valleyFogRisk &&
    !intel.ridgeFogRisk &&
    (intel.smokeIndex ?? 0) < 20 &&
    !intel.frostRisk &&
    !intel.freezeRisk &&
    !intel.blackIceRisk
  );
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
  // 1. Detect categories (Human‑Action v2.3)
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