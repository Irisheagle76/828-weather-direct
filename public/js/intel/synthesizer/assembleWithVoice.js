import { assemble } from "./assemble.js";
import { cleanPhrase } from "./voice-filter.js";
import { buildHumanVoice } from "../human-voice.js"; // 👈 IMPORTANT

export function assembleWithVoice(intel, period, category, goldilocks) {
  const result = assemble.assemble(intel, period, category, goldilocks);

  let headline = cleanPhrase(result?.headline);

  // ------------------------------------------------------------
  // FALLBACK if vague
  // ------------------------------------------------------------
  if (!headline) {
    const fallback = buildHumanVoice(intel); // ✅ FIXED

    headline = fallback.summary;
  }

  // ------------------------------------------------------------
  // CLEAN BULLETS
  // ------------------------------------------------------------
  const bullets = (result?.bullets || []).filter(b => cleanPhrase(b));

  return {
    headline,
    bullets,
    emoji: result?.emoji || "🌤️"
  };
}