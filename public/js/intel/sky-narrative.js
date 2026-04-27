export function generateSkyNarrative(data, skyIntel = null) {
  if (!data || !data.metrics || !skyIntel) return null;

  const m = data.metrics;
  const t = data.trend;
  const state = skyIntel.atmosphericState;
  const transition = skyIntel.transition;

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
  // 🔄 TRANSITIONS (OVERRIDE LAYER)
  // --------------------------------------------------
  if (transition === "fog_lifting") {
    return {
      headline: "Fog is beginning to lift across the area.",
      detail:
        "Visibility is improving as earlier low clouds gradually thin.",
      confidence: "high",
      type: "transition"
    };
  }

  if (transition === "clearing") {
    return {
      headline: "Clouds are gradually breaking up.",
      detail:
        "Skies are trending clearer with increasing visibility and light.",
      confidence: "medium",
      type: "transition"
    };
  }

  if (transition === "cleared") {
    return {
      headline: "Skies have cleared compared to earlier conditions.",
      detail:
        "Visibility is now strong with much improved sky definition.",
      confidence: "high",
      type: "clear"
    };
  }

  // --------------------------------------------------
  // 🌫️ FOG
  // --------------------------------------------------
  if (state === "fog") {
    let headline = "Fog is limiting visibility across the area.";
    let detail =
      "The skyline and surrounding ridgelines are largely obscured.";

    if (skyIntel.fogConfidence === "high") {
      headline = "Dense fog is blanketing the area.";
      detail =
        "Visibility is sharply limited with very little sky definition.";
    }

    if (t?.overallTrend === "improving") {
      detail = "Visibility may gradually improve as fog begins to lift.";
    }

    if (t?.overallTrend === "deteriorating") {
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
  if (state === "haze") {
    return {
      headline: "A light haze is limiting clarity across the area.",
      detail:
        "Distant features appear muted with reduced definition.",
      confidence: "medium",
      type: "haze"
    };
  }

  // --------------------------------------------------
  // ☁️ OVERCAST (NEW — IMPORTANT FIX)
  // --------------------------------------------------
  if (state === "overcast") {
    let detail =
      "A solid cloud deck is in place with little sun breaking through.";

    if (t?.overallTrend === "improving") {
      detail =
        "Cloud cover may gradually thin, but skies remain largely overcast.";
    }

    return {
      headline: "Overcast skies are in place.",
      detail,
      confidence: "high",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☁️ MOSTLY CLOUDY
  // --------------------------------------------------
  if (state === "mostly_cloudy") {
    let detail =
      "Cloud cover remains widespread with only limited breaks.";

    if (t?.overallTrend === "improving") {
      detail =
        "Clouds may begin to thin with gradual improvement possible.";
    }

    return {
      headline: "Mostly cloudy skies dominate the area.",
      detail,
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☁️ LOW CLOUDS
  // --------------------------------------------------
  if (state === "low_clouds") {
    return {
      headline: "Low clouds are hanging over the area.",
      detail:
        "A low cloud deck is limiting sky definition and sunlight.",
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // 🌤️ PARTLY CLOUDY
  // --------------------------------------------------
  if (state === "partly_cloudy") {
    let detail =
      "Clouds are scattered with some breaks allowing filtered sunlight.";

    if (t?.overallTrend === "improving") {
      detail =
        "Cloud cover is gradually breaking with increasing sunshine.";
    }

    return {
      headline: "Partly cloudy skies are in place.",
      detail,
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☀️ MOSTLY CLEAR
  // --------------------------------------------------
  if (state === "mostly_clear") {
    return {
      headline: "Skies are mostly clear across the area.",
      detail:
        "Only minimal cloud cover is present with strong visibility.",
      confidence: "high",
      type: "clear"
    };
  }

  // --------------------------------------------------
  // ☀️ CLEAR (DEFAULT FALLBACK)
  // --------------------------------------------------
  return {
    headline: "Clear conditions are in place.",
    detail:
      "Visibility is excellent with well-defined views across the area.",
    confidence: "high",
    type: "clear"
  };
}