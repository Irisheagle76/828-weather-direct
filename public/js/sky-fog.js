// /js/sky-fog.js (or inside sky-intel.js if you prefer)

// Time helpers
function isEarlyMorning(localDate) {
  const h = localDate.getHours();
  return h >= 4 && h <= 9; // tweak if needed
}

/**
 * Classify near-surface obscuration:
 * - "fog"
 * - "haze"
 * - "low_visibility"
 * - "clear"
 *
 * Inputs:
 *  - visibilityKm: numeric or null
 *  - humidity: 0–100 or null
 *  - cloudCover: 0–100 or null (OM or blended)
 *  - localDate: Date in local time
 */
export function classifyFogState({ visibilityKm, humidity, cloudCover, localDate }) {
  if (visibilityKm == null || humidity == null) {
    return "clear";
  }

  const earlyMorning = isEarlyMorning(localDate);

  // Base thresholds (you'll tune these with live cam)
  const FOG_VIS_KM = 1.0;      // <= 1 km → strong fog candidate
  const DENSE_FOG_KM = 0.5;    // <= 0.5 km → dense fog
  const HAZE_VIS_KM = 5.0;     // <= 5 km but > fog → haze
  const HUMID_FOG = 96;        // humidity >= 96% → saturated
  const HUMID_HAZE = 85;       // humidity >= 85% → hazy candidate

  // 1) Strong fog signal: very low vis + saturated humidity
  if (visibilityKm <= FOG_VIS_KM && humidity >= HUMID_FOG) {
    return "fog";
  }

  // 2) Early-morning bias: slightly higher vis but clearly saturated
  if (earlyMorning && visibilityKm <= 2.0 && humidity >= HUMID_FOG) {
    return "fog";
  }

  // 3) Haze: reduced vis, not quite fog, still fairly humid
  if (visibilityKm <= HAZE_VIS_KM && humidity >= HUMID_HAZE) {
    return "haze";
  }

  // 4) Generic low visibility (e.g., heavy rain, blowing snow, etc.)
  if (visibilityKm <= HAZE_VIS_KM) {
    return "low_visibility";
  }

  return "clear";
}