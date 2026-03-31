// assemble.js
// ============================================================
// NARRATIVE ASSEMBLER
// Builds the 2–3 sentence narrative using:
// - temporal framing
// - category templates
// - Goldilocks templates
// - micro-phrases (temp, moisture, wind, light, microclimate, pattern)
// - medium-length structure
// - strong diversity (Option C)
// ============================================================

import { phrases } from "./phrases.js";
import { categories } from "./categories.js";
import { temporal } from "./temporal.js";
import { bulletPools } from "./bullets.js";
import { emojiPools } from "./emojis.js";

export const assemble = {

  // ------------------------------------------------------------
  // RANDOM PICKER
  // ------------------------------------------------------------
  pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // ------------------------------------------------------------
  // SELECT CATEGORY TEMPLATE
  // ------------------------------------------------------------
  getCategoryTemplate(category, isGoldilocks) {
    if (isGoldilocks) return categories.goldilocks;

    switch (category) {
      case "veryComfortable":
        return categories.veryComfortable;
      case "comfortable":
        return categories.comfortable;
      case "slightlyUncomfortable":
        return categories.slightlyUncomfortable;
      case "uncomfortable":
        return categories.uncomfortable;
      case "harsh":
        return categories.harsh;
      default:
        return categories.comfortable;
    }
  },

  // ------------------------------------------------------------
  // SELECT EMOJI POOL
  // ------------------------------------------------------------
  getEmojiPool(category, isGoldilocks) {
    if (isGoldilocks) return emojiPools.goldilocks;

    switch (category) {
      case "veryComfortable":
        return emojiPools.veryComfortable;
      case "comfortable":
        return emojiPools.comfortable;
      case "slightlyUncomfortable":
        return emojiPools.slightlyUncomfortable;
      case "uncomfortable":
        return emojiPools.uncomfortable;
      case "harsh":
        return emojiPools.harsh;
      default:
        return emojiPools.comfortable;
    }
  },

  // ------------------------------------------------------------
  // SELECT BULLET POOL
  // ------------------------------------------------------------
  getBulletPool(category, isGoldilocks) {
    if (isGoldilocks) return bulletPools.goldilocks;

    switch (category) {
      case "veryComfortable":
        return [
          ...bulletPools.temperature,
          ...bulletPools.moisture,
          ...bulletPools.light,
          ...bulletPools.microclimate
        ];
      case "comfortable":
        return [
          ...bulletPools.temperature,
          ...bulletPools.moisture,
          ...bulletPools.light,
          ...bulletPools.pattern
        ];
      case "slightlyUncomfortable":
        return [
          ...bulletPools.temperature,
          ...bulletPools.moisture,
          ...bulletPools.wind,
          ...bulletPools.light
        ];
      case "uncomfortable":
        return [
          ...bulletPools.wind,
          ...bulletPools.moisture,
          ...bulletPools.temperature
        ];
      case "harsh":
        return [
          ...bulletPools.wind,
          ...bulletPools.moisture,
          ...bulletPools.pattern
        ];
      default:
        return bulletPools.temperature;
    }
  },

  // ------------------------------------------------------------
  // BUILD MAIN NARRATIVE (2–3 sentences)
  // ------------------------------------------------------------
  buildNarrative(intel, dayType, category, isGoldilocks) {
    const template = this.getCategoryTemplate(category, isGoldilocks);

    // 1. Temporal framing
    const temporalFrame = temporal.choose(dayType, isGoldilocks);

    // 2. Category narrative template
    const mainTemplate = this.pick(template.narratives);

    // 3. Micro-phrases (factor-aware)
    const tempPhrase = this.pick(phrases.temperature);
    const moisturePhrase = this.pick(phrases.moisture);
    const windPhrase = this.pick(phrases.wind);
    const lightPhrase = this.pick(phrases.light);
    const microPhrase = this.pick(phrases.microclimate);
    const patternPhrase = this.pick(phrases.pattern);

    // 4. Build 2–3 sentence structure
    const sentence1 = `${temporalFrame} ${tempPhrase} and ${moisturePhrase}.`;
    const sentence2 = `${lightPhrase} and ${windPhrase}, creating ${microPhrase}.`;
    const sentence3 = `${patternPhrase}.`;

    // Goldilocks uses its own template as the middle sentence
    const narrative = isGoldilocks
      ? `${temporalFrame} ${tempPhrase} and ${moisturePhrase}. ${mainTemplate} ${patternPhrase}.`
      : `${sentence1} ${sentence2} ${sentence3}`;

    return {
      temporal: temporalFrame,
      mainTemplate,
      narrative
    };
  },

  // ------------------------------------------------------------
  // BUILD BULLETS
  // ------------------------------------------------------------
  buildBullets(category, isGoldilocks, count = 3) {
    const pool = this.getBulletPool(category, isGoldilocks);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  },

  // ------------------------------------------------------------
  // BUILD EMOJI
  // ------------------------------------------------------------
  buildEmoji(category, isGoldilocks) {
    const pool = this.getEmojiPool(category, isGoldilocks);
    return this.pick(pool);
  },

  // ------------------------------------------------------------
  // BUILD HEADLINE
  // ------------------------------------------------------------
  buildHeadline(category, isGoldilocks) {
    const template = this.getCategoryTemplate(category, isGoldilocks);
    return this.pick(template.headlines);
  },

  // ------------------------------------------------------------
  // MASTER ASSEMBLER
  // ------------------------------------------------------------
  assemble(intel, dayType, category, isGoldilocks) {
    const narrativeObj = this.buildNarrative(intel, dayType, category, isGoldilocks);

    return {
      emoji: this.buildEmoji(category, isGoldilocks),
      title: this.buildHeadline(category, isGoldilocks),
      narrative: narrativeObj.narrative,
      mainTemplate: narrativeObj.mainTemplate,
      temporal: narrativeObj.temporal,
      bullets: this.buildBullets(category, isGoldilocks)
    };
  }
};