// contrast.js
// ============================================================
// CONTRAST ENGINE — v6 (NON-DESTRUCTIVE, VOICE-AWARE)
//
// Purpose:
// Ensure Today ≠ Tomorrow without overriding assembled voice.
//
// Rules:
// - NEVER replace narrative unless identical
// - Light-touch adjustments only
// - Respect assemble.js as source of truth
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
  // NARRATIVE (VERY IMPORTANT — SAFE ONLY)
  // ------------------------------------------------------------
  ensureDifferentNarrative(todayNarrative, tomorrowNarrative, pool) {
    if (!todayNarrative || !tomorrowNarrative) return tomorrowNarrative;

    // ✅ Only intervene if identical (rare edge case)
    if (todayNarrative !== tomorrowNarrative) return tomorrowNarrative;

    return this.pickDifferent(todayNarrative, pool);
  },

  // ------------------------------------------------------------
  // TEMPORAL FRAMING
  // ------------------------------------------------------------
  ensureDifferentTemporal(todayFrame, tomorrowFrame, pool) {
    if (!todayFrame || !tomorrowFrame) return tomorrowFrame;
    if (todayFrame !== tomorrowFrame) return tomorrowFrame;

    return this.pickDifferent(todayFrame, pool);
  },

  // ------------------------------------------------------------
  // BULLETS
  // ------------------------------------------------------------
  ensureDifferentBullets(todayBullets = [], tomorrowBullets = [], pool = [], count = 3) {
    if (!Array.isArray(todayBullets) || !Array.isArray(tomorrowBullets)) {
      return tomorrowBullets;
    }

    const overlap = tomorrowBullets.filter(b => todayBullets.includes(b));

    // already different → keep
    if (overlap.length === 0) return tomorrowBullets;

    if (!Array.isArray(pool) || pool.length === 0) return tomorrowBullets;

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const newBullets = [];

    for (const b of shuffled) {
      if (!todayBullets.includes(b)) newBullets.push(b);
      if (newBullets.length >= count) break;
    }

    return newBullets.length ? newBullets : tomorrowBullets;
  },

  // ------------------------------------------------------------
  // APPLY CONTRAST (NON-DESTRUCTIVE)
  // ------------------------------------------------------------
  applyContrast(today, tomorrow, pools = {}) {
    const result = { ...tomorrow };

    // 1. Emoji
    result.emoji = this.ensureDifferentEmoji(
      today?.emoji,
      result?.emoji,
      pools?.emojiPool
    );

    // 2. Headline
    result.headline = this.ensureDifferentHeadline(
      today?.headline,
      result?.headline,
      pools?.headlinePool
    );

    // 3. Narrative (SAFE — DO NOT OVERRIDE VOICE)
    result.narrative = this.ensureDifferentNarrative(
      today?.narrative,
      result?.narrative,
      pools?.narrativePool
    );

    // 4. Temporal
    result.temporal = this.ensureDifferentTemporal(
      today?.temporal,
      result?.temporal,
      pools?.temporalPool
    );

    // 5. Bullets
    result.bullets = this.ensureDifferentBullets(
      today?.bullets,
      result?.bullets,
      pools?.bulletPool
    );

    return result;
  }
};