import { assemble } from "./assemble.js";
import { cleanPhrase } from "./voice-filter.js";
import { buildHumanVoice } from "../human-voice.js";

export function assembleWithVoice(intel, period, category, goldilocks) {
  const result = assemble.assemble(intel, period, category, goldilocks);

  let headline = cleanPhrase(result?.headline);

  // ------------------------------------------------------------
  // FALLBACK if vague
  // ------------------------------------------------------------
  if (!headline) {
    const fallback = buildHumanVoice(intel);
    headline = fallback.summary;
  }

  // ------------------------------------------------------------
  // CLEAN BULLETS
  // ------------------------------------------------------------
  const bullets = (result?.bullets || [])
    .map(b => cleanPhrase(b))
    .filter(Boolean);

  // ------------------------------------------------------------
  // 🆕 BUILD NOTES (THIS WAS MISSING)
  // ------------------------------------------------------------
  const notes = bullets.join(" ");

  // ------------------------------------------------------------
  // 🆕 BASIC TREND SIGNAL (lightweight bridge)
  // ------------------------------------------------------------
  let trend = null;

  if (bullets.some(b => /warm|improve|rise/i.test(b))) {
    trend = "improving";
  } else if (bullets.some(b => /cool|worse|drop/i.test(b))) {
    trend = "worsening";
  }

  return {
    headline,
    bullets,
    notes,   // ✅ NOW EXISTS
    trend,   // ✅ NOW EXISTS
    emoji: result?.emoji || "🌤️"
  };
}