// contrast.js
// ============================================================
// CONTRAST ENGINE — v7 (CLEAN + NON-DESTRUCTIVE)
//
// Purpose:
// Ensure Today ≠ Tomorrow without breaking narrative voice
//
// Rules:
// - Never override narrative unless identical
// - Do not depend on bulletPools
// - Keep changes minimal and safe
// ============================================================

export const contrast = {

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------
  pickDifferent(current, pool = []) {
    if (!Array.isArray(pool) || pool.length === 0) return current;

    const alternatives = pool.filter(x => x !== current);
    if (!alternatives.length) return current;

    return alternatives[Math.floor(Math.random() * alternatives.length)];
  },

  // ------------------------------------------------------------
  // EMOJI
  // ------------------------------------------------------------
  ensureDifferentEmoji(todayEmoji, tomorrowEmoji, pool) {
    if (!todayEmoji || !tomorrowEmoji) return tomorrowEmoji;
    if (todayEmoji !== tomorrowEmoji) return tomorrowEmoji;

    return this.pickDifferent(todayEmoji, pool);
  },

  // ------------------------------------------------------------
  // HEADLINE
  // ------------------------------------------------------------
  ensureDifferentHeadline(todayHeadline, tomorrowHeadline, pool) {
    if (!todayHeadline || !tomorrowHeadline) return tomorrowHeadline;
    if (todayHeadline !== tomorrowHeadline) return tomorrowHeadline;

    return this.pickDifferent(todayHeadline, pool);
  },

  // ------------------------------------------------------------
  // NARRATIVE (STRICT — DO NOT TOUCH UNLESS IDENTICAL)
  // ------------------------------------------------------------
  ensureDifferentNarrative(todayNarrative, tomorrowNarrative, pool) {
    if (!todayNarrative || !tomorrowNarrative) return tomorrowNarrative;

    // Only intervene if identical
    if (todayNarrative !== tomorrowNarrative) return tomorrowNarrative;

    return this.pickDifferent(todayNarrative, pool);
  },

  // ------------------------------------------------------------
  // TEMPORAL
  // ------------------------------------------------------------
  ensureDifferentTemporal(todayFrame, tomorrowFrame, pool) {
    if (!todayFrame || !tomorrowFrame) return tomorrowFrame;
    if (todayFrame !== tomorrowFrame) return tomorrowFrame;

    return this.pickDifferent(todayFrame, pool);
  },

  // ------------------------------------------------------------
  // BULLETS (NO POOLS — JUST REMOVE DUPLICATES)
  // ------------------------------------------------------------
  ensureDifferentBullets(todayBullets = [], tomorrowBullets = []) {
    if (!Array.isArray(todayBullets) || !Array.isArray(tomorrowBullets)) {
      return tomorrowBullets;
    }

    const overlap = tomorrowBullets.filter(b => todayBullets.includes(b));

    // Already different → keep
    if (overlap.length === 0) return tomorrowBullets;

    // Remove duplicates only (non-destructive)
    const filtered = tomorrowBullets.filter(b => !todayBullets.includes(b));

    return filtered.length ? filtered : tomorrowBullets;
  },

  // ------------------------------------------------------------
  // APPLY CONTRAST
  // ------------------------------------------------------------
  applyContrast(today = {}, tomorrow = {}, pools = {}) {
    const result = { ...tomorrow };

    // Emoji
    result.emoji = this.ensureDifferentEmoji(
      today.emoji,
      result.emoji,
      pools.emojiPool
    );

    // Headline
    result.headline = this.ensureDifferentHeadline(
      today.headline,
      result.headline,
      pools.headlinePool
    );

    // Narrative (protected)
    result.narrative = this.ensureDifferentNarrative(
      today.narrative,
      result.narrative,
      pools.narrativePool
    );

    // Temporal
    result.temporal = this.ensureDifferentTemporal(
      today.temporal,
      result.temporal,
      pools.temporalPool
    );

    // Bullets (no pool dependency)
    result.bullets = this.ensureDifferentBullets(
      today.bullets,
      result.bullets
    );

    return result;
  }
};