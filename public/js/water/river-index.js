export const ACTIVITY_LABELS = {
  tubing: "Tubing",
  canoeing: "Canoeing",
  kayaking: "Kayaking",
  rafting: "Rafting",
  fishing: "Fishing",
  swimming: "Swimming / wading",
  wading: "Wading"
};

const ACTIVITY_PROFILES = {
  tubing: { idealMin: 0.72, idealMax: 1.35, lowPenalty: 38, highPenalty: 58 },
  canoeing: { idealMin: 0.62, idealMax: 1.65, lowPenalty: 35, highPenalty: 48 },
  kayaking: { idealMin: 0.58, idealMax: 2.25, lowPenalty: 40, highPenalty: 30 },
  rafting: { idealMin: 0.85, idealMax: 2.6, lowPenalty: 50, highPenalty: 24 },
  fishing: { idealMin: 0.45, idealMax: 1.35, lowPenalty: 22, highPenalty: 48 },
  swimming: { idealMin: 0.35, idealMax: 0.95, lowPenalty: 18, highPenalty: 68 },
  wading: { idealMin: 0.28, idealMax: 0.78, lowPenalty: 15, highPenalty: 74 }
};

const TYPE_ADJUSTMENTS = {
  urban: { tubing: -5, swimming: -15, fishing: -3 },
  recreational: { tubing: 6, canoeing: 4, kayaking: 2, fishing: 2 },
  whitewater: { tubing: -100, swimming: -35, kayaking: 8, rafting: 10, fishing: -5 },
  coldwater: { fishing: 10, swimming: -12, kayaking: -8, tubing: -18 },
  mountain_stream: { swimming: -8, wading: 3, fishing: 5, tubing: -25 }
};

const CONTACT_ACTIVITIES = new Set(["tubing", "swimming", "wading"]);
const CASUAL_CURRENT_ACTIVITIES = new Set(["tubing", "swimming", "wading", "canoeing"]);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rangeStatus(discharge, river) {
  if (!Number.isFinite(discharge)) return "unknown";
  const [hazardMin] = river.hazardousFlowRange || [];
  const [cautionMin] = river.cautionFlowRange || [];
  const [normalMin] = river.normalFlowRange || [];
  if (Number.isFinite(hazardMin) && discharge >= hazardMin) return "hazard";
  if (Number.isFinite(cautionMin) && discharge >= cautionMin) return "caution";
  if (Number.isFinite(normalMin) && discharge < normalMin) return "low";
  return "normal";
}

export function seasonalFlowRatio(gauge, river) {
  const percentNormal = numberOrNull(gauge?.percentNormal);
  if (percentNormal !== null && percentNormal >= 0) return percentNormal / 100;
  const discharge = numberOrNull(gauge?.dischargeCfs);
  const median = numberOrNull(gauge?.normalMedianCfs);
  if (discharge !== null && median > 0) return discharge / median;
  const [normalMin, normalMax] = river.normalFlowRange || [];
  if (discharge !== null && Number.isFinite(normalMin) && Number.isFinite(normalMax)) {
    return discharge / ((normalMin + normalMax) / 2);
  }
  return null;
}

function fitPenalty(ratio, profile) {
  if (ratio < profile.idealMin) {
    return Math.min(58, ((profile.idealMin - ratio) / profile.idealMin) * profile.lowPenalty);
  }
  if (ratio > profile.idealMax) {
    return Math.min(72, ((ratio - profile.idealMax) / profile.idealMax) * profile.highPenalty);
  }
  const midpoint = (profile.idealMin + profile.idealMax) / 2;
  const halfWidth = (profile.idealMax - profile.idealMin) / 2;
  return halfWidth > 0 ? Math.abs(ratio - midpoint) / halfWidth * 5 : 0;
}

function weatherAndWaterPenalty(activity, rainfall = {}, weather = {}, gauge = {}) {
  let penalty = 0;
  const details = [];
  const rain6h = numberOrNull(rainfall.rain6h);
  const rain24h = numberOrNull(rainfall.rain24h);
  const rain3d = numberOrNull(rainfall.rain3d);
  const thunder = numberOrNull(weather.thunderstormRisk);
  const trend12hPct = numberOrNull(gauge.trend12hPct);
  const turbidity = numberOrNull(gauge.quality?.turbidity);

  if (thunder !== null) {
    const stormPenalty = thunder >= 0.7 ? 34 : thunder >= 0.45 ? 22 : thunder >= 0.25 ? 10 : 0;
    penalty += stormPenalty;
    if (stormPenalty) details.push("Thunderstorm risk");
  }

  if (CONTACT_ACTIVITIES.has(activity) && rainfall.available !== false) {
    const runoffPenalty = rain6h >= 0.75 || rain24h >= 1.35
      ? 24
      : rain24h >= 0.65 || rain3d >= 1.8
        ? 12
        : 0;
    penalty += runoffPenalty;
    if (runoffPenalty) details.push("Recent runoff");
  }

  if (trend12hPct !== null && trend12hPct >= 18) {
    const risingPenalty = CONTACT_ACTIVITIES.has(activity)
      ? trend12hPct >= 40 ? 24 : 12
      : activity === "canoeing"
        ? trend12hPct >= 40 ? 14 : 7
        : activity === "fishing"
          ? trend12hPct >= 40 ? 10 : 5
          : trend12hPct >= 40 ? 5 : 2;
    penalty += risingPenalty;
    details.push(`River rising ${Math.round(trend12hPct)}% in 12h`);
  }

  if (CONTACT_ACTIVITIES.has(activity) && turbidity !== null) {
    const turbidityPenalty = turbidity >= 50 ? 18 : turbidity >= 20 ? 8 : 0;
    penalty += turbidityPenalty;
    if (turbidityPenalty) details.push("Elevated turbidity");
  }

  const windMph = numberOrNull(weather.windMph);
  if (windMph !== null && windMph >= 18 && ["canoeing", "kayaking"].includes(activity)) {
    penalty += 8;
    details.push("Strong wind");
  }

  const airTempF = numberOrNull(weather.airTempF);
  if (airTempF !== null && airTempF < 70 && ["tubing", "swimming"].includes(activity)) {
    penalty += 8;
    details.push("Cool air");
  }

  return { penalty, details };
}

