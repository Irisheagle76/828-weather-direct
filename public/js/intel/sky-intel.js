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
  const visibility = m.visibilityScore ?? null;

  const sunlightDetected = m.sunlightDetected ?? false;
  const sunlightLevel = m.sunlightLevel ?? "weak";

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
  // 🌈 SIGNALS
  // --------------------------------------------------
  const strongSun = sunlightDetected && sunlightLevel === "strong";
  const moderateSun = sunlightDetected && sunlightLevel === "moderate";

  const blueSky = skyBlueSignal != null && skyBlueSignal > 1.1;

  const heavyCloud = cloud != null && cloud >= 85;
  const midCloud = cloud != null && cloud >= 65;
  const lowCloud = cloud != null && cloud >= 40;

  // --------------------------------------------------
  // 🧠 DOMINANCE LOGIC
  // --------------------------------------------------

  // ☁️ HEAVY CLOUD DOMINATES (cannot be overridden by sun)
  if (heavyCloud) {
    if (strongSun || blueSky) {
      atmosphericState = "overcast_bright"; // 👈 key fix
      confidence = 0.85;
    } else {
      atmosphericState = "overcast";
      confidence = 0.8;
    }
  }

  // ☁️ MOSTLY CLOUDY
  else if (midCloud) {
    if (strongSun || blueSky) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else {
      atmosphericState = "mostly_cloudy";
      confidence = 0.75;
    }
  }

  // 🌤 PARTLY CLOUDY RANGE
  else if (lowCloud) {
    if (strongSun) {
      atmosphericState = "partly_cloudy";
      confidence = 0.85;
    } else if (moderateSun || blueSky) {
      atmosphericState = "partly_cloudy";
      confidence = 0.8;
    } else {
      atmosphericState = "mostly_cloudy";
      confidence = 0.7;
    }
  }

  // ☀️ LOW CLOUD → SUN CAN DOMINATE
  else if (cloud != null) {
    if (strongSun || blueSky) {
      atmosphericState = "mostly_clear";
      confidence = 0.9;
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
    confidence: Number(Math.min(confidence, 1).toFixed(2))
  };
}