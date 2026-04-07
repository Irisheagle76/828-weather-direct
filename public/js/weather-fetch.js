// /js/weather-fetch.js
// ============================================================
// RAW WEATHER FETCH LAYER — v2 (STABLE + RESILIENT)
// Always returns safe, normalized structures
// ============================================================

/**
 * fetchAllIntel()
 * - Fetches all sources in parallel
 * - Never throws
 * - Always returns consistent shape
 */
export async function fetchAllIntel({
  lat,
  lon,
  tempestStationId,
  tempestToken
}) {
  const start = Date.now();

  const result = {
    tempest: null,
    wu: null,
    hourly: null,
    mrms: null,
    meta: {
      fetchedAt: start,
      durationMs: null,
      sources: {}
    }
  };

  // ------------------------------------------------------------
  // PARALLEL FETCH (key upgrade)
  // ------------------------------------------------------------
  const [tempestRes, wuRes, hourlyRes, mrmsRes] = await Promise.allSettled([
    getTempestStationObs(tempestStationId, tempestToken),
    getWUAll(lat, lon),
    getShortTermForecast(lat, lon),
    getMRMSPixel(lat, lon)
  ]);

  // ------------------------------------------------------------
  // TEMPEST
  // ------------------------------------------------------------
  if (tempestRes.status === "fulfilled") {
    result.tempest = normalizeTempest(tempestRes.value);
    result.meta.sources.tempest = !!result.tempest;
  } else {
    console.warn("Tempest failed:", tempestRes.reason);
  }

  // ------------------------------------------------------------
  // WU
  // ------------------------------------------------------------
  if (wuRes.status === "fulfilled") {
    result.wu = wuRes.value;
    result.meta.sources.wu = !!result.wu;
  } else {
    console.warn("WU failed:", wuRes.reason);
  }

  // ------------------------------------------------------------
  // OPEN-METEO
  // ------------------------------------------------------------
  if (hourlyRes.status === "fulfilled") {
    result.hourly = hourlyRes.value;
    result.meta.sources.hourly = !!result.hourly;
  } else {
    console.warn("Open-Meteo failed:", hourlyRes.reason);
  }

  // ------------------------------------------------------------
  // MRMS
  // ------------------------------------------------------------
  if (mrmsRes.status === "fulfilled") {
    result.mrms = mrmsRes.value;
    result.meta.sources.mrms = true;
  } else {
    console.warn("MRMS failed:", mrmsRes.reason);
  }

  result.meta.durationMs = Date.now() - start;

  return result;
}

//
// ============================================================
// 🌪️ TEMPEST — UNIFIED FETCH
// ============================================================
//

export async function getTempestStationObs(stationId, token) {
  if (!stationId || !token) return null;

  const url = `/api/tempest/device?stationId=${stationId}&token=${token}`;

  const res = await fetchWithTimeout(url, 4000);

  if (!res || !res.ok) {
    console.warn("Tempest bad response:", res?.status);
    return null;
  }

  return res.json();
}

// ------------------------------------------------------------
// TEMPEST NORMALIZER (FIXED + SAFE)
// ------------------------------------------------------------
function normalizeTempest(data) {
  if (!data?.current_conditions) return null;

  const c = data.current_conditions;

  return {
    air_temperature: safeNum(c.air_temperature),
    dew_point: safeNum(c.dew_point),
    relative_humidity: safeNum(c.relative_humidity),
    wind_avg: safeNum(c.wind_avg),
    wind_gust: safeNum(c.wind_gust),
    wind_direction: safeNum(c.wind_direction),
    pressure: safeNum(c.pressure),
    feels_like: safeNum(c.feels_like ?? c.air_temperature),
    uv: safeNum(c.uv),
    solar_radiation: safeNum(c.solar_radiation),
    timestamp: normalizeTs(c.timestamp)
  };
}

//
// ============================================================
// WEATHER UNDERGROUND
// ============================================================
//

export async function getWUAll(lat, lon) {
  if (!lat || !lon) return null;

  try {
    const res = await fetchWithTimeout(
      `/api/wu/all?lat=${lat}&lon=${lon}`,
      4000
    );

    if (!res || !res.ok) return null;

    const data = await res.json();

    if (!data?.stationId) return null;

    if (data.current) {
      data.current.stationID = data.stationId;
    }

    return data;
  } catch (err) {
    console.warn("WU fetch error:", err);
    return null;
  }
}

//
// ============================================================
// OPEN-METEO
// ============================================================
//

export async function getShortTermForecast(lat, lon) {
  if (!lat || !lon) return null;

  try {
    const res = await fetchWithTimeout(
      `/api/weather?type=hourly&lat=${lat}&lon=${lon}`,
      5000
    );

    if (!res || !res.ok) return null;

    const data = await res.json();

    if (data?._fallback) {
      console.warn("Open-Meteo fallback:", data._reason);
      return null;
    }

    return data;
  } catch (err) {
    console.warn("Open-Meteo error:", err);
    return null;
  }
}

//
// ============================================================
// MRMS (stub)
// ============================================================
//

export async function getMRMSPixel(lat, lon) {
  return {
    precipRate: 0,
    timestamp: Date.now()
  };
}

//
// ============================================================
// UTILITIES
// ============================================================
//

// ------------------------------------------------------------
// FETCH WITH TIMEOUT (CRITICAL)
// ------------------------------------------------------------
async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    console.warn("Fetch timeout:", url);
    return null;
  }
}

// ------------------------------------------------------------
// SAFE NUMBER (prevents NaN / garbage)
// ------------------------------------------------------------
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ------------------------------------------------------------
// TIMESTAMP NORMALIZER
// ------------------------------------------------------------
function normalizeTs(ts) {
  if (!ts) return Date.now();
  if (ts < 1e12) return ts * 1000;
  return ts;
}