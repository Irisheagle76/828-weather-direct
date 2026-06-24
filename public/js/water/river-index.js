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
  tubing: { idealMin: 0.35, idealMax: 0.85, highPenalty: 46, lowPenalty: 22 },
  canoeing: { idealMin: 0.35, idealMax: 1.08, highPenalty: 30, lowPenalty: 24 },
  kayaking: { idealMin: 0.35, idealMax: 1.25, highPenalty: 18, lowPenalty: 28 },
  rafting: { idealMin: 0.55, idealMax: 1.35, highPenalty: 12, lowPenalty: 35 },
  fishing: { idealMin: 0.18, idealMax: 0.95, highPenalty: 34, lowPenalty: 8 },
  swimming: { idealMin: 0.15, idealMax: 0.65, highPenalty: 52, lowPenalty: 5 },
  wading: { idealMin: 0.1, idealMax: 0.55, highPenalty: 55, lowPenalty: 4 }
};

const TYPE_ADJUSTMENTS = {
  urban: { tubing: -3, swimming: -12, fishing: -2 },
  recreational: { tubing: 7, canoeing: 5, kayaking: 3, fishing: 2 },
  whitewater: { tubing: -100, swimming: -30, kayaking: 10, rafting: 12, fishing: -4 },
  coldwater: { fishing: 12, swimming: -10, kayaking: -8, tubing: -15 },
  mountain_stream: { swimming: -6, wading: 2, fishing: 5, tubing: -20 }
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function flowRatio(discharge, range = []) {
  const [normalMin, normalMax] = range;
  if (!Number.isFinite(discharge) || !Number.isFinite(normalMin) || !Number.isFinite(normalMax) || normalMax <= normalMin) {
    return null;
  }
  return discharge / normalMax;
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

function weatherPenalty(activity, rainfall = {}, weather = {}) {
  const rain24h = Number(rainfall.rain24h || 0);
  const rain3d = Number(rainfall.rain3d || 0);
  const thunder = Number(weather.thunderstormRisk || 0);
  const stormPenalty = thunder >= 0.55 ? 28 : thunder >= 0.35 ? 15 : thunder >= 0.2 ? 7 : 0;
  const dirtyWaterPenalty = ["tubing", "swimming", "wading"].includes(activity)
    ? rain24h >= 0.9 ? 22 : rain3d >= 1.8 ? 12 : 0
    : rain24h >= 1.4 ? 10 : 0;
  const windPenalty = Number(weather.windMph || 0) >= 18 && ["canoeing", "kayaking"].includes(activity) ? 8 : 0;
  const tempPenalty = Number(weather.airTempF || 0) < 70 && ["tubing", "swimming"].includes(activity) ? 8 : 0;
  return stormPenalty + dirtyWaterPenalty + windPenalty + tempPenalty;
}

export function scoreRiverActivity(river, activity, gauge, rainfall = {}, weather = {}) {
  if (!river.activities.includes(activity)) {
    return {
      score: 0,
      rating: "Not Applicable",
      tone: "muted",
      guidance: `${ACTIVITY_LABELS[activity] || activity} is not a good fit for this stretch.`,
      details: ["Not part of the normal use profile"]
    };
  }

  const profile = ACTIVITY_PROFILES[activity] || ACTIVITY_PROFILES.kayaking;
  const discharge = Number(gauge?.dischargeCfs);
  const ratio = flowRatio(discharge, river.normalFlowRange);
  const status = rangeStatus(discharge, river);
  let score = 74;
  const details = [];

  if (ratio === null) {
    score -= 8;
    details.push("Gauge unavailable");
  } else {
    details.push(`${Math.round(discharge).toLocaleString()} cfs estimate`);
    if (ratio < profile.idealMin) score -= (profile.idealMin - ratio) * profile.lowPenalty * 2.2;
    if (ratio > profile.idealMax) score -= (ratio - profile.idealMax) * profile.highPenalty * 1.7;
  }

  if (status === "hazard") score -= ["kayaking", "rafting"].includes(activity) && river.riverType === "whitewater" ? 18 : 55;
  if (status === "caution") score -= ["kayaking", "rafting"].includes(activity) ? 6 : 24;
  if (status === "low" && activity === "rafting") score -= 18;

  score += (TYPE_ADJUSTMENTS[river.riverType]?.[activity] || 0);
  const weatherHit = weatherPenalty(activity, rainfall, weather);
  score -= weatherHit;
  if (weatherHit) details.push("Recent storm/weather caution");
  if (Number.isFinite(Number(gauge?.waterTempF))) details.push(`${Math.round(gauge.waterTempF)}F water`);

  score = clamp(Math.round(score));

  if (status === "hazard" && ["tubing", "swimming", "wading", "canoeing"].includes(activity)) {
    return {
      score,
      rating: "Hazardous",
      tone: "hazard",
      guidance: activity === "tubing" ? "Not recommended for tubing; swift current possible." : "Avoid entering the water; swift current possible.",
      details
    };
  }

  if (river.riverType === "whitewater" && ["kayaking", "rafting"].includes(activity) && status === "hazard") {
    return {
      score,
      rating: "Experts Only",
      tone: "expert",
      guidance: "Experienced paddlers only; high water changes the character fast.",
      details
    };
  }

  if (score >= 82) {
    return { score, rating: "Great", tone: "great", guidance: `${ACTIVITY_LABELS[activity]} looks like one of the better choices today.`, details };
  }
  if (score >= 68) {
    return { score, rating: "Good", tone: "good", guidance: `${ACTIVITY_LABELS[activity]} should be reasonable with normal river awareness.`, details };
  }
  if (score >= 50) {
    return { score, rating: "Fair", tone: "fair", guidance: `${ACTIVITY_LABELS[activity]} is workable, but check the latest local read before committing.`, details };
  }
  if (score >= 30) {
    return { score, rating: "Not Ideal", tone: "not-ideal", guidance: `${ACTIVITY_LABELS[activity]} is not the best match for today's estimated flow.`, details };
  }
  return {
    score,
    rating: status === "hazard" ? "Hazardous" : "Not Ideal",
    tone: status === "hazard" ? "hazard" : "not-ideal",
    guidance: status === "hazard" ? "Avoid entering the water; swift current possible." : `${ACTIVITY_LABELS[activity]} is better saved for another day.`,
    details
  };
}

export function buildRiverIndex(rivers, inputById, weather) {
  return rivers.map((river) => {
    const input = inputById[river.id] || {};
    const activityScores = Object.keys(ACTIVITY_LABELS)
      .filter((activity) => river.activities.includes(activity) || ["tubing", "canoeing", "kayaking", "rafting", "fishing", "swimming"].includes(activity))
      .map((activity) => ({
        activity,
        ...scoreRiverActivity(river, activity, input.gauge, input.rainfall, weather)
      }))
      .filter((item) => item.rating !== "Not Applicable" || ["tubing", "rafting", "swimming"].includes(item.activity));

    const bestScore = Math.max(...activityScores.map((item) => item.score));
    const bestActivity = activityScores.find((item) => item.score === bestScore);
    const fallbackNotice = input.gauge?.isLive
      ? null
      : "Live river gauge unavailable - using recent rainfall and weather estimate.";

    return {
      river,
      rainfall: input.rainfall || {},
      gauge: input.gauge || null,
      activityScores,
      bestActivity,
      fallbackNotice
    };
  });
}
