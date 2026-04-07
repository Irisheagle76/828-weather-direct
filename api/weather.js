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
if (!response.ok) {
  console.log("🚨 ENTERED BAD STATUS BLOCK");

  const text = await response.text();
  console.error("Open-Meteo error:", text);

  console.log("➡️ Trying NWS fallback...");

  const nwsPeriods = await fetchNWS(lat, lon);
  console.log("NWS periods:", nwsPeriods?.length);

  if (nwsPeriods) {
    console.warn("Using NWS fallback");

    const nwsData = normalizeNWS(nwsPeriods);
    console.log("NWS normalized:", nwsData?.time?.length);

    if (nwsData?.time?.length) {
      nwsData._source = "nws";
      lastGood[key] = nwsData;

      return res.status(200).json(nwsData);
    }
  }

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
// NWS NORMALIZER → ENHANCED (ENGINE-COMPATIBLE)
// ------------------------------------------------------------
function normalizeNWS(periods) {
  if (!Array.isArray(periods)) return null;

  // ----------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------

  const parseWind = str => {
    if (!str) return 0;
    const nums = str.match(/\d+/g);
    if (!nums) return 0;

    const values = nums.map(Number);
    return values.length === 2
      ? (values[0] + values[1]) / 2
      : values[0];
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

  const estimateDewpoint = temp => {
    if (temp == null) return null;
    return temp - 10; // simple but effective
  };

  const estimateHumidity = (temp, dew) => {
    if (temp == null || dew == null) return null;
    return Math.max(30, Math.min(95, 100 - (temp - dew) * 2));
  };

  const estimateUV = (temp, cloud) => {
    if (cloud == null) return 0;
    if (cloud < 0.3 && temp > 75) return 7;
    if (cloud < 0.5) return 5;
    return 2;
  };

  // ----------------------------------------------------------
  // BUILD ARRAYS
  // ----------------------------------------------------------

  const time = periods.map(p => p.startTime);

  const temperature = periods.map(p => p.temperature);

  const dewpoint = temperature.map(t => estimateDewpoint(t));

  const humidity = temperature.map((t, i) =>
    estimateHumidity(t, dewpoint[i])
  );

  const cloud = periods.map(p =>
    estimateCloud(p.shortForecast)
  );

  const wind = periods.map(p =>
    parseWind(p.windSpeed)
  );

  const precipitation = periods.map(p => {
    const prob = p.probabilityOfPrecipitation?.value ?? 0;

    if (prob >= 70) return 0.15;
    if (prob >= 50) return 0.08;
    if (prob >= 30) return 0.03;
    return 0;
  });

  const uv = temperature.map((t, i) =>
    estimateUV(t, cloud[i])
  );

  // ----------------------------------------------------------
  // RETURN (MATCHES OPEN-METEO SHAPE)
  // ----------------------------------------------------------

  return {
    time,

    temperature_2m: temperature,

    dew_point_2m: dewpoint,
    relativehumidity_2m: humidity,

    apparent_temperature: temperature,

    precipitation,
    snowfall: Array(periods.length).fill(0),

    cloudcover: cloud,
    visibility: Array(periods.length).fill(null),

    wind_speed_10m: wind,
    wind_gusts_10m: Array(periods.length).fill(null),

    uv_index: uv
  };
}