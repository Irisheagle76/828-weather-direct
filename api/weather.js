// ============================================================
// WEATHER API — V10 (HOURLY + DAILY + TEMPEST SAFE)
// ============================================================

let cache = {};
let lastGood = {};

const CACHE_TTL = 60 * 1000;

// ------------------------------------------------------------
// ROUTER
// ------------------------------------------------------------
export default async function handler(req, res) {
  try {
    const { type } = req.query;

    if (type === "hourly") {
      return await handleForecast(req, res);
    }

    return res.status(400).json({ error: "Invalid type" });

  } catch (err) {
    console.error("🚨 TOP LEVEL ERROR:", err);

    return res.status(500).json({
      error: err.message
    });
  }
}

// ------------------------------------------------------------
// MAIN HANDLER (HOURLY + DAILY)
// ------------------------------------------------------------
async function handleForecast(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  const key = `${lat},${lon}`;

  const tempest = await fetchTempest();

  // ----------------------------------------------------------
  // CACHE
  // ----------------------------------------------------------
  if (cache[key] && Date.now() - cache[key].ts < CACHE_TTL) {
    return res.status(200).json({
      ...cache[key].data,
      current: tempest || cache[key].data.current || null
    });
  }

  // ----------------------------------------------------------
  // OPEN-METEO REQUEST (FIXED)
  // ----------------------------------------------------------
  const hourlyFields = [
    "temperature_2m",
    "dew_point_2m",
    "relative_humidity_2m",
    "precipitation",
    "precipitation_probability",
    "cloudcover",
    "wind_speed_10m",
    "wind_gusts_10m",
    "uv_index"
  ].join(",");

  const dailyFields = [
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_probability_max",
    "cloudcover_mean"
  ].join(",");

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=${hourlyFields}` +
    `&daily=${dailyFields}` + // 🔥 ADDED
    `&forecast_days=5` +      // 🔥 INCREASED
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
    return respondWithFallback(res, key, "empty-hourly", tempest);
  }

  // ----------------------------------------------------------
  // NORMALIZE HOURLY
  // ----------------------------------------------------------
  const hourly = data.hourly.time.map((t, i) => ({
    timestamp: new Date(t).getTime(),

    temperatureF: data.hourly.temperature_2m?.[i] ?? null,
    dewpointF: data.hourly.dew_point_2m?.[i] ?? null,
    relative_humidity: data.hourly.relative_humidity_2m?.[i] ?? null,

    windSpeed: data.hourly.wind_speed_10m?.[i] ?? 0,
    windGust: data.hourly.wind_gusts_10m?.[i] ?? null,

    precipitation: data.hourly.precipitation?.[i] ?? 0,
    precipProbability:
      data.hourly.precipitation_probability?.[i] ?? 0,

    cloudCover: data.hourly.cloudcover?.[i] ?? 0,
    uv: data.hourly.uv_index?.[i] ?? null
  }));

  // ----------------------------------------------------------
  // NORMALIZE DAILY (🔥 NEW)
  // ----------------------------------------------------------
  const daily = data.daily?.time?.map((t, i) => ({
    timestamp: new Date(t).getTime(),
    tempMax: data.daily.temperature_2m_max?.[i] ?? null,
    tempMin: data.daily.temperature_2m_min?.[i] ?? null,
    precipProbability:
      data.daily.precipitation_probability_max?.[i] ?? 0,
    cloudCover: data.daily.cloudcover_mean?.[i] ?? 0
  })) || [];

  // ----------------------------------------------------------
  // SMOOTHING
  // ----------------------------------------------------------
  const hourlySmoothed = smoothTransitionWithTempest(hourly, tempest);

  // ----------------------------------------------------------
  // PAYLOAD
  // ----------------------------------------------------------
  const payload = {
    hourly: hourlySmoothed,
    daily, // 🔥 CRITICAL FIX

    current: tempest
      ? {
          ...tempest,
          isRainingNow: (tempest.precipRate ?? 0) > 0
        }
      : null,

    current_conditions: tempest
      ? {
          air_temperature: tempest.temperatureF,
          relative_humidity: tempest.relative_humidity,
          wind_gust: tempest.windGust,
          wind_avg: tempest.windSpeed,
          precip_rate: tempest.precipRate,
          precip: tempest.precip,
          timestamp: tempest.timestamp
        }
      : null,

    _source: "open-meteo+tempest"
  };

  cache[key] = { ts: Date.now(), data: payload };
  lastGood[key] = payload;

  return res.status(200).json(payload);
}

// ============================================================
// TEMPEST
// ============================================================

async function fetchTempest() {
  try {
    const res = await fetch("https://avlweather.com/api/tempest/device");
    if (!res || !res.ok) return null;
    const json = await res.json();
    return json?.current_conditions ?? null;
  } catch {
    return null;
  }
}

// ============================================================
// FALLBACK
// ============================================================

function respondWithFallback(res, key, reason, tempest) {
  console.warn("⚠️ Fallback:", reason);

  if (lastGood[key]) {
    return res.status(200).json({
      ...lastGood[key],
      current: tempest || lastGood[key].current || null
    });
  }

  return res.status(200).json({
    hourly: [],
    daily: [],
    current: tempest || null,
    _fallback: reason
  });
}

// ============================================================
// SMOOTHING
// ============================================================

function smoothTransitionWithTempest(hourly, tempest) {
  if (!tempest || !hourly?.length) return hourly;

  return hourly.map((h, i) => {
    if (i > 0) return h;

    return {
      ...h,
      temperatureF: tempest.temperatureF ?? h.temperatureF,
      windSpeed: tempest.windSpeed ?? h.windSpeed
    };
  });
}

// ============================================================
// FETCH UTIL
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