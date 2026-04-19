// ============================================================
// WEATHER FETCH LAYER — v8 (TEMP + WIND STATION INTEGRATED)
// ============================================================

// ------------------------------------------------------------
// CACHE
// ------------------------------------------------------------
let lastGood = {
  data: null,
  timestamp: 0
};

const CACHE_TTL = 5 * 60 * 1000;

// ============================================================
// MAIN ENTRY
// ============================================================

export async function fetchAllIntel({ lat, lon }) {
  const start = Date.now();

  const data = await getWeatherUnified(lat, lon);

  // ------------------------------------------------------------
  // 🆕 FETCH TEMPEST (PERSONAL + WIND STATION)
  // ------------------------------------------------------------
let tempestData = null;

try {
  const url = `/api/tempest?stationId=YOUR_STATION_ID`;

  const res = await fetch(url);

  if (res?.ok) {
    tempestData = await res.json();
  } else {
    console.warn("⚠️ Tempest fetch failed");
  }
} catch (err) {
  console.warn("⚠️ Tempest fetch error:", err);
}

return {
  ...data,

    // ----------------------------------------------------------
    // 🆕 TEMPEST + WIND STATION
    // ----------------------------------------------------------
    current_conditions: tempestData?.current_conditions ?? null,
    wind_station: tempestData?.wind_station ?? null,

    // compatibility
    tempest: tempestData?.current_conditions ?? null,
    wu: null,
    mrms: null,

    meta: {
      fetchedAt: start,
      durationMs: Date.now() - start,
      sources: {
        hourly: Array.isArray(data.hourly) && data.hourly.length > 0,
        current: !!data.current,
        tempest: !!tempestData
      }
    }
  };
}

// ============================================================
// ALIGNMENT (🔥 SINGLE SOURCE OF TRUTH)
// ============================================================

function alignToNow(hourly = []) {
  const now = Date.now();

  const sorted = hourly
    .filter(h => Number.isFinite(h?.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!sorted.length) return [];

  let closestIndex = 0;
  let smallestDiff = Infinity;

  for (let i = 0; i < sorted.length; i++) {
    const diff = Math.abs(sorted[i].timestamp - now);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  }

  const aligned = sorted.slice(closestIndex);

  console.log("🧭 ALIGNMENT CHECK:", {
    now: new Date(now).toString(),
    start: new Date(aligned[0]?.timestamp).toString(),
    totalHours: aligned.length
  });

  return aligned;
}

// ============================================================
// SINGLE SOURCE FETCH
// ============================================================

async function getWeatherUnified(lat, lon) {
  if (!lat || !lon) {
    console.warn("❌ Missing lat/lon");
    return buildFallback();
  }

  const url = `/api/weather?type=hourly&lat=${lat}&lon=${lon}`;
  console.log("🌐 Fetching unified weather:", url);

  // ----------------------------------------------------------
  // CACHE HIT
  // ----------------------------------------------------------
  if (lastGood.data && Date.now() - lastGood.timestamp < CACHE_TTL) {
    console.log("🟢 Using cached weather");
    return lastGood.data;
  }

  // ----------------------------------------------------------
  // RETRY LOOP
  // ----------------------------------------------------------
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`🔁 Attempt ${attempt}`);

    try {
      const res = await fetchWithTimeout(url, 5000);
      if (!res || !res.ok) continue;

      const json = await res.json();
      console.log("Raw keys:", Object.keys(json));

      let hourly = null;

      if (Array.isArray(json.hourly) && json.hourly.length > 0) {
        hourly = json.hourly;
      } else if (json.hourly_legacy?.time?.length) {
        console.log("🟡 Using legacy hourly format");

        hourly = json.hourly_legacy.time.map((t, i) => ({
          timestamp: new Date(t).getTime(),

          temperatureF:
            json.hourly_legacy.temperature_2m?.[i] ?? null,

          relativeHumidity:
            json.hourly_legacy.relative_humidity_2m?.[i] ?? null,

          windSpeed:
            json.hourly_legacy.wind_speed_10m?.[i] ?? 0,

          windGust:
            json.hourly_legacy.wind_gusts_10m?.[i] ?? null
        }));
      }

      const current =
        json.current ||
        json.current_conditions ||
        null;

      if (!Array.isArray(hourly) || hourly.length === 0) {
        console.warn("❌ Invalid hourly data");
        continue;
      }

      const alignedHourly = alignToNow(hourly);

      const payload = {
        hourly: alignedHourly,
        current
      };

      lastGood = {
        data: payload,
        timestamp: Date.now()
      };

      console.log("✅ WEATHER OK", {
        rawHours: hourly.length,
        alignedHours: alignedHourly.length,
        hasCurrent: !!current
      });

      return payload;

    } catch (err) {
      console.warn("Fetch error:", err);
    }
  }

  if (lastGood.data) {
    console.warn("🟡 Using cached fallback");
    return lastGood.data;
  }

  console.warn("🔴 Using empty fallback");
  return buildFallback();
}

// ============================================================
// FALLBACK
// ============================================================

function buildFallback() {
  return {
    hourly: [],
    current: null
  };
}

// ============================================================
// UTIL
// ============================================================

async function fetchWithTimeout(url, timeout = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch {
    clearTimeout(id);
    return null;
  }
}