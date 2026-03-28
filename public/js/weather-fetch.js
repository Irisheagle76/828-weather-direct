// /js/weather-fetch.js
// ============================================================
// RAW WEATHER FETCH LAYER — Unified fetchAllIntel()
// ============================================================

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
    hourly: null,
    mrms: null,
    meta: {
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
  // 2. Open‑Meteo hourly forecast (3 days)
  // ------------------------------------------------------------
  try {
    result.hourly = await getShortTermForecast(lat, lon);
  } catch (err) {
    console.error("Open‑Meteo fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 3. MRMS pixel (placeholder)
  // ------------------------------------------------------------
  try {
    result.mrms = await getMRMSPixel(lat, lon);
  } catch (err) {
    console.error("MRMS fetch failed:", err);
  }

  return result;
}

// ============================================================
// TEMPEST — device observations
// ============================================================

export async function getTempestDeviceObs(deviceId, token) {
  const url = `/api/tempest/device?deviceId=${deviceId}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Tempest device obs failed");
  return res.json();
}

// ============================================================
// OPEN‑METEO — short‑term hourly forecast (3 days)
// ============================================================

export async function getShortTermForecast(lat, lon) {
  const url = `/api/weather?type=hourly&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open‑Meteo hourly forecast failed");
  return res.json();
}

// ============================================================
// MRMS — placeholder pixel fetcher
// ============================================================

export async function getMRMSPixel(lat, lon) {
  return {
    precipRate: 0,
    timestamp: Date.now()
  };
}