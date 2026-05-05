import { assemble } from "./assemble.js?v=20260505-precipvoice";
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
 const notes =
  cleanPhrase(base?.narrative) ||
  cleanPhrase(base?.longNarrative) ||
  (bullets.length ? bullets.join(" ") : null);

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

if (!trend && intel?.pattern) {
  if (intel.pattern.trend > 5) trend = "improving";
  else if (intel.pattern.trend < -5) trend = "worsening";

// ------------------------------------------------------------
// HEADLINE MODULATION (context-aware)
// ------------------------------------------------------------
if (headline && trend) {

  const modifiers = {
    "improving-fast": (h) => {
      if (/cool|chill/i.test(h)) return "Warming up quickly";
      return `${h} — turning better quickly`;
    },

    "improving": (h) => {
      if (/cool|chill/i.test(h)) return "Losing the chill";
      return `${h} — trending better`;
    },

    "cooling": (h) => {
      if (/warm|heat/i.test(h)) return "Warm, but easing";
      return `${h} — cooling off`;
    },

    "breezier": (h) => {
      if (/calm/i.test(h)) return "Calm now, breeze building";
      return `${h} with increasing breeze`;
    },

    "drying": (h) => {
      return `${h} — drying out`;
    },

    "worsening": (h) => {
      if (/ideal|perfect/i.test(h)) return "Still nice, but slipping";
      return `${h} — becoming less comfortable`;
    }
  };

  const fn = modifiers[trend];

  if (fn) {
    headline = fn(headline);
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
}
