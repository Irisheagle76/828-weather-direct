// ============================================================
// WEATHER API — v5 (TEMPEST-STRICT + CLEAN)
// - Tempest = ONLY source for current
// - Open-Meteo = forecast only
// - No unit mismatches
// - Stable + predictable
// ============================================================

let cache = {};
let lastGood = {};

const CACHE_TTL = 60 * 1000; // 1 min

// ------------------------------------------------------------
// ROUTER
// ------------------------------------------------------------
export default async function handler(req, res) {
  const { type } = req.query;

  try {
    if (type === "hourly") {
      return await handleHourly(req, res);
    }

    return res.status(400).json({ error: "Invalid type" });

  } catch (err) {
    console.error("🚨 Weather API error:", err);
    return res.status(200).json(buildFallback("router-exception"));
  }
}

// ------------------------------------------------------------
// MAIN HANDLER
// ------------------------------------------------------------
async function handleHourly(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const key = `${lat},${lon}`;

  // ----------------------------------------------------------
  // 🔥 ALWAYS GET TEMPEST FIRST
  // ----------------------------------------------------------
  const tempest = await fetchTempest();

  if (!tempest) {
    console.error("🚨 TEMPEST FAILED — no current conditions");
  }

  // ----------------------------------------------------------
  // CACHE HIT (but refresh current)
  // ----------------------------------------------------------
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    return res.status(200).json({
      ...cache[key].data,
      current: tempest || cache[key].data.current || lastGood[key]?.current || null
    });
  }

  // ----------------------------------------------------------
  // OPEN-METEO (FORECAST ONLY)
  // ----------------------------------------------------------
  const hourlyFields = [
    "temperature_2m",
    "apparent_temperature",
    "dew_point_2m",
    "relative_humidity_2m",
    "precipitation",
    "snowfall",
    "cloudcover",
    "visibility",
    "wind_speed_10m",
    "wind_gusts_10m",
    "uv_index"
  ].join(",");

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${hourlyFields}` +
    `&forecast_days=3` +
    `&temperature_unit=fahrenheit` +
    `&timezone=auto` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  console.log("🌐 OPENMETEO:", url);

  const response = await fetchWithTimeout(url);

  if (!response || !response.ok) {
    console.warn("Open-Meteo failed");

    return respondWithFallback(res, key, "forecast-failed", tempest);
  }

  const data = await response.json();

  if (!data?.hourly?.time?.length) {
    console.warn("Malformed Open-Meteo payload");

    return respondWithFallback(res, key, "malformed", tempest);
  }

  // ----------------------------------------------------------
  // FINAL PAYLOAD
  // ----------------------------------------------------------
  const payload = {
    hourly: data.hourly,

    // 🔥 STRICT: Tempest only (no fallback to forecast)
    current: tempest,

    _source: "open-meteo"
  };

  // ----------------------------------------------------------
  // CACHE
  // ----------------------------------------------------------
  cache[key] = {
    ts: Date.now(),
    data: payload
  };

  lastGood[key] = payload;

  return res.status(200).json(payload);
}

// ------------------------------------------------------------
// TEMPEST (CLEAN + UNIT-SAFE)
// ------------------------------------------------------------
async function fetchTempest() {
  try {
    const stationId = process.env.TEMPEST_STATION_ID;
    const token = process.env.TEMPEST_TOKEN;

    if (!stationId || !token) {
      console.warn("⚠️ Tempest not configured");
      return null;
    }

    const url = `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}`;
    console.log("🌐 TEMPEST FETCH:", url);

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn("❌ Tempest bad response:", res.status);
      return null;
    }

    const data = await res.json();
    const obs = data?.obs?.[0];

    if (!obs) {
      console.warn("❌ Tempest missing obs");
      return null;
    }

    // --------------------------------------------------------
    // RAW VALUES
    // --------------------------------------------------------
    const tempRaw = obs.air_temperature;
    const dewRaw = obs.dew_point;

    console.log("🌡️ RAW TEMPEST TEMP:", tempRaw);
    console.log("🌡️ RAW TEMPEST DEW:", dewRaw);

    // --------------------------------------------------------
    // UNIT HANDLING (SAFE)
    // Tempest is usually already °F
    // Only convert if clearly Celsius
    // --------------------------------------------------------
    const isProbablyCelsius = tempRaw < 60; // heuristic

    const toF = c => (c * 9) / 5 + 32;

    const temp = isProbablyCelsius
      ? Math.round(toF(tempRaw))
      : Math.round(tempRaw);

    const dew_point =
      dewRaw != null
        ? (isProbablyCelsius ? toF(dewRaw) : dewRaw)
        : null;

    console.log("✅ FINAL TEMPEST TEMP:", temp);

    // --------------------------------------------------------
    // FINAL SHAPE
    // --------------------------------------------------------
    return {
      temp,
      dew_point,
      humidity: obs.relative_humidity ?? null,
      wind: obs.wind_avg ?? 0,
      ts: obs.timestamp
    };

  } catch (err) {
    console.warn("❌ Tempest fetch failed:", err);
    return null;
  }
}
// ------------------------------------------------------------
// FALLBACK
// ------------------------------------------------------------
function respondWithFallback(res, key, reason, tempest) {
  const fallback = buildFallback(reason);

  return res.status(200).json({
    ...fallback,
    current: tempest || lastGood[key]?.current || null
  });
}

// ------------------------------------------------------------
// FETCH TIMEOUT
// ------------------------------------------------------------
async function fetchWithTimeout(url, timeout = 4000) {
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

// ------------------------------------------------------------
// FALLBACK SHAPE
// ------------------------------------------------------------
function buildFallback(reason) {
  return {
    hourly: {
      time: [],
      temperature_2m: []
    },
    _fallback: true,
    _reason: reason
  };
}