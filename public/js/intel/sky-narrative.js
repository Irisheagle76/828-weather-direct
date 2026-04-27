export function generateSkyNarrative(data, skyIntel = null) {
  if (!data || !data.metrics || !skyIntel) return null;

  const m = data.metrics;
  const t = data.trend;

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
  // 🌫️ FOG (HIGHEST PRIORITY)
  // --------------------------------------------------
  if (skyIntel.atmosphericState === "fog") {
    let headline = "Fog is limiting visibility across the area.";
    let detail =
      "The skyline and surrounding ridgelines are largely obscured.";

    if (skyIntel.fogConfidence === "high") {
      headline = "Dense fog is blanketing the area.";
      detail =
        "Visibility is sharply limited with very little sky definition.";
    }

    // trend-aware detail
    if (t?.overallTrend === "improving") {
      detail = "Visibility may gradually improve as fog begins to lift.";
    } else if (t?.overallTrend === "deteriorating") {
      detail = "Fog may continue to thicken in the near term.";
    }

    return {
      headline,
      detail,
      confidence: skyIntel.fogConfidence || "medium",
      type: "fog"
    };
  }

  // --------------------------------------------------
  // 🌫️ HAZE
  // --------------------------------------------------
  if (skyIntel.atmosphericState === "haze") {
    return {
      headline: "A light haze is limiting clarity across the area.",
      detail:
        "Visibility is somewhat reduced, especially at a distance.",
      confidence: "medium",
      type: "haze"
    };
  }

  // --------------------------------------------------
  // ☁️ LOW CLOUDS (FOG LIFTED)
  // --------------------------------------------------
  if (skyIntel.atmosphericState === "low_clouds") {
    let detail =
      "A low cloud deck is in place with limited sky definition.";

    if (t?.overallTrend === "improving") {
      detail =
        "Low clouds may gradually break as earlier fog continues to lift.";
    }

    return {
      headline:
        "Low clouds have settled in after earlier fog lifted.",
      detail,
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // 🌥️ PARTLY CLOUDY
  // --------------------------------------------------
  if (skyIntel.atmosphericState === "partly_cloudy") {
    let detail =
      "Clouds are scattered with improving visibility across the area.";

    if (t?.overallTrend === "improving") {
      detail =
        "Skies are gradually opening up with increasing sunshine.";
    }

    return {
      headline: "Partly cloudy skies are in place.",
      detail,
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☁️ OVERCAST (fallback if needed)
  // --------------------------------------------------
  if (skyIntel.cloudState === "overcast") {
    return {
      headline: "A thick cloud deck is in place overhead.",
      detail:
        "Light is muted with limited variation across the sky.",
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☀️ CLEAR
  // --------------------------------------------------
  let detail =
    "Visibility is excellent with clear views across the area.";

  if (t?.overallTrend === "improving") {
    detail =
      "Conditions continue to improve with clear skies expanding.";
  }

  return {
    headline: "Skies are mostly clear with strong visibility.",
    detail,
    confidence: "high",
    type: "clear"
  };
}