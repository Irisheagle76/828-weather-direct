// ============================================================
// WEATHER API — v7 (Stable + Predictable)
// - Tempest = current (F)
// - Open-Meteo = forecast (forced F)
// - No unit guessing
// - No duplicate vars
// - No silent crashes
// ============================================================

let cache = {};
let lastGood = {};

const CACHE_TTL = 60 * 1000; // 1 min

// ------------------------------------------------------------
// ROUTER
// ------------------------------------------------------------
export default async function handler(req, res) {
  try {
    const { type } = req.query;

    if (type === "hourly") {
      return await handleHourly(req, res);
    }

    return res.status(400).json({ error: "Invalid type" });

  } catch (err) {
    console.error("🚨 TOP LEVEL ERROR:", err);

    return res.status(500).json({
      error: err.message,
      stack: err.stack
    });
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
  // TEMPEST (CURRENT CONDITIONS)
  // ----------------------------------------------------------
  const tempest = await fetchTempest();

  // ----------------------------------------------------------
  // CACHE HIT
  // ----------------------------------------------------------
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    return res.status(200).json({
      ...cache[key].data,
      current:
        tempest ||
        cache[key].data.current ||
        lastGood[key]?.current ||
        null
    });
  }

  // ----------------------------------------------------------
  // OPEN-METEO (FORECAST)
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
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch` +
    `&timezone=auto`;

  console.log("🌐 OPENMETEO:", url);

  const response = await fetchWithTimeout(url);

  if (!response || !response.ok) {
    console.warn("❌ Open-Meteo failed");
    return respondWithFallback(res, key, "forecast-failed", tempest);
  }

  const data = await response.json();

  if (!data?.hourly?.time?.length) {
    console.warn("❌ Malformed Open-Meteo payload");
    return respondWithFallback(res, key, "malformed", tempest);
  }

  // ----------------------------------------------------------
  // FINAL PAYLOAD
  // ----------------------------------------------------------
  const payload = {
    hourly: data.hourly,
    current: tempest,
    _source: "open-meteo"
  };

  cache[key] = {
    ts: Date.now(),
    data: payload
  };

  lastGood[key] = payload;

  return res.status(200).json(payload);
}

// ------------------------------------------------------------
// TEMPEST (SAFE + SIMPLE)
// ------------------------------------------------------------
async function fetchTempest() {
  console.log("ENV CHECK:", {
    station: process.env.TEMPEST_STATION_ID,
    token: process.env.TEMPEST_TOKEN ? "present" : "missing"
  });

  try {
    const stationId = process.env.TEMPEST_STATION_ID;
    const token = process.env.TEMPEST_TOKEN;


    if (!stationId || !token) {
      console.warn("⚠️ Tempest not configured");
      return null;
    }


    const url =
      `https://swd.weatherflow.com/swd/rest/observations/station/` +
      `${stationId}?token=${token}`;

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

    const tempRaw = obs.air_temperature;
    const dewRaw = obs.dew_point;

    if (tempRaw == null) {
      console.warn("❌ Tempest missing temp");
      return null;
    }

    // Tempest is already Fahrenheit
    return {
      temp: Math.round(tempRaw),
      dew_point: dewRaw ?? null,
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
// FALLBACK
// ------------------------------------------------------------
function respondWithFallback(res, key, reason, tempest) {
  const fallback = {
    hourly: {
      time: [],
      temperature_2m: []
    },
    _fallback: true,
    _reason: reason
  };

  return res.status(200).json({
    ...fallback,
    current:
      tempest ||
      lastGood[key]?.current ||
      null
  });
}