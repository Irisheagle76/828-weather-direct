// ============================================================
// WEATHER API — v4 (TEMPEST-FIRST, STABLE)
// - Tempest = current truth
// - Open-Meteo = forecast
// - Persistent current conditions
// - Cache-safe + fallback-safe
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
  // ALWAYS FETCH TEMPEST (DO THIS FIRST)
  // ----------------------------------------------------------
  const tempest = await fetchTempest();

  // ----------------------------------------------------------
  // CACHE HIT → merge Tempest into cached data
  // ----------------------------------------------------------
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    return res.status(200).json({
      ...cache[key].data,
      current: tempest || cache[key].data.current || lastGood[key]?.current || null
    });
  }

  // ----------------------------------------------------------
  // BUILD OPEN-METEO URL
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
    `&current_weather=true` +
    `&hourly=${hourlyFields}` +
    `&forecast_days=3` +
    `&temperature_unit=fahrenheit` +
    `&timezone=auto` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  console.log("🌐 OPENMETEO:", url);

  // ----------------------------------------------------------
  // FETCH WITH TIMEOUT
  // ----------------------------------------------------------
  const response = await fetchWithTimeout(url);

  if (!response) {
    console.warn("Open-Meteo timeout");

    return respondWithFallback(res, key, "timeout", tempest);
  }

  if (!response.ok) {
    console.warn("Open-Meteo bad status:", response.status);

    return respondWithFallback(res, key, `bad-status-${response.status}`, tempest);
  }

  const data = await response.json();

  if (!data?.hourly?.time?.length) {
    console.warn("Malformed Open-Meteo payload");

    return respondWithFallback(res, key, "malformed", tempest);
  }

  // ----------------------------------------------------------
  // BUILD FINAL PAYLOAD
  // ----------------------------------------------------------
  const payload = {
    hourly: data.hourly,
    current_weather: data.current_weather,

    // 🔥 authoritative current
    current: tempest || lastGood[key]?.current || null,

    _source: "open-meteo"
  };

  // ----------------------------------------------------------
  // CACHE + LAST GOOD
  // ----------------------------------------------------------
  cache[key] = {
    ts: Date.now(),
    data: payload
  };

  lastGood[key] = payload;

  return res.status(200).json(payload);
}

// ------------------------------------------------------------
// TEMPEST FETCH YOUR STATION
// ------------------------------------------------------------
async function fetchTempest() {
  try {
    const stationId = process.env.TEMPEST_STATION_ID;
    const token = process.env.TEMPEST_TOKEN;

    if (!stationId || !token) {
      console.warn("Tempest not configured");
      return null;
    }

    const res = await fetch(
      `https://swd.weatherflow.com/swd/rest/observations/station/${stationId}?token=${token}`,
      { cache: "no-store" }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const obs = data?.obs?.[0];
    if (!obs) return null;

    return {
      const cToF = c => (c * 9) / 5 + 32;

temp: Math.round(cToF(obs.air_temperature)),
      humidity: obs.relative_humidity,
      wind: obs.wind_avg,
      ts: obs.timestamp
    };

  } catch (err) {
    console.warn("Tempest fetch failed");
    return null;
  }
}

// ------------------------------------------------------------
// FALLBACK RESPONSE (WITH TEMPEST)
// ------------------------------------------------------------
function respondWithFallback(res, key, reason, tempest) {
  const fallback = buildFallback(reason);

  return res.status(200).json({
    ...fallback,
    current: tempest || lastGood[key]?.current || null
  });
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