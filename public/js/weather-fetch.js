// ============================================================
// WEATHER FETCH LAYER — v6 (STABLE + DUAL FORMAT)
// ============================================================

// ------------------------------------------------------------
// CACHE
// ------------------------------------------------------------
let lastGood = {
  data: null,
  timestamp: 0
};

const CACHE_TTL = 5 * 60 * 1000;

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export async function fetchAllIntel({ lat, lon }) {
  const start = Date.now();

  const data = await getWeatherUnified(lat, lon);

  return {
    ...data,

    // compatibility
    tempest: data.current || null,
    wu: null,
    mrms: null,

    meta: {
      fetchedAt: start,
      durationMs: Date.now() - start,
      sources: {
        hourly: Array.isArray(data.hourly) && data.hourly.length > 0,
        current: !!data.current
      }
    }
  };
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

      // ------------------------------------------------------
      // SUPPORT BOTH FORMATS
      // ------------------------------------------------------
      let hourly = null;

      if (Array.isArray(json.hourly) && json.hourly.length > 0) {
        // ✅ NEW SYSTEM
        hourly = json.hourly;
      } else if (json.hourly_legacy?.time?.length) {
        // ✅ OLD SYSTEM FALLBACK
        console.log("🟡 Using legacy hourly format");

        hourly = json.hourly_legacy.time.map((t, i) => ({
          timestamp: new Date(t).getTime(),
          temperatureF: json.hourly_legacy.temperature_2m?.[i] ?? null,
          relative_humidity: json.hourly_legacy.relative_humidity_2m?.[i] ?? null,
          windSpeed: json.hourly_legacy.wind_speed_10m?.[i] ?? 0
        }));
      }

      const current =
        json.current ||
        json.current_conditions ||
        null;

      // ------------------------------------------------------
      // VALIDATION
      // ------------------------------------------------------
      if (!Array.isArray(hourly) || hourly.length === 0) {
        console.warn("❌ Invalid hourly data");
        continue;
      }

      const payload = { hourly, current };

      // ------------------------------------------------------
      // CACHE
      // ------------------------------------------------------
      lastGood = {
        data: payload,
        timestamp: Date.now()
      };

      console.log("✅ WEATHER OK", {
        hours: hourly.length,
        hasCurrent: !!current
      });

      return payload;

    } catch (err) {
      console.warn("Fetch error:", err);
    }
  }

  // ----------------------------------------------------------
  // FALLBACK
  // ----------------------------------------------------------
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
    hourly: [],   // ✅ unified format
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