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
        "It’s too dark to reliably assess sky conditions right now.",
      confidence: "low",
      type: "night"
    };
  }

  // --------------------------------------------------
  // 🔄 TRANSITIONS (TOP PRIORITY)
  // --------------------------------------------------
  if (transition === "sun_breaking_through") {
    return {
      headline: "Some breaks are starting to show up in the clouds.",
      detail:
        "It’s still mostly cloudy, but brighter spots are beginning to develop.",
      confidence: "high",
      type: "improving"
    };
  }

  if (transition === "improving") {
    return {
      headline: "Cloud cover is starting to thin out.",
      detail:
        "Gradual clearing is underway with more light getting through.",
      confidence: "medium",
      type: "improving"
    };
  }

  if (transition === "deteriorating") {
    return {
      headline: "Clouds are building back in.",
      detail:
        "Skies are trending more gray with less light getting through.",
      confidence: "medium",
      type: "deteriorating"
    };
  }

  // --------------------------------------------------
  // 🌫️ FOG
  // --------------------------------------------------
  if (state === "fog") {
    return {
      headline: "Fog is limiting visibility across the area.",
      detail:
        "Views are obscured with very little definition in the distance.",
      confidence: "high",
      type: "fog"
    };
  }

  // --------------------------------------------------
  // ☁️ OVERCAST (DARK)
  // --------------------------------------------------
  if (state === "overcast") {
    return {
      headline: "Gray, overcast skies are in place.",
      detail:
        "Clouds are firmly in control with very little sunlight getting through.",
      confidence: "high",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☁️ OVERCAST BUT BRIGHT (NEW STATE)
  // --------------------------------------------------
  if (state === "overcast_bright") {
    return {
      headline: "Clouds are in control, but it’s fairly bright.",
      detail:
        "A solid cloud deck is in place, though filtered light is getting through.",
      confidence: "high",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // ☁️ MOSTLY CLOUDY
  // --------------------------------------------------
  if (state === "mostly_cloudy") {
    return {
      headline: "Clouds are covering most of the sky.",
      detail:
        sunlightDetected
          ? "There’s still some light getting through, but clouds remain dominant."
          : "Only limited breaks are allowing light through.",
      confidence: "medium",
      type: "cloud"
    };
  }

  // --------------------------------------------------
  // 🌤️ PARTLY CLOUDY (BALANCED — NO HYPE)
  // --------------------------------------------------
  if (state === "partly_cloudy") {
    return {
      headline: "A mix of clouds and sun across the area.",
      detail:
        sunlightLevel === "strong"
          ? "There are brighter breaks, but clouds are still a noticeable part of the sky."
          : "Clouds and sun are sharing the sky with no clear winner.",
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
        "Just a few clouds around with plenty of open sky.",
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
      "Wide open visibility with bright conditions overhead.",
    confidence: "high",
    type: "clear"
  };
}