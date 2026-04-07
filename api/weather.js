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
    `&timezone=America/New_York` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  console.log("🌐 OPENMETEO:", url);

  // ----------------------------------------------------------
  // FETCH WITH TIMEOUT
  // ----------------------------------------------------------
  const response = await fetchWithTimeout(url, 5000);

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
// BAD STATUS
if (!response.ok) {
  const text = await response.text();
  console.error("Open-Meteo error:", text);

  // --------------------------------------------------
  // 🔥 TRY NWS FALLBACK
  // --------------------------------------------------
  const nwsPeriods = await fetchNWS(lat, lon);

  if (nwsPeriods) {
    console.warn("Using NWS fallback");

    const nwsData = normalizeNWS(nwsPeriods);

    if (nwsData?.time?.length) {
      nwsData._source = "nws";
      lastGood[key] = nwsData;

      return res.status(200).json(nwsData);
    }
  }

  // --------------------------------------------------
  // EXISTING FALLBACK
  // --------------------------------------------------
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
    relative_humidity_2m: [],
    precipitation: [],
    snowfall: [],
    cloudcover: [],
    visibility: [],
    wind_speed_10m: [],
    wind_gusts_10m: [],
    uv_index: [],
    _fallback: true,
    _reason: reason
  };
}
// --------------------------------------------------
// NWS Integration begin
// --------------------------------------------------
async function fetchNWS(lat, lon) {
  const headers = {
    "User-Agent": "828-weather-app"
  };

  try {
    // --------------------------------------------------
    // STEP 1: GET GRID
    // --------------------------------------------------
    const pointsRes = await fetch(
      `https://api.weather.gov/points/${lat},${lon}`,
      { headers }
    );

    if (!pointsRes.ok) return null;

    const points = await pointsRes.json();
    const { gridId, gridX, gridY } = points.properties;

    // --------------------------------------------------
    // STEP 2: GET HOURLY FORECAST
    // --------------------------------------------------
    const forecastRes = await fetch(
      `https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast/hourly`,
      { headers }
    );

    if (!forecastRes.ok) return null;

    const forecast = await forecastRes.json();

    return forecast?.properties?.periods ?? null;

  } catch (err) {
    console.warn("NWS fetch failed:", err);
    return null;
  }
}
// ------------------------------------------------------------
// NWS NORMALIZER → MATCHES OPEN-METEO SHAPE
// ------------------------------------------------------------
function normalizeNWS(periods) {
  if (!Array.isArray(periods)) return null;

  const parseWind = str => {
    if (!str) return 0;
    const match = str.match(/\d+/);
    return match ? Number(match[0]) : 0;
  };

  const estimateCloud = text => {
    if (!text) return 0.5;
    const t = text.toLowerCase();

    if (t.includes("clear")) return 0.1;
    if (t.includes("partly")) return 0.4;
    if (t.includes("mostly cloudy")) return 0.8;
    if (t.includes("cloudy")) return 0.9;

    return 0.5;
  };

  return {
    time: periods.map(p => p.startTime),

    temperature_2m: periods.map(p => p.temperature),

    dew_point_2m: Array(periods.length).fill(null),
   relativehumidity_2m: Array(periods.length).fill(null),

    precipitation: periods.map(
      p => (p.probabilityOfPrecipitation?.value ?? 0) / 100
    ),

    apparent_temperature: periods.map(p => p.temperature),
    
    snowfall: Array(periods.length).fill(0),

    cloudcover: periods.map(p => estimateCloud(p.shortForecast)),

    visibility: Array(periods.length).fill(null),

    wind_speed_10m: periods.map(p => parseWind(p.windSpeed)),

    wind_gusts_10m: Array(periods.length).fill(null),

    uv_index: Array(periods.length).fill(0)
  };
}