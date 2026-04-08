import { assemble } from "./assemble.js";
import { cleanPhrase } from "./voice-filter.js";
import { buildHumanVoice } from "../human-voice.js"; // 👈 IMPORTANT

// ------------------------------------------------------------
// WRAPPED ASSEMBLE (SAFE + SHARP)
// ------------------------------------------------------------
export function assembleWithVoice(intel, period, category, goldilocks) {
  const result = assemble.assemble(intel, period, category, goldilocks);

  let headline = cleanPhrase(result?.headline);

  // ------------------------------------------------------------
  // FALLBACK if vague
  // ------------------------------------------------------------
  if (!headline) {
    const signals = intel.snapshot;

    const fallback = buildHumanVoice(signals, intel.dominantFactor);

    headline = fallback.summary;
  }

  // ------------------------------------------------------------
  // CLEAN BULLETS (remove vague ones only)
  // ------------------------------------------------------------
  const bullets = (result?.bullets || []).filter(b => cleanPhrase(b));

  return {
    headline,
    bullets,
    emoji: result?.emoji || "🌤️"
  };
}