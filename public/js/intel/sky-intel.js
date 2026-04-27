// /intel/sky-intel.js
// ============================================================
// SKY INTEL — Unified cloud, solar, UV, visibility + camera fusion
// Includes atmospheric states + transition detection
// ============================================================

import { LOCATION } from "/js/config/location.js";

// ------------------------------------------------------------
// SOLAR ELEVATION
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
// CLOUD CLASSIFICATION
// ------------------------------------------------------------
function classifyCloudState(cloudPct) {
  if (cloudPct == null) return "unknown";
  if (cloudPct < 10) return "clear";
  if (cloudPct < 30) return "mostly clear";
  if (cloudPct < 60) return "partly cloudy";
  if (cloudPct < 85) return "mostly cloudy";
  return "overcast";
}

// ------------------------------------------------------------
// UV CLASSIFICATION
// ------------------------------------------------------------
function classifyUV(uv) {
  if (uv == null) return "unknown";
  if (uv < 3) return "low";
  if (uv < 6) return "moderate";
  if (uv < 8) return "high";
  if (uv < 11) return "very high";
  return "extreme";
}

// ------------------------------------------------------------
// VISIBILITY (SENSOR-BASED)
// ------------------------------------------------------------
function classifyVisibility(visKm) {
  if (visKm == null) return { category: "unknown", fogPotential: 0 };

  if (visKm < 0.5) return { category: "dense fog", fogPotential: 1 };
  if (visKm < 1) return { category: "fog", fogPotential: 0.8 };
  if (visKm < 3) return { category: "haze", fogPotential: 0.4 };
  if (visKm < 5) return { category: "reduced", fogPotential: 0.2 };

  return { category: "good", fogPotential: 0 };
}

// ============================================================
// MAIN FUNCTION
// ============================================================
export function computeSkyIntel({ tempest, wu, hourly, camera }) {
  const nowTs =
    tempest?.timestamp ??
    wu?.obsTimeLocal ??
    (hourly?.time?.[0]
      ? new Date(hourly.time[0]).getTime()
      : Date.now());

  // ------------------------------------------------------------
  // CLOUD (sensor + camera fallback)
  // ------------------------------------------------------------
  let cloud = null;

  if (wu?.cloudCover != null) {
    cloud = wu.cloudCover;
  }

  if (cloud == null && tempest?.illuminance != null) {
    const illum = tempest.illuminance;
    const inferred = 100 - (illum / 120000) * 100;
    cloud = Math.max(0, Math.min(100, inferred));
  }

  if (cloud == null && Array.isArray(hourly?.cloudcover)) {
    cloud = hourly.cloudcover[0];
  }

  // 🔥 camera fallback
  if (cloud == null && camera?.metrics?.cloudCoverWest != null) {
    cloud = camera.metrics.cloudCoverWest;
  }

  // ------------------------------------------------------------
  // UV
  // ------------------------------------------------------------
  let uv = null;

  if (tempest?.uv != null) uv = tempest.uv;
  else if (wu?.uv != null) uv = wu.uv;
  else if (Array.isArray(hourly?.uv_index)) uv = hourly.uv_index[0];

  const uvCategory = classifyUV(uv);

  // ------------------------------------------------------------
  // SOLAR
  // ------------------------------------------------------------
  let solar = null;

  if (tempest?.solarRadiation != null) solar = tempest.solarRadiation;
  else if (wu?.solarRadiation != null) solar = wu.solarRadiation;

  const solarElevation = computeSolarElevation(
    nowTs,
    LOCATION.lat,
    LOCATION.lon
  );

  // ------------------------------------------------------------
  // VISIBILITY (SENSORS)
  // ------------------------------------------------------------
  let visibilityKm = null;

  if (wu?.visibility != null) {
    const v = wu.visibility;
    visibilityKm = v < 40 ? v * 1.60934 : v;
  } else if (Array.isArray(hourly?.visibility)) {
    visibilityKm = hourly.visibility[0];
  }

  const visInfo = classifyVisibility(visibilityKm);

  // ------------------------------------------------------------
  // CAMERA INPUTS
  // ------------------------------------------------------------
  const cameraVisibility =
    camera?.metrics?.visibilityScore ?? null;

  const cameraContrast =
    camera?.metrics?.contrast ?? null;

  // ------------------------------------------------------------
  // 🌫️ FOG DETECTION
  // ------------------------------------------------------------
  const visualFog =
    cameraContrast != null &&
    cameraVisibility != null &&
    cameraContrast < 0.06 &&
    cameraVisibility <= 1;

  const sensorFog =
    visInfo.category === "dense fog" ||
    visInfo.category === "fog";

  let fogDetected = false;
  let fogConfidence = "low";

  if (visualFog && sensorFog) {
    fogDetected = true;
    fogConfidence = "high";
  } else if (visualFog || sensorFog) {
    fogDetected = true;
    fogConfidence = "medium";
  }

  // ------------------------------------------------------------
  // VISIBILITY CATEGORY (camera override)
  // ------------------------------------------------------------
  let visibilityCategory = visInfo.category;

  if (visualFog && visInfo.category === "good") {
    visibilityCategory = "fog";
  }

  // ------------------------------------------------------------
  // 🌤️ ATMOSPHERIC STATE
  // ------------------------------------------------------------
  let atmosphericState = "clear";

  if (fogDetected) {
    atmosphericState = "fog";
  }

  else if (
    visibilityCategory === "haze" ||
    (cameraContrast != null &&
      cameraContrast < 0.12 &&
      cameraVisibility === 2)
  ) {
    atmosphericState = "haze";
  }

  else if (
    cloud != null &&
    cloud > 80 &&
    cameraContrast != null &&
    cameraContrast < 0.10
  ) {
    atmosphericState = "low_clouds";
  }

  else if (
    cloud != null &&
    cloud > 40 &&
    cameraContrast != null &&
    cameraContrast >= 0.10
  ) {
    atmosphericState = "partly_cloudy";
  }

  else {
    atmosphericState = "clear";
  }

  // ------------------------------------------------------------
  // 🔄 TRANSITION DETECTION
  // ------------------------------------------------------------
  let transition = null;

  const prev = camera?.previous ?? null;

  if (prev && prev.metrics) {
    const prevContrast = prev.metrics.contrast ?? null;
    const prevVisibility = prev.metrics.visibilityScore ?? null;

    // fog lifting
    if (
      !fogDetected &&
      prevVisibility <= 1 &&
      cameraVisibility >= 2 &&
      cameraContrast > prevContrast
    ) {
      transition = "fog_lifting";
    }

    // clearing
    if (
      prevContrast != null &&
      cameraContrast != null &&
      cameraContrast - prevContrast > 0.05
    ) {
      transition = transition ?? "clearing";
    }

    // cleared
    if (
      cameraVisibility === 3 &&
      cameraContrast > 0.15
    ) {
      transition = "cleared";
    }
  }

  // ------------------------------------------------------------
  // FINAL OBJECT
  // ------------------------------------------------------------
  return {
    cloud,
    cloudState: classifyCloudState(cloud),

    uv,
    uvCategory,

    solar,
    solarElevation,

    visibilityKm,
    visibilityCategory,
    fogPotential: visInfo.fogPotential,

    fogDetected,
    fogConfidence,

    atmosphericState,
    transition,

    smokeIndex: wu?.smokeIndex ?? null
  };
}