// ============================================================
// SKY INTEL — Balanced Dominance System (Sun vs Clouds)
// ============================================================

export function computeSkyIntel({ camera, previous = null }) {
  if (!camera || !camera.metrics) return null;

  const m = camera.metrics;

  // --------------------------------------------------
  // INPUTS
  // --------------------------------------------------
  const cloud = m.cloudCoverWest ?? null;
  const contrast = m.contrast ?? null;
  const groundContrast = m.groundContrast ?? null;
  const visibility = m.visibilityScore ?? null;

  const sunlightDetected = m.sunlightDetected ?? false;
  const sunlightLevel = m.sunlightLevel ?? "weak";
  const filteredSunshineSignal = m.filteredSunshineSignal ?? false;
  const satelliteHighCloudSignal = m.satelliteHighCloudSignal ?? false;
  const satelliteCloudMotionSignal = m.satelliteCloudMotionSignal ?? false;
  const softShadowSignal = m.softShadowSignal ?? (
    contrast != null &&
    (
      contrast < 0.09 ||
      (contrast < 0.12 && (groundContrast == null || groundContrast < 0.18))
    )
  );

  const skyBlueSignal = m.skyBlueSignal ?? null;
  const mode = m.mode;

  let atmosphericState = "unknown";
  let cloudState = "unknown";
  let transition = null;
  let confidence = 0.65;

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
  const strongClearingSignal =
    sunlightDetected &&
    sunlightLevel === "strong" &&
    cloud != null &&
    cloud <= 25;
  const blueClearingSignal =
    skyBlueSignal != null &&
    skyBlueSignal >= 1.08 &&
    cloud != null &&
    cloud <= 35;
  const fogDetected = !strongClearingSignal && !blueClearingSignal && (
    (visibility === 0 && (!sunlightDetected || cloud == null || cloud >= 45)) ||
    (visibility === 1 && contrast != null && contrast < 0.05 && cloud != null && cloud >= 65)
  );

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
  // 🌈 SIGNALS
  // --------------------------------------------------
  const strongSun = sunlightDetected && sunlightLevel === "strong";
  const moderateSun = sunlightDetected && sunlightLevel === "moderate";

  const strongBlue = skyBlueSignal != null && skyBlueSignal > 1.2;
  const moderateBlue = skyBlueSignal != null && skyBlueSignal > 1.05;
  const filteredSun = (
    filteredSunshineSignal ||
    satelliteHighCloudSignal ||
    satelliteCloudMotionSignal ||
    (sunlightDetected && softShadowSignal && cloud != null && cloud >= 20)
  );

  // 🔥 KEY CHANGE: raise heavy threshold
  const heavyCloud = cloud != null && cloud >= 90;
  const midCloud = cloud != null && cloud >= 65;
  const lowCloud = cloud != null && cloud >= 40;

  // 🔥 NEW: sun dominance override
  const sunDominant = strongSun && strongBlue && !filteredSun;

  // --------------------------------------------------
  // 🧠 DOMINANCE LOGIC
  // --------------------------------------------------

  // ☁️ HEAVY CLOUD
  if (heavyCloud) {
    if (sunDominant) {
      atmosphericState = "partly_cloudy";   // 🔥 override fix
      confidence = 0.85;
    } else if (strongSun || moderateBlue) {
      atmosphericState = "overcast_bright";
      confidence = 0.8;
    } else {
      atmosphericState = "overcast";
      confidence = 0.85;
    }
  }

  // ☁️ MOSTLY CLOUDY
  else if (midCloud) {
    if (filteredSun) {
      atmosphericState = "mostly_cloudy_filtered";
      confidence = 0.88;
    } else if (sunDominant) {
      atmosphericState = "partly_cloudy";
      confidence = 0.9;
    } else if (strongSun || moderateBlue) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else {
      atmosphericState = "mostly_cloudy";
      confidence = 0.75;
    }
  }

  // 🌤 PARTLY CLOUDY RANGE
  else if (lowCloud) {
    if (filteredSun) {
      atmosphericState = (cloud >= 50 || satelliteHighCloudSignal) ? "mostly_cloudy_filtered" : "filtered_sunshine";
      confidence = 0.86;
    } else if (sunDominant) {
      atmosphericState = "mostly_clear";
      confidence = 0.9;
    } else if (strongSun || moderateSun || moderateBlue) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else {
      atmosphericState = "mostly_cloudy";
      confidence = 0.7;
    }
  }

  // ☀️ LOW CLOUD
  else if (cloud != null) {
    if (filteredSun) {
      atmosphericState = (cloud >= 20 && satelliteHighCloudSignal) ? "mostly_cloudy_filtered" : "filtered_sunshine";
      confidence = 0.78;
    } else if (strongSun || strongBlue) {
      atmosphericState = "mostly_clear";
      confidence = 0.95;
    } else {
      atmosphericState = "partly_cloudy";
      confidence = 0.75;
    }
  }

  else {
    atmosphericState = "clear";
    confidence = 0.7;
  }

  // --------------------------------------------------
  // ☁️ CLOUD LABEL (UI ONLY)
  // --------------------------------------------------
  if (cloud != null) {
    if (cloud >= 90) cloudState = "overcast";
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
    } else if (
      previous.atmosphericState === "partly_cloudy" &&
      atmosphericState === "overcast"
    ) {
      transition = "deteriorating";
    } else if (
      strongSun &&
      previous.atmosphericState !== atmosphericState
    ) {
      transition = "sun_breaking_through";
    }
  }

  // --------------------------------------------------
  // FINAL OUTPUT
  // --------------------------------------------------
  return {
    cloud,
    cloudState,
    atmosphericState,
    transition,
    confidence: Number(Math.min(confidence, 1).toFixed(2)),
    filteredSun,
    softShadowSignal,
    satelliteHighCloudSignal,
    satelliteCloudMotionSignal
  };
}
