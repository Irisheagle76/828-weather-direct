export function generateSkyNarrative(data, skyIntel = null) {
  if (!data || !data.metrics) return null;

  const m = data.metrics;
  const t = data.trend;

  // Pull from broader sky intel if available
  const visCategory = skyIntel?.visibilityCategory;
  const fogPotential = skyIntel?.fogPotential ?? 0;

  // --------------------------------------------------
  // 🌙 NIGHT MODE
  // --------------------------------------------------
  if (m.mode === "night") {
    return {
      headline: "Quiet evening conditions settling in.",
      detail:
        "Low light limits sky visibility. Earlier daytime trends are more reliable than current visuals.",
      confidence: "low",
      type: "night"
    };
  }

  // --------------------------------------------------
  // 🌫️ FOG / VISIBILITY (PRIORITY SIGNAL)
  // --------------------------------------------------
  const fogFromCamera = m.fogDetected;
  const fogFromSensors =
    visCategory === "dense fog" || visCategory === "fog";

  if (fogFromCamera || fogFromSensors) {
    let intensityText = "";

    if (
      visCategory === "dense fog" ||
      (fogFromCamera && m.visibilityScore <= 1)
    ) {
      intensityText = "Dense fog is blanketing the area";
    } else {
      intensityText = "Fog is present across the area";
    }

    let detail = "";

    if (t?.overallTrend === "improving") {
      detail = "Visibility may gradually improve as conditions lift.";
    } else if (t?.overallTrend === "deteriorating") {
      detail = "Visibility may continue to worsen in the near term.";
    } else {
      detail = "Visibility is holding fairly steady for now.";
    }

    return {
      headline: `${intensityText}, sharply limiting visibility.`,
      detail,
      confidence: fogFromCamera && fogFromSensors ? "high" : "medium",
      type: "fog"
    };
  }

  // --------------------------------------------------
  // ☁️ CLOUDS (ONLY IF NOT FOG)
  // --------------------------------------------------
  let cloudText = "";

  if (m.cloudCoverWest > 70) {
    cloudText = "Clouds remain fairly thick to the west";
  } else if (m.cloudCoverWest > 40) {
    cloudText = "Partly cloudy conditions sit to the west";
  } else {
    cloudText = "Mostly clear skies extend to the west";
  }

  // --------------------------------------------------
  // ☀️ LIGHT QUALITY
  // --------------------------------------------------
  let lightText = "";

  if (m.brightness > 0.65) {
    lightText = "with strong sunlight breaking through";
  } else if (m.brightness > 0.45) {
    lightText = "with filtered light suggesting thinner cloud layers";
  } else {
    lightText = "with dimmer light indicating thicker cloud presence";
  }

  // --------------------------------------------------
  // 📈 TREND
  // --------------------------------------------------
  let trendText = "";

  if (t?.overallTrend === "improving") {
    trendText = "Conditions are improving upstream.";
  } else if (t?.overallTrend === "deteriorating") {
    trendText = "Conditions are trending less favorable upstream.";
  } else {
    trendText = "Conditions remain fairly steady upstream.";
  }

  // --------------------------------------------------
  // 🌄 VISIBILITY (NON-FOG)
  // --------------------------------------------------
  let visibilityText = "";

  if (m.visibilityScore === 3) {
    visibilityText = "Visibility is excellent across the ridgelines.";
  } else if (m.visibilityScore === 2) {
    visibilityText = "Visibility is generally good with slight haze.";
  } else if (m.visibilityScore === 1) {
    visibilityText = "Visibility is somewhat limited.";
  }

  return {
    headline: `${cloudText} ${lightText}.`,
    detail: `${trendText} ${visibilityText}`,
    confidence: "medium",
    type: "day"
  };
}