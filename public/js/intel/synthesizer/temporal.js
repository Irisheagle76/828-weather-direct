// temporal.js
// ============================================================
// TEMPORAL FRAMING ENGINE
// Provides day-aware opening phrases for Today vs Tomorrow
// Tone: Warm + professional hybrid
// Flavor: Medium Asheville microclimate
// Diversity: Strong (Option C)
// Goldilocks: Premium mode
// ============================================================

export const temporal = {

  // ------------------------------------------------------------
  // TODAY — STRONG FRAMING
  // ------------------------------------------------------------
  today: [
    "This afternoon brings",
    "Later today features",
    "As the day unfolds, expect",
    "Through the afternoon hours, look for",
    "As the day settles in, conditions show",
    "This evening trends toward",
    "As the day winds down, expect",
    "Through the rest of today, anticipate"
  ],

  // ------------------------------------------------------------
  // TOMORROW — STRONG FRAMING
  // ------------------------------------------------------------
  tomorrow: [
    "Tomorrow morning starts with",
    "By midday tomorrow, expect",
    "Tomorrow brings",
    "As tomorrow unfolds, look for",
    "Tomorrow afternoon trends toward",
    "Through the day tomorrow, anticipate",
    "Tomorrow evening leans toward",
    "Early tomorrow, conditions show"
  ],

  // ------------------------------------------------------------
  // GOLDILOCKS — PREMIUM FRAMING
  // ------------------------------------------------------------
  goldilocksToday: [
    "This afternoon settles into a rare just-right feel with",
    "Later today brings a beautifully balanced setup with",
    "As the day unfolds, conditions land squarely in the Goldilocks zone with",
    "Through the afternoon, expect a remarkably even feel with",
    "This evening trends toward a smooth, just-right pattern with"
  ],

  goldilocksTomorrow: [
    "Tomorrow morning opens in the Goldilocks zone with",
    "By midday tomorrow, conditions stay beautifully balanced with",
    "Tomorrow brings another just-right setup with",
    "As tomorrow unfolds, expect a remarkably even feel with",
    "Tomorrow afternoon trends toward a smooth, just-right pattern with"
  ],

  // ------------------------------------------------------------
  // UTILITY — SELECTOR
  // ------------------------------------------------------------
  choose(dayType, isGoldilocks = false) {
    if (dayType === "today") {
      if (isGoldilocks) {
        return this.goldilocksToday[
          Math.floor(Math.random() * this.goldilocksToday.length)
        ];
      }
      return this.today[
        Math.floor(Math.random() * this.today.length)
      ];
    }

    if (dayType === "tomorrow") {
      if (isGoldilocks) {
        return this.goldilocksTomorrow[
          Math.floor(Math.random() * this.goldilocksTomorrow.length)
        ];
      }
      return this.tomorrow[
        Math.floor(Math.random() * this.tomorrow.length)
      ];
    }

    // fallback (should never hit)
    return "Conditions show";
  }
};