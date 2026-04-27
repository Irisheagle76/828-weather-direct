// /intel/sky-intel.js
// ============================================================
// SKY INTEL — Structure-aware + clearing detection
// ============================================================

import { LOCATION } from "/js/config/location.js";

// ------------------------------------------------------------
// ☀️ SOLAR
// ------------------------------------------------------------
function computeSolarElevation(timestamp, lat, lon) {
  const date = new Date(timestamp);
  const rad = Math.PI / 180;

  const day = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / 86400000
  );

  const decl =
    23.45 * rad *
    Math.sin(rad * ((360 / 365) * (day - 81)));

  const time = date.getHours() + date.getMinutes() / 60;
  const solarTime = time + lon / 15;

  const hourAngle = rad * (15 * (solarTime - 12));
  const latRad = lat * rad;

  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(decl) +
    Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
  );

  return elevation * (180 / Math.PI);
}

// ------------------------------------------------------------
// 📊 CLASSIFIERS
// ------------------------------------------------------------
function classifyCloudState(c) {
  if (c == null) return "unknown";
  if (c < 10) return "clear";
  if (c < 30) return "mostly clear";
  if (c < 60) return "partly cloudy";
  if (c < 85) return "mostly cloudy";
  return "overcast";
}

function classifyVisibility(visKm) {
  if (visKm == null) return { category: "unknown", fogPotential: 0 };

  if (visKm < 0.5) return { category: "dense fog", fogPotential: 1 };
  if (visKm < 1) return { category: "fog", fogPotential: 0.8 };
  if (visKm < 3) return { category: "haze", fogPotential: 0.4 };
  if (visKm < 5) return { category: "reduced", fogPotential: 0.2 };

  return { category: "good", fogPotential: 0 };
}

// ------------------------------------------------------------
// 🔧 MEDIAN
// ------------------------------------------------------------
function median(values) {
  const v = values.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// ============================================================
// 🧠 MAIN
// ============================================================
export function computeSkyIntel({ tempest, wu, hourly, camera }) {

  // ------------------------------------------------------------
  // TIME
  // ------------------------------------------------------------
  const nowTs =
    tempest?.timestamp ??
    wu?.obsTimeLocal ??
    (hourly?.time?.[0]
      ? new Date(hourly.time[0]).getTime()
      : Date.now());

  // ------------------------------------------------------------
  // CAMERA INPUT
  // ------------------------------------------------------------
  const cloud = camera?.metrics?.cloudCoverWest ?? null;

  const history = [
    camera?.metrics,
    camera?.previous?.metrics,
    camera?.previous2?.metrics
  ];

  const contrast = median(history.map(m => m?.contrast));
  const visibilityScore = median(history.map(m => m?.visibilityScore));

  const prev = camera?.previous?.metrics;

  // ------------------------------------------------------------
  // SOLAR
  // ------------------------------------------------------------
  const solarElevation = computeSolarElevation(
    nowTs,
    LOCATION.lat,
    LOCATION.lon
  );

  // ------------------------------------------------------------
  // VISIBILITY
  // ------------------------------------------------------------
  let visibilityKm = null;

  if (wu?.visibility != null) {
    const v = wu.visibility;
    visibilityKm = v < 40 ? v * 1.60934 : v;
  }

  const visInfo = classifyVisibility(visibilityKm);

  // ------------------------------------------------------------
  // 🌫️ FOG
  // ------------------------------------------------------------
  const valleyFog =
    solarElevation < 15 &&
    contrast < 0.07 &&
    visibilityScore <= 1;

  const visualFog =
    contrast < 0.06 &&
    visibilityScore <= 1;

  const sensorFog =
    visInfo.category === "dense fog" ||
    visInfo.category === "fog";

  let fogDetected = false;
  let fogConfidence = "low";

  if (valleyFog || (visualFog && sensorFog)) {
    fogDetected = true;
    fogConfidence = "high";
  } else if (visualFog || sensorFog) {
    fogDetected = true;
    fogConfidence = "medium";
  }

  // ------------------------------------------------------------
  // 🌤️ ATMOSPHERIC STATE
  // ------------------------------------------------------------
  let atmosphericState = "clear";

  const clearingSignal =
    prev &&
    cloud != null &&
    prev.cloudCoverWest != null &&
    cloud < prev.cloudCoverWest &&         // clouds decreasing
    contrast > prev.contrast &&            // more structure
    visibilityScore >= prev.visibilityScore;

  // 🌫️ Fog
  if (fogDetected) {
    atmosphericState = "fog";
  }

  // ☁️ TRUE OVERCAST (flat deck only)
  else if (
    cloud >= 80 &&
    contrast < 0.08 &&
    visibilityScore >= 2
  ) {
    atmosphericState = "overcast";
  }

  // 🌤️ CLEARING CLOUDS (NEW CORE STATE)
  else if (clearingSignal && cloud >= 50) {
    atmosphericState = "mostly_cloudy";
  }

  // 🌤️ STRUCTURED CLOUDS (not uniform anymore)
  else if (
    cloud >= 60 &&
    contrast >= 0.08
  ) {
    atmosphericState = "mostly_cloudy";
  }

  // 🌫️ Haze (only when clouds aren't dominant)
  else if (
    cloud < 70 &&
    (
      visInfo.category === "haze" ||
      (contrast < 0.12 && visibilityScore === 2)
    )
  ) {
    atmosphericState = "haze";
  }

  // ☁️ Standard tiers
  else if (cloud != null) {

    if (cloud >= 60) {
      atmosphericState = "mostly_cloudy";
    }

    else if (cloud >= 30) {
      atmosphericState = "partly_cloudy";
    }

    else {
      atmosphericState = "mostly_clear";
    }
  }

  else {
    atmosphericState = "clear";
  }

  // ------------------------------------------------------------
  // 🔄 TRANSITIONS (UPGRADED)
  // ------------------------------------------------------------
  let transition = null;

  if (prev) {

    if (!fogDetected && prev.visibilityScore <= 1 && visibilityScore >= 2) {
      transition = "fog_lifting";
    }

    // 🔥 TRUE clearing signal
    if (clearingSignal) {
      transition = "clearing";
    }

    if (visibilityScore === 3 && contrast > 0.15 && cloud < 40) {
      transition = "cleared";
    }
  }

  // ------------------------------------------------------------
  // CONFIDENCE
  // ------------------------------------------------------------
  let confidence = 0.5;

  if (contrast != null) confidence += Math.min(contrast, 0.3);
  if (visibilityScore === 3) confidence += 0.2;
  if (fogDetected) confidence += 0.2;

  confidence = Math.min(confidence, 1);

  // ------------------------------------------------------------
  // OUTPUT
  // ------------------------------------------------------------
  return {
    cloud,
    cloudState: classifyCloudState(cloud),

    solarElevation,

    visibilityKm,
    visibilityCategory: visInfo.category,
    fogPotential: visInfo.fogPotential,

    fogDetected,
    fogConfidence,

    atmosphericState,
    transition,

    confidence
  };
}