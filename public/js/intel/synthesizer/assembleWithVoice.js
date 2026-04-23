import { assemble } from "./assemble.js";
import { cleanPhrase } from "./voice-filter.js";
import { buildHumanVoice } from "../human-voice.js";

export function assembleWithVoice(
  intel,
  period,
  category,
  goldilocks,
  trendData = null // 👈 NEW
) {
  // ------------------------------------------------------------
  // BASE SYNTHESIS
  // ------------------------------------------------------------
  const base = assemble.assemble(intel, period, category, goldilocks);

  // ------------------------------------------------------------
  // HEADLINE (clean + fallback)
  // ------------------------------------------------------------
  let headline = cleanPhrase(base?.headline);

  if (!headline) {
    const fallback = buildHumanVoice(intel);
    headline = cleanPhrase(fallback?.summary) || "";
  }

  // ------------------------------------------------------------
  // BULLETS
  // ------------------------------------------------------------
  const bullets = (base?.bullets ?? [])
    .map(cleanPhrase)
    .filter(Boolean);

  // ------------------------------------------------------------
  // NOTES
  // ------------------------------------------------------------
  const notes = bullets.length ? bullets.join(" ") : null;

  // ------------------------------------------------------------
  // TREND RESOLUTION (REAL > TEXT)
  // ------------------------------------------------------------
  let trend = null;

  if (trendData) {
    if (trendData.strongWarmup) trend = "improving-fast";
    else if (trendData.mildWarmup) trend = "improving";
    else if (trendData.coolingAfterPeak) trend = "cooling";
    else if (trendData.windIncreasing) trend = "breezier";
    else if (trendData.drying) trend = "drying";
  }

  // fallback to bullet inference if no structured trend
  if (!trend) {
    const has = (r) => bullets.some(b => r.test(b));

    if (has(/warm|improve|rise|clear|dry/i)) trend = "improving";
    else if (has(/cool|drop|worse|cloud|humid/i)) trend = "worsening";
  }

  // ------------------------------------------------------------
  // HEADLINE MODULATION (subtle, not spammy)
  // ------------------------------------------------------------
  if (headline && trend) {
    const suffixMap = {
      "improving-fast": "warming quickly",
      "improving": "gradually improving",
      "cooling": "easing later",
      "breezier": "wind picking up",
      "drying": "drying out",
      "worsening": "slipping a bit"
    };

    const suffix = suffixMap[trend];

    if (suffix && !headline.toLowerCase().includes(suffix)) {
      headline = `${headline} — ${suffix}`;
    }
  }

  // ------------------------------------------------------------
  // OUTPUT
  // ------------------------------------------------------------
  return {
    headline,
    bullets,
    notes,
    trend,
    emoji: base?.emoji ?? "🌤️"
  };
}