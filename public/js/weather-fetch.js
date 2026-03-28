// /js/weather-fetch.js
// ============================================================
// RAW WEATHER FETCH LAYER — Unified fetchAllIntel()
// ============================================================

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getTempestDeviceObs,
  getShortTermForecast,
  getMRMSPixel
} from "./weather-fetch.js"; // adjust path if needed

/**
 * Unified raw intel fetcher.
 * Returns ONLY raw, normalized data — no sky logic, no UV logic.
 */
export async function fetchAllIntel({
  lat,
  lon,
  tempestDeviceId,
  tempestToken
}) {
  const result = {
    tempest: null,
    wu: null,
    hourly: null,
    mrms: null,
    meta: {
      stationId: null,
      fetchedAt: Date.now()
    }
  };

  // ------------------------------------------------------------
  // 1. Tempest (best real‑time obs)
  // ------------------------------------------------------------
  try {
    result.tempest = await getTempestDeviceObs(tempestDeviceId, tempestToken);
  } catch (err) {
    console.error("Tempest fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 2. Weather Underground — nearest station + current obs
  // ------------------------------------------------------------
  try {
    const nearest = await getNearestWUStation(lat, lon);
    result.meta.stationId = nearest.stationId;

    result.wu = await getWUCurrentConditions(nearest.stationId);
  } catch (err) {
    console.error("WU fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 3. Open‑Meteo hourly forecast (3 days)
  // ------------------------------------------------------------
  try {
    result.hourly = await getShortTermForecast(lat, lon);
  } catch (err) {
    console.error("Open‑Meteo fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 4. MRMS pixel (placeholder)
  // ------------------------------------------------------------
  try {
    result.mrms = await getMRMSPixel(lat, lon);
  } catch (err) {
    console.error("MRMS fetch failed:", err);
  }

  return result;
}