function ratingForScore(score) {
  if (score >= 88) return { rating: "Great", tone: "great" };
  if (score >= 68) return { rating: "Good", tone: "good" };
  if (score >= 48) return { rating: "Fair", tone: "fair" };
  return { rating: "Not Ideal", tone: "not-ideal" };
}

export function scoreRiverActivity(river, activity, gauge, rainfall = {}, weather = {}) {
  if (!river.activities.includes(activity)) {
    return {
      score: null,
      rating: "Not Applicable",
      tone: "muted",
      guidance: `${ACTIVITY_LABELS[activity] || activity} is not a good fit for this stretch.`,
      details: ["Not part of the normal use profile"]
    };
  }

  const discharge = numberOrNull(gauge?.dischargeCfs);
  const ratio = seasonalFlowRatio(gauge, river);
  if (!gauge?.isLive || discharge === null || ratio === null) {
    return {
      score: null,
      rating: "Data Limited",
      tone: "muted",
      guidance: `A current USGS flow reading is unavailable; check the gauge before planning ${ACTIVITY_LABELS[activity].toLowerCase()}.`,
      details: ["Live flow unavailable"]
    };
  }

  const status = rangeStatus(discharge, river);
  const profile = ACTIVITY_PROFILES[activity] || ACTIVITY_PROFILES.kayaking;
  const details = [
    `${Math.round(discharge).toLocaleString()} cfs`,
    `${Math.round(ratio * 100)}% of seasonal normal`
  ];
  let score = 84 - fitPenalty(ratio, profile);
  score += TYPE_ADJUSTMENTS[river.riverType]?.[activity] || 0;

  const environmental = weatherAndWaterPenalty(activity, rainfall, weather, gauge);
  score -= environmental.penalty;
  details.push(...environmental.details);

  if (status === "caution") {
    const cautionPenalty = ["kayaking", "rafting"].includes(activity) && river.riverType === "whitewater" ? 7 : 24;
    score -= cautionPenalty;
    details.push("River-specific caution flow");
  }
  if (status === "low" && activity === "rafting") {
    score -= 16;
    details.push("Below the normal rafting range");
  }

  score = clamp(Math.round(score));

  if (status === "hazard" && CASUAL_CURRENT_ACTIVITIES.has(activity)) {
    return {
      score,
      rating: "Hazardous",
      tone: "hazard",
      guidance: "Avoid entering the water; this gauge is at the river-specific hazardous-flow threshold.",
      details
    };
  }
  if (status === "hazard" && river.riverType === "whitewater" && ["kayaking", "rafting"].includes(activity)) {
    return {
      score,
      rating: "Experts Only",
      tone: "expert",
      guidance: "Experienced whitewater users only; high water changes this run quickly.",
      details
    };
  }
  if (status === "hazard") {
    return {
      score,
      rating: "Hazardous",
      tone: "hazard",
      guidance: "This gauge is at the river-specific hazardous-flow threshold.",
      details
    };
  }

  const { rating, tone } = ratingForScore(score);
  const guidance = rating === "Great"
    ? `${ACTIVITY_LABELS[activity]} is one of the stronger choices today.`
    : rating === "Good"
      ? `${ACTIVITY_LABELS[activity]} should be reasonable with normal river awareness.`
      : rating === "Fair"
        ? `${ACTIVITY_LABELS[activity]} may work, but review the live gauge and local access conditions first.`
        : `${ACTIVITY_LABELS[activity]} is better saved for another day or another stretch.`;
  return { score, rating, tone, guidance, details };
}

export function buildRiverIndex(rivers, inputById, weather) {
  return rivers.map((river) => {
    const input = inputById[river.id] || {};
    const activityScores = Object.keys(ACTIVITY_LABELS)
      .filter((activity) =>
        river.activities.includes(activity) ||
        ["tubing", "canoeing", "kayaking", "rafting", "fishing", "swimming"].includes(activity)
      )
      .map((activity) => ({
        activity,
        ...scoreRiverActivity(river, activity, input.gauge, input.rainfall, weather)
      }))
      .filter((item) => item.rating !== "Not Applicable" || ["tubing", "rafting", "swimming"].includes(item.activity));

    const scored = activityScores.filter((item) => Number.isFinite(item.score));
    const bestActivity = scored.sort((a, b) => b.score - a.score)[0] ||
      activityScores.find((item) => item.rating === "Data Limited") ||
      null;
    const fallbackNotice = input.gauge?.isLive
      ? null
      : "Current USGS flow is unavailable. Ratings are withheld instead of estimated from placeholder data.";

    return {
      river,
      rainfall: input.rainfall || { available: false },
      gauge: input.gauge || null,
      activityScores,
      bestActivity,
      fallbackNotice
    };
  });
}
