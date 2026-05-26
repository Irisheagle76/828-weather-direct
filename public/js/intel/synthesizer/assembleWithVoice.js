import { assemble } from "./assemble.js?v=20260526-natural-narrative";
import { cleanPhrase } from "./voice-filter.js";
import { buildHumanVoice } from "../human-voice.js";

const pick = (options = []) =>
  options[Math.floor(Math.random() * options.length)] || "";

export function assembleWithVoice(
  intel,
  period,
  category,
  goldilocks,
  trendData = null
) {
  const base = assemble.assemble(intel, period, category, goldilocks);

  let headline = cleanPhrase(base?.headline);

  if (!headline) {
    const fallback = buildHumanVoice(intel);
    headline = cleanPhrase(fallback?.summary) || "";
  }

  const bullets = (base?.bullets ?? [])
    .map(cleanPhrase)
    .filter(Boolean);

  const notes =
    cleanPhrase(base?.narrative) ||
    cleanPhrase(base?.longNarrative) ||
    (bullets.length ? bullets.join(" ") : null);

  let trend = null;

  if (trendData) {
    if (trendData.strongWarmup) trend = "improving-fast";
    else if (trendData.mildWarmup) trend = "improving";
    else if (trendData.coolingAfterPeak) trend = "cooling";
    else if (trendData.windIncreasing) trend = "breezier";
    else if (trendData.drying) trend = "drying";
  }

  if (!trend && intel?.pattern) {
    const scoreTrend = Number(intel.pattern.trend);
    const averageScore = Number(intel.pattern.avg);
    if (scoreTrend > 5) trend = "improving";
    else if (scoreTrend < -18 && averageScore < 85) trend = "worsening";
    else if (scoreTrend < -5) trend = "subtle-dip";
  }

  if (headline && trend) {
    const modifiers = {
      "improving-fast": (h) => {
        if (/cool|chill/i.test(h)) return "Warming up quickly";
        return `${h}, improving quickly`;
      },

      improving: (h) => {
        if (/cool|chill/i.test(h)) {
          return period === "tomorrow"
            ? pick(["Cool early, easier later", "A crisp start, then comfortable", "Chilly early, nicer later"])
            : pick(["The chill eases a bit", "Cool now, easier later", "A crisp start, then more comfortable"]);
        }
        return `${h}, trending better`;
      },

      cooling: (h) => {
        if (/warm|heat/i.test(h)) return "Warm, but easing";
        return `${h}, cooling off`;
      },

      breezier: (h) => {
        if (/calm/i.test(h)) return "Calm now, breeze building";
        return `${h} with a breeze building`;
      },

      drying: (h) => `${h}, with drier air moving in`,

      "subtle-dip": (h) => {
        if (/ideal|perfect|easy|comfortable/i.test(h)) return `${h}, with only a subtle FeelScore dip`;
        return `${h}, with only a subtle comfort dip`;
      },

      worsening: (h) => {
        if (/ideal|perfect/i.test(h)) return "Still nice, but easing back";
        return `${h}, then comfort slips later`;
      }
    };

    const fn = modifiers[trend];
    if (fn) headline = fn(headline);
  }

  return {
    headline,
    bullets,
    notes,
    trend,
    emoji: base?.emoji ?? "🌤️"
  };
}
