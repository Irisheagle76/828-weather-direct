// ------------------------------------------------------------
// MASTER ASSEMBLER — FIXED FIELD NAMES
// ------------------------------------------------------------
assemble(intel, dayType, category, isGoldilocks) {
  const narrativeObj = this.buildNarrative(intel, dayType, category, isGoldilocks);

  return {
    emoji: this.buildEmoji(category, isGoldilocks),

    // FIXED: renderer expects "headline"
    headline: this.buildHeadline(category, isGoldilocks),

    // FIXED: renderer expects "notes"
    notes: narrativeObj.narrative,

    // unchanged
    bullets: this.buildBullets(category, isGoldilocks),

    // pass-through metadata
    category,
    goldilocks: isGoldilocks,
    version: "4.0",

    // optional but useful for debugging
    temporal: narrativeObj.temporal,
    mainTemplate: narrativeObj.mainTemplate
  };
}