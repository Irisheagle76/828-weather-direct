export function generateSkyNarrative(data) {
  if (!data || !data.metrics) return null;

  const m = data.metrics;
  const t = data.trend;

  // 🌙 NIGHT MODE
  if (m.mode === "night") {
    return {
      headline: "Quiet evening conditions settling in.",
      detail:
        "Low light limits sky visibility. Earlier daytime trends are more reliable than current visuals.",
      confidence: "low",
      type: "night"
    };
  }

  // --- CLOUD DESCRIPTION ---
  let cloudText = "";

  if (m.cloudCoverWest > 70) {
    cloudText = "Clouds remain fairly thick to the west";
  } else if (m.cloudCoverWest > 40) {
    cloudText = "Partly cloudy conditions sit to the west";
  } else {
    cloudText = "Mostly clear skies extend to the west";
  }

  // --- LIGHT / SKY QUALITY ---
  let lightText = "";

  if (m.brightness > 0.65) {
    lightText = "with strong sunlight breaking through";
  } else if (m.brightness > 0.45) {
    lightText = "with filtered light suggesting thinner cloud layers";
  } else {
    lightText = "with dimmer light indicating thicker cloud presence";
  }

  // --- TREND ---
  let trendText = "";

  if (t?.overallTrend === "improving") {
    trendText = "Conditions are improving upstream.";
  } else if (t?.overallTrend === "deteriorating") {
    trendText = "Conditions are trending less favorable upstream.";
  } else {
    trendText = "Conditions remain fairly steady upstream.";
  }

  // --- VISIBILITY ---
  let visibilityText = "";

  if (m.visibilityScore === 3) {
    visibilityText = "Visibility is excellent across the ridgelines.";
  } else if (m.visibilityScore === 2) {
    visibilityText = "Visibility is generally good with slight haze.";
  } else if (m.visibilityScore === 1) {
    visibilityText = "Haze is limiting distant visibility.";
  }

  return {
    headline: `${cloudText} ${lightText}.`,
    detail: `${trendText} ${visibilityText}`,
    confidence: "medium",
    type: "day"
  };
}