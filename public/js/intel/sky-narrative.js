export function generateSkyNarrative(data, skyIntel = null) {
  if (!data || !data.metrics || !skyIntel) return null;

  const m = data.metrics;
  const t = data.trend;

  const state = skyIntel.atmosphericState;
  const transition = skyIntel.transition;

  const sunlightDetected = m.sunlightDetected;
  const sunlightLevel = m.sunlightLevel;

  // --------------------------------------------------
  // 🌙 NIGHT
  // --------------------------------------------------
  if (m.mode === "night") {
    return {
      headline: "Quiet conditions have settled in for the night.",
      detail:
        "Limited light makes sky conditions harder to assess until daybreak.",
      confidence: "low",
      type: "night"
    };
  }

  // --------------------------------------------------
  // 🔄 TRANSITIONS (TOP PRIORITY)
  // --------------------------------------------------
  if (transition === "sun_breaking_through") {
    return {
      headline: "Sun is starting to break through.",
      detail:
        "Clouds are still around, but brighter conditions are beginning to take over.",
      confidence: "high",
      type: "improving"
    };
  }

  if (transition === "improving") {
    return {
      headline: "Conditions are beginning to improve.",
      detail:
        "Cloud cover is easing with gradual increases in light and visibility.",
      confidence: "medium",
      type: "improving"
    };
  }

  if (transition === "deteriorating") {
    return {
      headline: "Conditions are becoming more unsettled.",
      detail:
        "Clouds are thickening with a gradual loss of brightness.",
      confidence: "medium",
      type: "deteriorating"
    };
  }

  // --------------------------------------------------
  // 🌫️ FOG
  // --------------------------------------------------
  if (state === "fog") {
    return {
      headline: "Fog is reducing visibility across the area.",
      detail:
        "Landmarks and ridgelines are partially or fully obscured.",
      confidence: "high",
      type: "fog"
    };
  }

  // --------------------------------------------------
  // 🌫️ HAZE (DE-EMPHASIZED)
  // --------------------------------------------------
  if (state === "haze") {
    return {
      headline: "Slight haze is noticeable in the distance.",
      detail:
        "Views are a bit muted, but overall conditions remain stable.",
      confidence: "low",
      type: "haze"
    };
  }

  // --------------------------------------------------
  // ☁️ OVERCAST
  // --------------------------------------------------
  if (state === "overcast") {
    return {
      headline: "Gray, overcast skies are in place.",
      detail:
        "Clouds are widespread and keeping sunshine limited.",
      confidence: "high",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☁️ MOSTLY CLOUDY (SUN CHECK ADDED)
  // --------------------------------------------------
  if (state === "mostly_cloudy") {

    if (sunlightDetected) {
      return {
        headline: "Clouds are around, but the sun is still getting through.",
        detail:
          "There’s a good amount of light despite the cloud cover.",
        confidence: "medium",
        type: "cloud"
      };
    }

    return {
      headline: "Clouds are covering most of the sky.",
      detail:
        "Only occasional breaks are allowing light through.",
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // 🌤️ PARTLY CLOUDY (SUN-DRIVEN)
  // --------------------------------------------------
  if (state === "partly_cloudy") {

    if (sunlightLevel === "strong") {
      return {
        headline: "Sunshine is winning out with a few clouds around.",
        detail:
          "Bright conditions are in place with clouds passing through at times.",
        confidence: "high",
        type: "cloud"
      };
    }

    return {
      headline: "A mix of sun and clouds across the area.",
      detail:
        "Clouds are drifting through, but sunshine is still getting through.",
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☀️ MOSTLY CLEAR
  // --------------------------------------------------
  if (state === "mostly_clear") {
    return {
      headline: "Mostly sunny skies are in place.",
      detail:
        "Only a few clouds are around with strong visibility.",
      confidence: "high",
      type: "clear"
    };
  }

  // --------------------------------------------------
  // ☀️ CLEAR (FALLBACK)
  // --------------------------------------------------
  return {
    headline: "Clear skies are in place.",
    detail:
      "Excellent visibility with bright, open conditions.",
    confidence: "high",
    type: "clear"
  };
}