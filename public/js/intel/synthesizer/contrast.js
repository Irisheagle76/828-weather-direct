// contrast.js
// ============================================================
// STRONG DIVERSITY ENGINE (Option C)
// Ensures Today ≠ Tomorrow across:
// - headlines
// - emojis
// - narrative templates
// - temporal framing
// - bullet pools
// - phrase families
//
// This module does NOT generate text — it enforces constraints
// used by assemble.js and index.js.
// ============================================================

export const contrast = {

  // ------------------------------------------------------------
  // ENSURE DIFFERENT EMOJIS
  // ------------------------------------------------------------
  ensureDifferentEmoji(todayEmoji, tomorrowEmoji, pool) {
    if (todayEmoji !== tomorrowEmoji) return tomorrowEmoji;

    // pick a different one
    const alternatives = pool.filter(e => e !== todayEmoji);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  },

  // ------------------------------------------------------------
  // ENSURE DIFFERENT HEADLINES
  // ------------------------------------------------------------
  ensureDifferentHeadline(todayHeadline, tomorrowHeadline, pool) {
    if (todayHeadline !== tomorrowHeadline) return tomorrowHeadline;

    // pick a different one
    const alternatives = pool.filter(h => h !== todayHeadline);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  },

  // ------------------------------------------------------------
  // ENSURE DIFFERENT NARRATIVE TEMPLATE
  // ------------------------------------------------------------
  ensureDifferentNarrative(todayNarrative, tomorrowNarrative, pool) {
    if (todayNarrative !== tomorrowNarrative) return tomorrowNarrative;

    const alternatives = pool.filter(n => n !== todayNarrative);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  },

  // ------------------------------------------------------------
  // ENSURE DIFFERENT TEMPORAL FRAMING
  // ------------------------------------------------------------
  ensureDifferentTemporal(todayFrame, tomorrowFrame, pool) {
    if (todayFrame !== tomorrowFrame) return tomorrowFrame;

    const alternatives = pool.filter(f => f !== todayFrame);
    return alternatives[Math.floor(Math.random() * alternatives.length)];
  },

  // ------------------------------------------------------------
  // ENSURE BULLET DIVERSITY
  // ------------------------------------------------------------
  ensureDifferentBullets(todayBullets, tomorrowBullets, pool, count = 3) {
    // If tomorrow's bullets are already distinct, keep them
    const overlap = tomorrowBullets.filter(b => todayBullets.includes(b));
    if (overlap.length === 0) return tomorrowBullets;

    // Otherwise, pick a new set with minimal overlap
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const newBullets = [];

    for (let b of shuffled) {
      if (!todayBullets.includes(b)) newBullets.push(b);
      if (newBullets.length >= count) break;
    }

    return newBullets;
  },

  // ------------------------------------------------------------
  // HIGH-LEVEL CONTRAST APPLICATION
  // Called by index.js AFTER both narratives are generated
  // ------------------------------------------------------------
  applyContrast(today, tomorrow, pools) {
    // 1. Emoji
    tomorrow.emoji = this.ensureDifferentEmoji(
      today.emoji,
      tomorrow.emoji,
      pools.emojiPool
    );

    // 2. Headline
    tomorrow.title = this.ensureDifferentHeadline(
      today.title,
      tomorrow.title,
      pools.headlinePool
    );

    // 3. Narrative template (main text)
    tomorrow.mainTemplate = this.ensureDifferentNarrative(
      today.mainTemplate,
      tomorrow.mainTemplate,
      pools.narrativePool
    );

    // 4. Temporal framing
    tomorrow.temporal = this.ensureDifferentTemporal(
      today.temporal,
      tomorrow.temporal,
      pools.temporalPool
    );

    // 5. Bullets
    tomorrow.bullets = this.ensureDifferentBullets(
      today.bullets,
      tomorrow.bullets,
      pools.bulletPool
    );

    return tomorrow;
  }
};