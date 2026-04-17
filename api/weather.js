// ============================================================
// WEATHER API — FINAL (STABLE + CORRECT UNITS)
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
  // CURRENT (TEMPEST)
  // ----------------------------------------------------------
  const tempest = await fetchTempest();

  // ----------------------------------------------------------
  // CACHE HIT
  // ----------------------------------------------------------
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    return res.status(200).json({
      ...cache[key].data,
      current: tempest || cache[key].data.current || null
    });
  }

  // ----------------------------------------------------------
  // FORECAST (OPEN-METEO — ALREADY FAHRENHEIT)
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

  const response = await fetchWithTimeout(url);

  if (!response || !response.ok) {
    return respondWithFallback(res, key, "forecast-failed", tempest);
  }

  const data = await response.json();

  if (!data?.hourly?.time?.length) {
    return respondWithFallback(res, key, "malformed", tempest);
  }

  // ----------------------------------------------------------
  // FINAL PAYLOAD
  // ----------------------------------------------------------
 const payload = {
  hourly: data.hourly,

  // legacy (keep for frontend safety)
  current: tempest,

  // new standardized object (used by drought-fire)
  current_conditions: tempest
    ? {
        air_temperature: tempest.temp,
        relative_humidity: tempest.humidity,
        wind_gust: data.hourly?.wind_gusts_10m?.[0] ?? tempest.wind,
        wind_avg: tempest.wind,
        timestamp: tempest.ts
      }
    : null,

  tempest,
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
// TEMPEST (C → F NORMALIZATION — ONLY PLACE WE CONVERT)
// ------------------------------------------------------------
async function fetchTempest() {
  try {
    const stationId = process.env.TEMPEST_STATION_ID;
    const token = process.env.TEMPEST_TOKEN;

    if (!stationId || !token) {
      return null;
    }

    const url =
      `https://swd.weatherflow.com/swd/rest/observations/station/` +
      `${stationId}?token=${token}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    const obs = data?.obs?.[0];
    if (!obs) return null;

    const tempRaw = obs.air_temperature;
    const dewRaw = obs.dew_point;

    if (tempRaw == null) return null;

    // 🔥 CONFIRMED: Tempest is returning Celsius → convert ONCE
    const toF = c => (c * 9) / 5 + 32;

    const tempF = Math.round(toF(tempRaw));
    const dewF  = dewRaw != null ? Math.round(toF(dewRaw)) : null;

 return {
  temp: tempF,
  dew_point: dewF,
  humidity: obs.relative_humidity ?? null,
  wind: obs.wind_avg ?? 0,
  wind_gust: obs.wind_gust ?? obs.wind_avg ?? 0,
  ts: obs.timestamp
};

  } catch {
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
  return res.status(200).json({
    hourly: {
      time: [],
      temperature_2m: []
    },
    _fallback: true,
    _reason: reason,
    current: tempest || lastGood[key]?.current || null
  });
}