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
  tempestStationId,
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
  // 1. Tempest — Better Forecast (station-level)
  // ------------------------------------------------------------
  try {
    const rawTempest = await getTempestStationObs(
      tempestStationId,
      tempestToken
    );
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
// 🌪️ TEMPEST — Better Forecast (station-level)
// ============================================================

export async function getTempestStationObs(stationId, token) {
  const url = `/api/tempest/station?stationId=${stationId}&token=${token}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Tempest station obs failed");
  return res.json();
}

function normalizeTempest(data) {
  if (!data?.current_conditions) return null;

  const c = data.current_conditions;

  return {
    air_temperature: c.air_temperature ?? null,
    dew_point: c.dew_point ?? null,
    relative_humidity: c.relative_humidity ?? null,
    wind_avg: c.wind_avg ?? null,
    wind_gust: c.wind_gust ?? null,
    wind_direction: c.wind_direction ?? null,
    pressure: c.pressure ?? null,
    feels_like: c.feels_like ?? c.air_temperature ?? null,
    uv: c.uv ?? null,
    solar_radiation: c.solar_radiation ?? null,
    timestamp: c.timestamp ?? Date.now()
  };
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

    if (!data.stationId) {
      console.warn("No WU station found");
      return null;
    }

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
  return data; // backend already returns hourly object
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