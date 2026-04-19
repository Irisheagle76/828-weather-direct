// ============================================================
// WEATHER API — V5 (STABLE + LEGACY COMPAT)
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
      error: err.message
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
  // TEMPEST
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
  // OPEN-METEO FETCH
  // ----------------------------------------------------------
  const hourlyFields = [
    "temperature_2m",
    "dew_point_2m",
    "relative_humidity_2m",
    "precipitation",
    "cloudcover",
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
  
console.log("RAW GUST ARRAY:", data.hourly.wind_gusts_10m);
console.log("RAW HOURLY KEYS:", Object.keys(data.hourly));

  if (!data?.hourly?.time?.length) {
    console.warn("⚠️ Empty hourly.time from Open-Meteo");
    return respondWithFallback(res, key, "empty-hourly", tempest);
  }

// ----------------------------------------------------------
// NORMALIZED (NEW SYSTEM)
// ----------------------------------------------------------
const hourly = data.hourly.time.map((t, i) => ({
  timestamp: new Date(t).getTime(),

  temperatureF: data.hourly.temperature_2m?.[i] ?? null,
  dewpointF: data.hourly.dew_point_2m?.[i] ?? null,
  relative_humidity: data.hourly.relative_humidity_2m?.[i] ?? null,

  windSpeed: data.hourly.wind_speed_10m?.[i] ?? 0,
  windGust: data.hourly.wind_gusts_10m?.[i] ?? null,

  precipitation: data.hourly.precipitation?.[i] ?? 0,
  cloudCover: data.hourly.cloudcover?.[i] ?? null,

  uv: data.hourly.uv_index?.[i] ?? null
}));
// ----------------------------------------------------------
// 🆕 SMOOTH TRANSITION WITH TEMPEST
// ----------------------------------------------------------
const hourlySmoothed = smoothTransitionWithTempest(hourly, tempest);
  // ----------------------------------------------------------
  // TEMPEST INTEGRATION SMOOTH
  // ----------------------------------------------------------
function smoothTransitionWithTempest(hourly = [], tempest = null) {
  if (!hourly.length || !tempest?.temperatureF) return hourly;

  const now = Date.now();

  const startIndex = hourly.findIndex(h => h.timestamp >= now);
  if (startIndex === -1) return hourly;

  const first = hourly[startIndex];

  const baseHumidity = first.relative_humidity ?? 50;

  const deltaTemp = tempest.temperatureF - first.temperatureF;

  const deltaHumidity =
    (tempest.relative_humidity ?? baseHumidity) - baseHumidity;

  const deltaWind =
    (tempest.windSpeed ?? first.windSpeed ?? 0) -
    (first.windSpeed ?? 0);

  return hourly.map((h, i) => {
    if (i < startIndex) return h;

    const hoursOut = (h.timestamp - first.timestamp) / 3600000;

    const decay =
      hoursOut <= 1
        ? 1
        : Math.max(0, 1 - hoursOut / 3);

    return {
      ...h,

      temperatureF:
        h.temperatureF != null
          ? h.temperatureF + deltaTemp * decay
          : h.temperatureF,

      relative_humidity:
        h.relative_humidity != null
          ? h.relative_humidity + deltaHumidity * decay
          : h.relative_humidity,

      windSpeed:
        h.windSpeed != null
          ? h.windSpeed + deltaWind * decay
          : h.windSpeed
    };
  });
}

  // ----------------------------------------------------------
  // LEGACY FORMAT (OLD APP SUPPORT)
  // ----------------------------------------------------------
  const hourly_legacy = {
    time: data.hourly.time,
    temperature_2m: data.hourly.temperature_2m,
    relative_humidity_2m: data.hourly.relative_humidity_2m,
    wind_speed_10m: data.hourly.wind_speed_10m
  };

  // ----------------------------------------------------------
  // FINAL PAYLOAD
  // ----------------------------------------------------------
  const payload = {
    hourly: hourlySmoothed,          // ✅ NEW
    hourly_legacy,     // ✅ OLD

    current: tempest,

    current_conditions: tempest
      ? {
          air_temperature: tempest.temperatureF,
          relative_humidity: tempest.relative_humidity,
          wind_gust: tempest.windGust,
          wind_avg: tempest.windSpeed,
          timestamp: tempest.timestamp
        }
      : null,

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
// TEMPEST
// ------------------------------------------------------------
async function fetchTempest() {
  try {
    const stationId = process.env.TEMPEST_STATION_ID;
    const token = process.env.TEMPEST_TOKEN;

    if (!stationId || !token) return null;

    const url =
      `https://swd.weatherflow.com/swd/rest/observations/station/` +
      `${stationId}?token=${token}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;

    const data = await res.json();
    const obs = data?.obs?.[0];
    if (!obs) return null;

    const toF = c => (c * 9) / 5 + 32;

    return {
      timestamp: obs.timestamp,
      temperatureF: Math.round(toF(obs.air_temperature)),
      dewpointF: obs.dew_point != null ? Math.round(toF(obs.dew_point)) : null,
      relative_humidity: obs.relative_humidity ?? null,
      windSpeed: obs.wind_avg ?? 0,
      windGust: obs.wind_gust ?? obs.wind_avg ?? 0
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
    hourly: [],
    hourly_legacy: {
      time: [],
      temperature_2m: [],
      relative_humidity_2m: [],
      wind_speed_10m: []
    },
    _fallback: true,
    _reason: reason,
    current: tempest || lastGood[key]?.current || null
  });
}