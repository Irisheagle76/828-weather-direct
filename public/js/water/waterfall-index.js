const RESPONSE_SPEED_WEIGHTS = {
  fast: { recent: 36, multiDay: 24, week: 14, wetness: 10, dryPenalty: 20 },
  moderate: { recent: 28, multiDay: 28, week: 18, wetness: 13, dryPenalty: 14 },
  slow: { recent: 20, multiDay: 28, week: 24, wetness: 18, dryPenalty: 8 }
};

const HAZARD_BOOST = {
  low: 0,
  medium: 5,
  high: 10
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scale(value, usefulMax) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return clamp(n / usefulMax, 0, 1);
}

export function scoreWaterfallFlow(waterfall, rainfall = {}) {
  const weights = RESPONSE_SPEED_WEIGHTS[waterfall.responseSpeed] || RESPONSE_SPEED_WEIGHTS.moderate;
  const rain24h = Number(rainfall.rain24h || 0);
  const rain3d = Number(rainfall.rain3d || 0);
  const rain7d = Number(rainfall.rain7d || 0);
  const rain14d = Number(rainfall.rain14d || 0);
  const antecedentWetness = clamp((rain14d - rain7d) / 2.8, -0.35, 1);
  const drynessPenalty = rain7d < 0.6 ? weights.dryPenalty : rain14d < 1.25 ? weights.dryPenalty * 0.6 : 0;
  const raw =
    24 +
    scale(rain24h, 1.35) * weights.recent +
    scale(rain3d, 2.2) * weights.multiDay +
    scale(rain7d, 3.4) * weights.week +
    Math.max(0, antecedentWetness) * weights.wetness -
    drynessPenalty;
  const hazardRainBoost = rain24h >= 1.6 || rain3d >= 3.25 ? HAZARD_BOOST[waterfall.hazardSensitivity] || 0 : 0;
  return clamp(Math.round(raw + hazardRainBoost));
}

export function categorizeWaterfall(score, waterfall, rainfall = {}) {
  const rain24h = Number(rainfall.rain24h || 0);
  const rain3d = Number(rainfall.rain3d || 0);
  const sensitive = waterfall.hazardSensitivity === "high";

  if ((rain24h >= 1.75 || rain3d >= 3.4) && sensitive) {
    return {
      label: "Potentially Hazardous",
      icon: "⚠️",
      tone: "hazard",
      useCase: "Avoid entering the water",
      explanation: "Heavy recent rain can make nearby rocks slick and currents stronger than they look."
    };
  }
  if (score >= 88) {
    return {
      label: "Roaring",
      icon: "💦",
      tone: "roaring",
      useCase: "Sightseeing from safe overlooks",
      explanation: "Big visual flow is likely, with spray and slick rock surfaces around the falls."
    };
  }
  if (score >= 72) {
    return {
      label: "Strong",
      icon: "💧",
      tone: "strong",
      useCase: waterfall.photoValue === "high" ? "Photography" : "Sightseeing",
      explanation: "Recent rainfall should have the falls running nicely with strong photo potential."
    };
  }
  if (score >= 52) {
    return {
      label: "Normal",
      icon: "🌊",
      tone: "normal",
      useCase: waterfall.familyFriendly ? "Family-friendly sightseeing" : "Sightseeing",
      explanation: "Flow should look healthy without the higher-water caution signals taking over."
    };
  }
  if (score >= 34) {
    return {
      label: "Below Normal",
      icon: "💧",
      tone: "below",
      useCase: waterfall.familyFriendly ? "Easy viewing" : "Low-key sightseeing",
      explanation: "The falls should still be worth a look, but smaller streams may be dropping off."
    };
  }
  return {
    label: "Trickle / Low",
    icon: "💧",
    tone: "low",
    useCase: "Best for quiet scouting",
    explanation: "Dry recent weather likely has smaller cascades running light."
  };
}

export function buildWaterfallIndex(waterfalls, rainfallById) {
  return waterfalls.map((waterfall) => {
    const rainfall = rainfallById[waterfall.id] || {};
    const score = scoreWaterfallFlow(waterfall, rainfall);
    const category = categorizeWaterfall(score, waterfall, rainfall);
    const why = [
      `${Number(rainfall.rain3d || 0).toFixed(2)} in rain in 3 days`,
      `${waterfall.responseSpeed} response basin`,
      category.tone === "hazard" || score >= 78 ? "Slick rocks possible" : "Flow estimate from rainfall"
    ];
    return {
      waterfall,
      rainfall,
      score,
      category,
      why
    };
  }).sort((a, b) => b.score - a.score);
}
