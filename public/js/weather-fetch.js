// ============================================================
// WEATHER FETCH LAYER — v3 (HARDENED)
// - Never returns null hourly
// - Retry + timeout
// - Last-good cache fallback
// - Safe structural guarantees
// ============================================================

// ------------------------------------------------------------
// CACHE (in-memory)
// ------------------------------------------------------------
let lastGood = {
  hourly: null,
  timestamp: 0
};

const CACHE_TTL = 5 * 60 * 1000; // 5 min

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
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
    hourly: safeHourlyFallback(),
    mrms: null,
    meta: {
      fetchedAt: start,
      durationMs: null,
      sources: {}
    }
  };

  // ------------------------------------------------------------
  // PARALLEL FETCH
  // ------------------------------------------------------------
  const [tempestRes, wuRes, hourlyRes, mrmsRes] =
    await Promise.allSettled([
      getTempestStationObs(tempestStationId, tempestToken),
      getWUAll(lat, lon),
      getHourlySafe(lat, lon),
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
  // HOURLY (CRITICAL — NEVER NULL)
  // ------------------------------------------------------------
  if (hourlyRes.status === "fulfilled") {
    result.hourly = hourlyRes.value || safeHourlyFallback();
  } else {
    console.warn("Hourly failed:", hourlyRes.reason);
    result.hourly = safeHourlyFallback();
  }

  result.meta.sources.hourly =
    result.hourly?.time?.length > 0;

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

// ============================================================
// HOURLY SAFE FETCH (CORE FIX)
// ============================================================
async function getHourlySafe(lat, lon) {
  if (!lat || !lon) return safeHourlyFallback();

  const url = `/api/weather?type=hourly&lat=${lat}&lon=${lon}`;

  // ------------------------------------------------------------
  // CACHE HIT
  // ------------------------------------------------------------
  if (
    lastGood.hourly &&
    Date.now() - lastGood.timestamp < CACHE_TTL
  ) {
    return lastGood.hourly;
  }

  // ------------------------------------------------------------
  // RETRY (2 attempts)
  // ------------------------------------------------------------
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 5000);

      if (!res || !res.ok) {
        console.warn(`Hourly bad response (attempt ${attempt})`);
        continue;
      }

      const data = await res.json();

      // API fallback flag
      if (data?._fallback) {
        console.warn("Open-Meteo fallback:", data._reason);
        continue;
      }

      if (data?.hourly?.time?.length) {
        lastGood = {
          hourly: data.hourly,
          timestamp: Date.now()
        };
        return data.hourly;
      }

    } catch (err) {
      console.warn(`Hourly error (attempt ${attempt})`, err);
    }
  }

  // ------------------------------------------------------------
  // FALLBACK: CACHE
  // ------------------------------------------------------------
  if (lastGood.hourly) {
    console.warn("Using cached hourly");
    return lastGood.hourly;
  }

  // ------------------------------------------------------------
  // FINAL FALLBACK
  // ------------------------------------------------------------
  console.warn("Using safe hourly fallback");
  return safeHourlyFallback();
}

// ============================================================
// TEMPEST
// ============================================================
export async function getTempestStationObs(stationId, token) {
  if (!stationId || !token) return null;

  const url = `/api/tempest/device?stationId=${stationId}&token=${token}`;
  const res = await fetchWithTimeout(url, 4000);

  if (!res || !res.ok) return null;

  return res.json();
}

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

// ============================================================
// WEATHER UNDERGROUND
// ============================================================
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
    console.warn("WU error:", err);
    return null;
  }
}

// ============================================================
// MRMS
// ============================================================
export async function getMRMSPixel() {
  return {
    precipRate: 0,
    timestamp: Date.now()
  };
}

// ============================================================
// UTILITIES
// ============================================================

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

function safeHourlyFallback() {
  return {
    time: [],
    temperature_2m: [],
    relative_humidity_2m: []
  };
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeTs(ts) {
  if (!ts) return Date.now();
  if (ts < 1e12) return ts * 1000;
  return ts;
}