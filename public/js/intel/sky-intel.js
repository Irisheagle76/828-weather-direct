// /intel/sky-intel.js
// ============================================================
// SKY INTEL — Unified cloud, solar, UV, visibility, haze/smoke
// Tempest-first → WU → Open-Meteo
// ============================================================

import { LOCATION } from "./config/location.js;

// ------------------------------------------------------------
// Solar elevation helper (same core as comfort, shared logic)
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
  const solarTime = time + (lon / 15);

  const hourAngle = rad * (15 * (solarTime - 12));
  const latRad = lat * rad;

  const elevation =
    Math.asin(
      Math.sin(latRad) * Math.sin(decl) +
      Math.cos(latRad) * Math.cos(decl) * Math.cos(hourAngle)
    );

  return elevation * (180 / Math.PI);
}

// ------------------------------------------------------------
// Cloud state classifier (0–100 → label)
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
// UV category
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
// Visibility + fog/haze hints (very lightweight)
// ------------------------------------------------------------
function classifyVisibility(visKm) {
  if (visKm == null) return { category: "unknown", fogPotential: 0 };

  if (visKm < 0.5) return { category: "dense fog", fogPotential: 1 };
  if (visKm < 1) return { category: "fog", fogPotential: 0.8 };
  if (visKm < 3) return { category: "haze", fogPotential: 0.4 };
  if (visKm < 5) return { category: "reduced", fogPotential: 0.2 };

  return { category: "good", fogPotential: 0 };
}

// ------------------------------------------------------------
// Main SKY INTEL entry point
// ------------------------------------------------------------
export function computeSkyIntel({ tempest, wu, hourly }) {
  const nowTs =
    tempest?.timestamp ??
    wu?.obsTimeLocal ??
    (hourly?.time?.[0] ? new Date(hourly.time[0]).getTime() : Date.now());

  // -----------------------------
  // Cloud (percent 0–100)
  // -----------------------------
  let cloud = null;

  // 1) WU direct cloud cover (already 0–100)
  if (wu?.cloudCover != null) {
    cloud = wu.cloudCover;
  }

  // 2) Tempest illuminance → inferred cloud (simple heuristic)
  if (cloud == null && tempest?.illuminance != null) {
    const illum = tempest.illuminance; // lux
    // 0–120k lux → invert to cloudiness
    const inferred = 100 - (illum / 120000) * 100;
    cloud = Math.max(0, Math.min(100, inferred));
  }

  // 3) Open-Meteo hourly cloudcover[0] (0–100)
  if (cloud == null && Array.isArray(hourly?.cloudcover)) {
    cloud = hourly.cloudcover[0];
  }

  // -----------------------------
  // UV
  // -----------------------------
  let uv = null;

  if (tempest?.uv != null) {
    uv = tempest.uv;
  } else if (wu?.uv != null) {
    uv = wu.uv;
  } else if (Array.isArray(hourly?.uv_index)) {
    uv = hourly.uv_index[0];
  }

  const uvCategory = classifyUV(uv);

  // -----------------------------
  // Solar radiation
  // -----------------------------
  let solar = null;

  if (tempest?.solarRadiation != null) {
    solar = tempest.solarRadiation;
  } else if (wu?.solarRadiation != null) {
    solar = wu.solarRadiation;
  }

  const solarElevation = computeSolarElevation(nowTs, LOCATION.lat, LOCATION.lon);

  // -----------------------------
  // Visibility (km) + fog/haze
  // -----------------------------
  let visibilityKm = null;

  if (wu?.visibility != null) {
    // assume miles if < 40, km otherwise (simple heuristic)
    const v = wu.visibility;
    visibilityKm = v < 40 ? v * 1.60934 : v;
  } else if (Array.isArray(hourly?.visibility)) {
    visibilityKm = hourly.visibility[0];
  }

  const visInfo = classifyVisibility(visibilityKm);

  // -----------------------------
  // Smoke / haze hooks (very light)
// -----------------------------
  const smokeIndex = wu?.smokeIndex ?? null;

  // -----------------------------
  // Final sky intel object
  // -----------------------------
  return {
    cloud,                    // 0–100
    cloudState: classifyCloudState(cloud),
    uv,
    uvCategory,
    solar,                    // W/m² if from Tempest
    solarElevation,           // degrees
    visibilityKm,
    visibilityCategory: visInfo.category,
    fogPotential: visInfo.fogPotential,
    smokeIndex
  };
}