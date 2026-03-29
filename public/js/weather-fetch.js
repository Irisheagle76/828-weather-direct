// /js/weather-fetch.js
// ============================================================
// RAW WEATHER FETCH LAYER — Unified fetchAllIntel()
// ============================================================

/**
 * Unified raw intel fetcher.
 * Returns ONLY raw, normalized data — no sky logic.
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
    wu: null,
    meta: {
      fetchedAt: Date.now()
    }
  };

  // ------------------------------------------------------------
  // 1. Tempest (normalized)
  // ------------------------------------------------------------
  try {
    const rawTempest = await getTempestDeviceObs(tempestDeviceId, tempestToken);
    result.tempest = normalizeTempest(rawTempest);
  } catch (err) {
    console.error("Tempest fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 2. Weather Underground
  // ------------------------------------------------------------
  try {
    result.wu = await getWUObs(lat, lon);
  } catch (err) {
    console.error("WU fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 3. Open-Meteo hourly forecast (FIXED)
  // ------------------------------------------------------------
  try {
    result.hourly = await getShortTermForecast(lat, lon);
  } catch (err) {
    console.error("Open-Meteo fetch failed:", err);
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

// ============================================================
// 🌪️ TEMPEST — normalize device observations
// ============================================================

function normalizeTempest(data) {
  if (!data) return null;

  // Already normalized
  if (data.air_temperature !== undefined) {
    return data;
  }

  // Raw obs array
  if (data?.obs?.[0]) {
    const o = data.obs[0];

    return {
      wind_lull: o[1],
      wind_avg: o[2],
      wind_gust: o[3],
      wind_direction: o[4],
      pressure: o[6],
      air_temperature: o[7],
      relative_humidity: o[8],
      feels_like: o[7],
      dew_point: null
    };
  }

  console.warn("Unknown Tempest format:", data);
  return null;
}

// ============================================================
// TEMPEST — raw fetch
// ============================================================

export async function getTempestDeviceObs(deviceId, token) {
  const url = `/api/tempest/device?deviceId=${deviceId}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Tempest device obs failed");
  return res.json();
}

// ============================================================
// WEATHER UNDERGROUND — nearest station + observation
// ============================================================

export async function getWUObs(lat, lon) {
  try {
    const stationRes = await fetch(`/api/wu-station?lat=${lat}&lon=${lon}`);
    if (!stationRes.ok) throw new Error("WU station lookup failed");

    const stationData = await stationRes.json();
    const stationId = stationData?.location?.stationId?.[0];

    if (!stationId) {
      console.warn("No WU station found");
      return null;
    }

    const obsRes = await fetch(`/api/wu-current?stationId=${stationId}`);
    if (!obsRes.ok) throw new Error("WU observation failed");

    const obsData = await obsRes.json();
    const obs = obsData?.observations?.[0] ?? null;

    if (obs) obs.stationID = stationId;

    return obs;

  } catch (err) {
    console.warn("WU fetch error:", err);
    return null;
  }
}

// ============================================================
// OPEN-METEO — hourly forecast (FIXED)
// ============================================================

export async function getShortTermForecast(lat, lon) {
  const url = `/api/weather?type=hourly&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo hourly forecast failed");

  const data = await res.json();

  // FIX: backend already returns the hourly object directly
  return data;
}

// ============================================================
// MRMS — placeholder
// ============================================================

export async function getMRMSPixel(lat, lon) {
  return {
    precipRate: 0,
    timestamp: Date.now()
  };
}