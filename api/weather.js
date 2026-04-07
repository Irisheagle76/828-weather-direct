// /api/weather.js
// ============================================================
// WEATHER API — v3 (RESILIENT + FAST)
// - Caching
// - Timeout protection
// - Last-good fallback
// - Never hangs
// ============================================================

let cache = {};
let lastGood = {};
const CACHE_TTL = 60 * 1000; // 1 minute

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

    return res.status(200).json(buildFallbackHourly("router-exception"));
  }
}

// ------------------------------------------------------------
// HOURLY HANDLER
// ------------------------------------------------------------
async function handleHourly(req, res) {
  const { lat, lon } = req.query;

  // ----------------------------------------------------------
  // VALIDATION
  // ----------------------------------------------------------
  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const key = `${lat},${lon}`;

  // ----------------------------------------------------------
  // CACHE HIT (FAST PATH)
  // ----------------------------------------------------------
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    return res.status(200).json(cache[key].data);
  }

  // ----------------------------------------------------------
  // BUILD URL
  // ----------------------------------------------------------
  const hourlyFields = [
    "temperature_2m",
    "apparent_temperature",
    "dew_point_2m",
    "relativehumidity_2m",
    "precipitation",
    "snowfall",
    "cloudcover",
    "visibility",
    "wind_speed_10m",
    "windgusts_10m",
    "uv_index"
  ].join(",");

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${hourlyFields}` +
    `&forecast_days=3` +
    `&temperature_unit=fahrenheit` +
    `&timezone=America/New_York` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  console.log("🌐 OPENMETEO:", url);

  // ----------------------------------------------------------
  // FETCH WITH TIMEOUT
  // ----------------------------------------------------------
  const response = await fetchWithTimeout(url, 3500);

  // ----------------------------------------------------------
  // TIMEOUT / NETWORK FAILURE
  // ----------------------------------------------------------
  if (!response) {
    console.warn("⚠️ Open-Meteo timeout");

    if (lastGood[key]) {
      console.warn("⚠️ Using last known good forecast");
      return res.status(200).json(lastGood[key]);
    }

    return res.status(200).json(buildFallbackHourly("timeout"));
  }

  // ----------------------------------------------------------
  // BAD STATUS
  // ----------------------------------------------------------
  if (!response.ok) {
    const text = await response.text();
    console.error("Open-Meteo error:", text);

    if (lastGood[key]) {
      return res.status(200).json(lastGood[key]);
    }

    return res.status(200).json(
      buildFallbackHourly(`bad-status-${response.status}`)
    );
  }

  // ----------------------------------------------------------
  // PARSE DATA
  // ----------------------------------------------------------
  const data = await response.json();

  // ----------------------------------------------------------
  // VALIDATE
  // ----------------------------------------------------------
  if (!data?.hourly || !Array.isArray(data.hourly.time)) {
    console.error("Bad Open-Meteo payload:", data);

    if (lastGood[key]) {
      return res.status(200).json(lastGood[key]);
    }

    return res.status(200).json(buildFallbackHourly("malformed"));
  }

  // ----------------------------------------------------------
  // SUCCESS → CACHE + LAST GOOD
  // ----------------------------------------------------------
  cache[key] = {
    ts: Date.now(),
    data: data.hourly
  };

  lastGood[key] = data.hourly;

  return res.status(200).json(data.hourly);
}

// ------------------------------------------------------------
// TIMEOUT FETCH
// ------------------------------------------------------------
async function fetchWithTimeout(url, timeout = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    return null;
  }
}

// ------------------------------------------------------------
// FALLBACK SHAPE (CONSISTENT)
// ------------------------------------------------------------
function buildFallbackHourly(reason) {
  return {
    time: [],
    temperature_2m: [],
    dew_point_2m: [],
    relativehumidity_2m: [],
    precipitation: [],
    snowfall: [],
    cloudcover: [],
    visibility: [],
    wind_speed_10m: [],
    windgusts_10m: [],
    uv_index: [],
    _fallback: true,
    _reason: reason
  };
}