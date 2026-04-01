// /js/weather-fetch.js
// ============================================================
// RAW WEATHER FETCH LAYER — Clean Unified Fetch (2026 Edition)
// ============================================================

/**
 * fetchAllIntel()
 * Returns ONLY raw, normalized data.
 * No sky logic. No comfort logic. No narrative logic.
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
      fetchedAt: Date.now()
    }
  };

  // ------------------------------------------------------------
  // 1. Tempest
  // ------------------------------------------------------------
  try {
    const rawTempest = await getTempestDeviceObs(tempestDeviceId, tempestToken);
    result.tempest = normalizeTempest(rawTempest);
  } catch (err) {
    console.error("Tempest fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 2. Weather Underground (ALL: nearest + current + history)
  // ------------------------------------------------------------
  try {
    result.wu = await getWUAll(lat, lon);
  } catch (err) {
    console.error("WU fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 3. Open-Meteo hourly forecast
  // ------------------------------------------------------------
  try {
    result.hourly = await getShortTermForecast(lat, lon);
  } catch (err) {
    console.error("Open-Meteo fetch failed:", err);
  }

  // ------------------------------------------------------------
  // 4. MRMS (placeholder)
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
// WEATHER UNDERGROUND — unified ALL endpoint
// nearest + current + history
// ============================================================

export async function getWUAll(lat, lon) {
  try {
    const res = await fetch(`/api/wu/all?lat=${lat}&lon=${lon}`);

    if (!res.ok) throw new Error("WU all fetch failed");

    const data = await res.json();

    // Expected shape:
    // {
    //   stationId,
    //   current,
    //   history
    // }

    if (!data.stationId) {
      console.warn("No WU station found");
      return null;
    }

    // Attach station ID to current obs for consistency
    if (data.current) {
      data.current.stationID = data.stationId;
    }

    return data;

  } catch (err) {
    console.warn("WU fetch error:", err);
    return null;
  }
}

// ============================================================
// OPEN-METEO — hourly forecast
// ============================================================

export async function getShortTermForecast(lat, lon) {
  const url = `/api/weather?type=hourly&lat=${lat}&lon=${lon}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Open-Meteo hourly forecast failed");

  const data = await res.json();

  // Backend already returns the hourly object directly
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
