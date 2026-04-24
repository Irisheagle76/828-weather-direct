// ============================================================
// WEATHER FETCH LAYER — v9 (PRECIP-SAFE + SINGLE CONTRACT)
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
  // 🌧️ TEMPEST FETCH
  // ------------------------------------------------------------
  let tempestData = null;

  try {
    const res = await fetch(`/api/tempest/device`);

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

    current_conditions: tempestData?.current_conditions ?? null,
    wind_station: tempestData?.wind_station ?? null,

    tempest: tempestData?.current_conditions ?? null,

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
// ALIGNMENT
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

  console.log("🧭 ALIGN:", {
    start: new Date(aligned[0]?.timestamp).toString(),
    hours: aligned.length
  });

  return aligned;
}

// ============================================================
// FETCH CORE
// ============================================================

async function getWeatherUnified(lat, lon) {
  if (!lat || !lon) {
    console.warn("❌ Missing lat/lon");
    return buildFallback();
  }

  const url = `/api/weather?type=hourly&lat=${lat}&lon=${lon}`;
  console.log("🌐 Fetch:", url);

  // ------------------------------------------------------------
  // CACHE
  // ------------------------------------------------------------
  if (lastGood.data && Date.now() - lastGood.timestamp < CACHE_TTL) {
    console.log("🟢 Using cached weather");
    return lastGood.data;
  }

  // ------------------------------------------------------------
  // RETRY LOOP
  // ------------------------------------------------------------
  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`🔁 Attempt ${attempt}`);

    try {
      const res = await fetchWithTimeout(url, 5000);
      if (!res || !res.ok) continue;

      const json = await res.json();

      // --------------------------------------------------------
      // ✅ STRICT CONTRACT: hourly must exist
      // --------------------------------------------------------
      if (!Array.isArray(json.hourly) || json.hourly.length === 0) {
        console.warn("❌ No valid hourly data");
        continue;
      }

      // 🧪 DEBUG — VERIFY PRECIP IS PRESENT
      console.log("🌧️ SAMPLE:", {
        precip: json.hourly[0]?.precipitation,
        prob: json.hourly[0]?.precipitation_probability
      });

      const alignedHourly = alignToNow(json.hourly);

      const payload = {
        hourly: alignedHourly,
        current: json.current || json.current_conditions || null
      };

      lastGood = {
        data: payload,
        timestamp: Date.now()
      };

      console.log("✅ WEATHER OK", {
        hours: alignedHourly.length,
        hasPrecip:
          alignedHourly.some(h => (h.precipitation ?? 0) > 0),
        hasProbability:
          alignedHourly.some(h => h.precipitation_probability != null)
      });

      return payload;

    } catch (err) {
      console.warn("Fetch error:", err);
    }
  }

  // ------------------------------------------------------------
  // FALLBACKS
  // ------------------------------------------------------------
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