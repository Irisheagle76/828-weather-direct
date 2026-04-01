// temporal.js
// ============================================================
// TEMPORAL FRAMING LIBRARY
// ============================================================
//
// Provides short lead-in phrases for:
//  - Today vs Tomorrow
//  - Goldilocks vs normal
// ============================================================

export const temporal = {

  // Standard today framing
  today: [
    "Through the rest of today,",
    "For the rest of today,",
    "As today unfolds,",
    "Through today’s daylight hours,",
    "Across much of today,"
  ],

  // Standard tomorrow framing
  tomorrow: [
    "Tomorrow overall,",
    "As tomorrow unfolds,",
    "Through much of tomorrow,",
    "Tomorrow’s pattern leans toward",
    "Looking ahead to tomorrow,"
  ],

  // Goldilocks today framing
  goldilocksToday: [
    "Through the rest of today, conditions land in a rare sweet spot —",
    "For the rest of today, everything lines up just right —",
    "As today unfolds, the setup stays remarkably balanced —"
  ],

  // Goldilocks tomorrow framing
  goldilocksTomorrow: [
    "Tomorrow brings another Goldilocks-style setup —",
    "Looking ahead to tomorrow, conditions stay beautifully balanced —",
    "Tomorrow continues the just-right pattern —"
  ],

  // ----------------------------------------------------------
  // CHOOSER
  // ----------------------------------------------------------
  choose(dayType, isGoldilocks) {
    if (dayType === "today") {
      if (isGoldilocks) {
        return this.goldilocksToday[
          Math.floor(Math.random() * this.goldilocksToday.length)
        ];
      }
      return this.today[Math.floor(Math.random() * this.today.length)];
    }

    if (dayType === "tomorrow") {
      if (isGoldilocks) {
        return this.goldilocksTomorrow[
          Math.floor(Math.random() * this.goldilocksTomorrow.length)
        ];
      }
      return this.tomorrow[Math.floor(Math.random() * this.tomorrow.length)];
    }

    // Fallback
    return "Through the period,";
  }
};
