// ============================================================
// WEATHER FETCH LAYER — v5 (Unified + Tempest-Correct)
// - Single source: /api/weather
// - Stable shape: { hourly, current }
// - Tempest Better Forecast supported via current_conditions
// - 5-minute cache with safe fallback
// ============================================================

// ------------------------------------------------------------
// CACHE
// ------------------------------------------------------------
let lastGood = {
  data: null,
  timestamp: 0
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export async function fetchAllIntel({ lat, lon }) {
  const start = Date.now();

  const data = await getWeatherUnified(lat, lon);

  return {
    ...data,

    // compatibility for older modules
    tempest: data.current || null,
    wu: null,
    mrms: null,

    meta: {
      fetchedAt: start,
      durationMs: Date.now() - start,
      sources: {
        hourly: !!data.hourly?.time?.length,
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

      const hourly = json.hourly;
      const current =
        json.current ||
        json.current_conditions ||   // Tempest Better Forecast
        null;

      const timeArr = hourly?.time;

      if (!timeArr || timeArr.length === 0) {
        console.warn("❌ Missing hourly.time");
        continue;
      }

      const payload = { hourly, current };

      // cache it
      lastGood = {
        data: payload,
        timestamp: Date.now()
      };

      console.log("✅ WEATHER OK", {
        hours: timeArr.length,
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
    hourly: {
      time: [],
      temperature_2m: [],
      relative_humidity_2m: []
    },
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