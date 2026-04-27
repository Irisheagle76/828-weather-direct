// /intel/sky-intel.js
// ============================================================
// SKY INTEL — Clean, stable, Asheville-tuned
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

function classifyUV(uv) {
  if (uv == null) return "unknown";
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very high";
  return "extreme";
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
// 🔧 MEDIAN (smoothing)
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
  // ⏱️ TIME
  // ------------------------------------------------------------
  const nowTs =
    tempest?.timestamp ??
    wu?.obsTimeLocal ??
    (hourly?.time?.[0]
      ? new Date(hourly.time[0]).getTime()
      : Date.now());

  // ------------------------------------------------------------
  // ☁️ CLOUD INPUT
  // ------------------------------------------------------------
  const cloud = camera?.metrics?.cloudCoverWest ?? null;

  // ------------------------------------------------------------
  // 📷 CAMERA SMOOTHING (3-frame)
  // ------------------------------------------------------------
  const history = [
    camera?.metrics,
    camera?.previous?.metrics,
    camera?.previous2?.metrics
  ];

  const contrast = median(history.map(m => m?.contrast));
  const visibilityScore = median(history.map(m => m?.visibilityScore));

  // ------------------------------------------------------------
  // ☀️ SOLAR / UV
  // ------------------------------------------------------------
  const uv =
    tempest?.uv ??
    wu?.uv ??
    (Array.isArray(hourly?.uv_index) ? hourly.uv_index[0] : null);

  const uvCategory = classifyUV(uv);

  const solar =
    tempest?.solarRadiation ??
    wu?.solarRadiation ??
    null;

  const solarElevation = computeSolarElevation(
    nowTs,
    LOCATION.lat,
    LOCATION.lon
  );

  // ------------------------------------------------------------
  // 🌫️ VISIBILITY (sensor)
  // ------------------------------------------------------------
  let visibilityKm = null;

  if (wu?.visibility != null) {
    const v = wu.visibility;
    visibilityKm = v < 40 ? v * 1.60934 : v;
  }

  const visInfo = classifyVisibility(visibilityKm);

  // ------------------------------------------------------------
  // 🌫️ FOG DETECTION (Asheville tuned)
  // ------------------------------------------------------------
  const valleyFog =
    solarElevation < 15 &&
    contrast != null &&
    contrast < 0.07 &&
    visibilityScore <= 1;

  const visualFog =
    contrast != null &&
    visibilityScore != null &&
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
  // 🌤️ ATMOSPHERIC STATE (FIXED + IMPROVED)
  // ------------------------------------------------------------
  let atmosphericState = "clear";

  if (fogDetected) {
    atmosphericState = "fog";
  }

  else if (
    visInfo.category === "haze" ||
    (contrast < 0.12 && visibilityScore === 2)
  ) {
    atmosphericState = "haze";
  }

  else if (cloud != null) {

    // Overcast (this fixes your issue)
    if (cloud >= 70 && contrast < 0.18) {
      atmosphericState = "overcast";
    }

    else if (cloud >= 60) {
      atmosphericState = "mostly_cloudy";
    }

    else if (cloud >= 30 && contrast >= 0.12) {
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
  // 🔄 TRANSITIONS
  // ------------------------------------------------------------
  let transition = null;

  const prev = camera?.previous?.metrics;

  if (prev) {
    const contrastDelta = contrast - prev.contrast;
    const visDelta = visibilityScore - prev.visibilityScore;

    if (!fogDetected && prev.visibilityScore <= 1 && visibilityScore >= 2) {
      transition = "fog_lifting";
    }

    if (contrastDelta > 0.05) {
      transition = transition ?? "clearing";
    }

    if (visibilityScore === 3 && contrast > 0.15) {
      transition = "cleared";
    }
  }

  // ------------------------------------------------------------
  // 📊 CONFIDENCE
  // ------------------------------------------------------------
  let confidence = 0.5;

  if (contrast != null) confidence += Math.min(contrast, 0.3);
  if (visibilityScore === 3) confidence += 0.2;
  if (fogDetected) confidence += 0.2;

  confidence = Math.min(confidence, 1);

  // ------------------------------------------------------------
  // FINAL OUTPUT
  // ------------------------------------------------------------
  return {
    cloud,
    cloudState: classifyCloudState(cloud),

    uv,
    uvCategory,

    solar,
    solarElevation,

    visibilityKm,
    visibilityCategory: visInfo.category,
    fogPotential: visInfo.fogPotential,

    fogDetected,
    fogConfidence,

    atmosphericState,
    transition,

    confidence,

    smokeIndex: wu?.smokeIndex ?? null
  };
}