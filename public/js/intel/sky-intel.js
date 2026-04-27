// ============================================================
// SKY INTEL — Clean, Sun + Blue Aware System
// ============================================================

export function computeSkyIntel({ camera, previous = null }) {
  if (!camera || !camera.metrics) return null;

  const m = camera.metrics;

  // --------------------------------------------------
  // INPUTS
  // --------------------------------------------------
  const cloud = m.cloudCoverWest ?? null;
  const brightness = m.brightness ?? null;
  const contrast = m.contrast ?? null;
  const visibility = m.visibilityScore ?? null;

  const sunlightDetected = m.sunlightDetected ?? false;
  const sunlightLevel = m.sunlightLevel ?? "weak";
  const sunlightStrength = m.sunlightStrength ?? 0;

  const skyBlueSignal = m.skyBlueSignal ?? null;

  const mode = m.mode;

  let atmosphericState = "unknown";
  let cloudState = "unknown";
  let transition = null;
  let confidence = 0.6;

  // --------------------------------------------------
  // 🌙 NIGHT
  // --------------------------------------------------
  if (mode === "night") {
    return {
      cloud,
      cloudState: "unknown",
      atmosphericState: "night",
      transition: null,
      confidence: 0.4
    };
  }

  // --------------------------------------------------
  // 🌫️ FOG (HARD OVERRIDE)
  // --------------------------------------------------
  const fogDetected =
    visibility === 0 ||
    (visibility === 1 && contrast != null && contrast < 0.05);

  if (fogDetected) {
    return {
      cloud,
      cloudState: "obscured",
      atmosphericState: "fog",
      transition: null,
      confidence: 0.9
    };
  }

  // --------------------------------------------------
  // 🌈 BLUE SKY SIGNAL
  // --------------------------------------------------
  const blueSkyPresent =
    skyBlueSignal != null && skyBlueSignal > 1.1;

  // --------------------------------------------------
  // ☀️ SUN STRENGTH CLASSIFICATION
  // --------------------------------------------------
  const strongSun =
    sunlightDetected && sunlightLevel === "strong";

  const moderateSun =
    sunlightDetected && sunlightLevel === "moderate";

  const weakSun =
    sunlightDetected && sunlightLevel === "weak";

  // --------------------------------------------------
  // ☀️ PRIMARY DECISION TREE
  // --------------------------------------------------

  // ☀️ STRONG SUN (dominates everything except fog)
  if (strongSun) {

    if (cloud != null && cloud > 75) {
      atmosphericState = "partly_cloudy";
    } else {
      atmosphericState = "mostly_clear";
    }

    confidence = 0.9;
  }

  // ☀️ MODERATE SUN
  else if (moderateSun) {

    atmosphericState = "partly_cloudy";
    confidence = 0.85;
  }

  // 🌈 BLUE SKY (even without strong sun)
  else if (blueSkyPresent) {

    if (cloud != null && cloud > 70) {
      atmosphericState = "partly_cloudy";
    } else {
      atmosphericState = "mostly_clear";
    }

    confidence = 0.8;
  }

  // --------------------------------------------------
  // ☁️ CLOUD-ONLY FALLBACK
  // --------------------------------------------------
  else if (cloud != null) {

    // strict overcast (must be flat)
    if (cloud >= 85 && contrast != null && contrast < 0.075) {
      atmosphericState = "overcast";
      confidence = 0.75;
    }

    else if (cloud >= 65) {
      atmosphericState = "mostly_cloudy";
      confidence = 0.7;
    }

    else if (cloud >= 40) {
      atmosphericState = "partly_cloudy";
      confidence = 0.65;
    }

    else {
      atmosphericState = "mostly_clear";
      confidence = 0.7;
    }
  }

  else {
    atmosphericState = "clear";
  }

  // --------------------------------------------------
  // ☁️ CLOUD LABEL (UI ONLY)
  // --------------------------------------------------
  if (cloud != null) {
    if (cloud >= 85) cloudState = "overcast";
    else if (cloud >= 65) cloudState = "mostly_cloudy";
    else if (cloud >= 40) cloudState = "partly_cloudy";
    else cloudState = "mostly_clear";
  }

  // --------------------------------------------------
  // 🔄 TRANSITIONS
  // --------------------------------------------------
  if (previous?.atmosphericState) {

    if (
      previous.atmosphericState === "overcast" &&
      atmosphericState === "partly_cloudy"
    ) {
      transition = "improving";
    }

    else if (
      previous.atmosphericState === "partly_cloudy" &&
      atmosphericState === "overcast"
    ) {
      transition = "deteriorating";
    }

    else if (
      sunlightDetected &&
      previous.atmosphericState !== atmosphericState
    ) {
      transition = "sun_breaking_through";
    }
  }

  // --------------------------------------------------
  // 🎯 CONFIDENCE ADJUSTMENTS
  // --------------------------------------------------
  if (strongSun) confidence += 0.05;
  if (blueSkyPresent) confidence += 0.05;

  confidence = Math.min(confidence, 1);

  // --------------------------------------------------
  // FINAL OUTPUT
  // --------------------------------------------------
  return {
    cloud,
    cloudState,
    atmosphericState,
    transition,
    confidence: Number(confidence.toFixed(2))
  };
}