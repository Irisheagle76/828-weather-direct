const RESPONSE_PROFILES = {
  fast: {
    base: 12,
    weights: [55, 38, 20, 10],
    scales: [0.55, 1.25, 1.8, 2.8]
  },
  moderate: {
    base: 15,
    weights: [46, 42, 28, 15],
    scales: [0.7, 1.45, 2.1, 3]
  },
  slow: {
    base: 18,
    weights: [34, 43, 38, 22],
    scales: [0.9, 1.6, 2.4, 3.4]
  }
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function finiteRain(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function rainfallAvailable(rainfall = {}) {
  return rainfall.available !== false &&
    ["rain24h", "rain3d", "rain7d", "rain14d"].some((key) => Number.isFinite(Number(rainfall[key])));
}

function saturatingSignal(amount, usefulScale) {
  if (amount <= 0) return 0;
  return 1 - Math.exp(-amount / usefulScale);
}

export function splitRainfallWindows(rainfall = {}) {
  const rain24h = finiteRain(rainfall.rain24h);
  const rain3d = Math.max(rain24h, finiteRain(rainfall.rain3d));
  const rain7d = Math.max(rain3d, finiteRain(rainfall.rain7d));
  const rain14d = Math.max(rain7d, finiteRain(rainfall.rain14d));
  return [
    rain24h,
    Math.max(0, rain3d - rain24h),
    Math.max(0, rain7d - rain3d),
    Math.max(0, rain14d - rain7d)
  ];
}

export function scoreWaterfallFlow(waterfall, rainfall = {}) {
  if (!rainfallAvailable(rainfall)) return null;
  const profile = RESPONSE_PROFILES[waterfall.responseSpeed] || RESPONSE_PROFILES.moderate;
  const buckets = splitRainfallWindows(rainfall);
  const signal = buckets.reduce((total, amount, index) =>
    total + saturatingSignal(amount, profile.scales[index]) * profile.weights[index]
  , 0);
  const dry14d = finiteRain(rainfall.rain14d) < 0.35;
  const score = profile.base + signal - (dry14d ? 7 : 0);
  return clamp(Math.round(score), 0, 96);
}

function hazardousRainfall(waterfall, rainfall = {}) {
  const sensitivity = waterfall.hazardSensitivity || "medium";
  const rain6h = finiteRain(rainfall.rain6h);
  const rain24h = finiteRain(rainfall.rain24h);
  const rain3d = finiteRain(rainfall.rain3d);
  const multiplier = sensitivity === "high" ? 1 : sensitivity === "medium" ? 1.3 : 1.65;
  return rain6h >= 1.05 * multiplier ||
    rain24h >= 1.75 * multiplier ||
    rain3d >= 3.5 * multiplier;
}

export function categorizeWaterfall(score, waterfall, rainfall = {}) {
  if (!Number.isFinite(score)) {
    return {
      label: "Data unavailable",
      icon: "",
      tone: "muted",
      useCase: "Check a live camera or local report",
      explanation: "The precipitation feed is unavailable, so this waterfall is not being scored."
    };
  }

  if (hazardousRainfall(waterfall, rainfall)) {
    return {
      label: "Potentially Hazardous",
      icon: "⚠️",
      tone: "hazard",
      useCase: "View only from a safe, established area",
      explanation: "Intense recent rain may create slick approaches, heavy spray, and stronger currents."
    };
  }
  if (score >= 84) {
    return {
      label: "Roaring",
      icon: "💦",
      tone: "roaring",
      useCase: "Big-flow sightseeing from safe overlooks",
      explanation: "The basin has a strong recent and multi-day rain signal, so impressive flow is likely."
    };
  }
  if (score >= 68) {
    return {
      label: "Strong",
      icon: "💧",
      tone: "strong",
      useCase: waterfall.photoValue === "high" ? "Photography" : "Sightseeing",
      explanation: "Recent basin rainfall should support a healthy, photogenic flow."
    };
  }
  if (score >= 47) {
    return {
      label: "Normal",
      icon: "🌊",
      tone: "normal",
      useCase: waterfall.familyFriendly ? "Family-friendly sightseeing" : "Sightseeing",
      explanation: "The rainfall signal supports typical flow without a major high-water signal."
    };
  }
  if (score >= 27) {
    return {
      label: "Below Normal",
      icon: "💧",
      tone: "below",
      useCase: waterfall.familyFriendly ? "Easy viewing" : "Low-key sightseeing",
      explanation: "Recent rain is limited, and smaller streams may be running light."
    };
  }
  return {
    label: "Trickle / Low",
    icon: "💧",
    tone: "low",
    useCase: "Best for quiet scouting",
    explanation: "The basin has a weak recent rain signal, so smaller cascades may be sparse."
  };
}

export function buildWaterfallIndex(waterfalls, rainfallById) {
  return waterfalls.map((waterfall) => {
    const rainfall = rainfallById[waterfall.id] || { available: false };
    const score = scoreWaterfallFlow(waterfall, rainfall);
    const category = categorizeWaterfall(score, waterfall, rainfall);
    const basin = rainfall.basin;
    const why = Number.isFinite(score)
      ? basin
        ? [
            `${finiteRain(rainfall.rain3d).toFixed(2)} in effective 3-day basin rain`,
            `${basin.sampleCount} radar samples across ${finiteRain(basin.drainageAreaSqMi).toFixed(1)} sq mi`,
            `${waterfall.responseSpeed} response basin`
          ]
        : [
            `${finiteRain(rainfall.rain6h).toFixed(2)} in last 6 hours`,
            `${finiteRain(rainfall.rain3d).toFixed(2)} in last 3 days`,
            `${waterfall.responseSpeed} response basin`
          ]
      : ["Live precipitation estimate unavailable"];
    return {
      waterfall,
      rainfall,
      score,
      category,
      why
    };
  }).sort((a, b) => {
    if (!Number.isFinite(a.score)) return 1;
    if (!Number.isFinite(b.score)) return -1;
    return b.score - a.score;
  });
}
