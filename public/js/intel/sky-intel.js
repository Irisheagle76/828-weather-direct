// /intel/sky-intel.js
// ============================================================
// SKY INTEL — Sun-aware + structure-aware + stable
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
// 📊 HELPERS
// ------------------------------------------------------------
function median(values) {
  const v = values.filter(x => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function classifyCloudState(c) {
  if (c == null) return "unknown";
  if (c < 10) return "clear";
  if (c < 30) return "mostly_clear";
  if (c < 60) return "partly_cloudy";
  if (c < 85) return "mostly_cloudy";
  return "overcast";
}

// ------------------------------------------------------------
// 🧠 MAIN
// ------------------------------------------------------------
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
  // CAMERA (SMOOTHED)
  // ------------------------------------------------------------
  const cloud = camera?.metrics?.cloudCoverWest ?? null;

  const history = [
    camera?.metrics,
    camera?.previous?.metrics,
    camera?.previous2?.metrics
  ];

  const contrast = median(history.map(m => m?.contrast));
  const visibilityScore = median(history.map(m => m?.visibilityScore));

  const sunlightDetected = camera?.metrics?.sunlightDetected;
  const sunlightLevel = camera?.metrics?.sunlightLevel;

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
  // 🌫️ FOG (HIGHEST PRIORITY)
  // ------------------------------------------------------------
  const fogDetected =
    contrast != null &&
    contrast < 0.06 &&
    visibilityScore != null &&
    visibilityScore <= 1;

  let fogConfidence = "low";
  if (fogDetected) {
    fogConfidence = visibilityScore === 0 ? "high" : "medium";
  }

  // ------------------------------------------------------------
  // 🌤️ CLEARING SIGNAL
  // ------------------------------------------------------------
  const clearingSignal =
    prev &&
    cloud != null &&
    prev.cloudCoverWest != null &&
    contrast != null &&
    prev.contrast != null &&
    (
      cloud < prev.cloudCoverWest ||
      contrast > prev.contrast + 0.02
    );

  // ------------------------------------------------------------
  // 🌤️ ATMOSPHERIC STATE (PRIORITY-BASED)
  // ------------------------------------------------------------
  let atmosphericState = "clear";

  // 1. 🌫️ FOG
  if (fogDetected) {
    atmosphericState = "fog";
  }

  // 2. ☀️ SUNLIGHT (PRIMARY REALITY SIGNAL)
  else if (sunlightDetected) {

    if (sunlightLevel === "strong") {

      if (cloud != null && cloud > 70) {
        atmosphericState = "partly_cloudy";
      } else {
        atmosphericState = "mostly_clear";
      }

    } else if (sunlightLevel === "moderate") {
      atmosphericState = "partly_cloudy";

    } else {
      atmosphericState = "partly_cloudy";
    }
  }

  // 3. ☁️ TRUE OVERCAST (STRICT CONDITIONS)
  else if (
    cloud != null &&
    cloud >= 85 &&
    contrast != null &&
    contrast < 0.075
  ) {
    atmosphericState = "overcast";
  }

  // 4. 🌫️ HAZE (ONLY WHEN NOT SUN-DOMINANT)
  else if (
    contrast != null &&
    contrast < 0.1 &&
    visibilityScore === 2 &&
    cloud < 70
  ) {
    atmosphericState = "haze";
  }

  // 5. ☁️ CLOUD TIERS (FALLBACK ONLY)
  else if (cloud != null) {

    if (cloud >= 70) {
      atmosphericState = "mostly_cloudy";
    }

    else if (cloud >= 35) {
      atmosphericState = "partly_cloudy";
    }

    else {
      atmosphericState = "mostly_clear";
    }
  }

  // ------------------------------------------------------------
  // 🔄 TRANSITIONS
  // ------------------------------------------------------------
  let transition = null;

  if (prev) {

    if (
      prev.visibilityScore <= 1 &&
      visibilityScore >= 2 &&
      !fogDetected
    ) {
      transition = "fog_lifting";
    }

    if (clearingSignal) {
      transition = "clearing";
    }

    if (
      sunlightDetected &&
      prev.cloudCoverWest > cloud
    ) {
      transition = "sun_breaking_through";
    }
  }

  // ------------------------------------------------------------
  // 🎯 CONFIDENCE
  // ------------------------------------------------------------
  let confidence = 0.5;

  if (contrast != null) confidence += Math.min(contrast, 0.25);
  if (visibilityScore === 3) confidence += 0.2;
  if (sunlightDetected) confidence += 0.15;
  if (fogDetected) confidence += 0.2;

  confidence = Math.min(confidence, 1);

  // ------------------------------------------------------------
  // OUTPUT
  // ------------------------------------------------------------
  return {
    cloud,
    cloudState: classifyCloudState(cloud),

    solarElevation,

    visibilityKm: null,
    visibilityCategory: "unknown",
    fogPotential: 0,

    fogDetected,
    fogConfidence,

    atmosphericState,
    transition,

    confidence: Number(confidence.toFixed(2))
  };
}