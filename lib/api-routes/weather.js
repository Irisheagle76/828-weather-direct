// ============================================================
// WEATHER API — V13 (RAIN‑HONEST + NORMALIZED + STABLE)
// ============================================================

import { normalizeHourly } from "../normalizeWeather.js";

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
    return res.status(500).json({ error: err.message });
  }
}

// ------------------------------------------------------------
// MAIN HANDLER
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
  // REQUEST (RAIN INCLUDED)
// ----------------------------------------------------------
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,dew_point_2m,relative_humidity_2m,precipitation,rain,precipitation_probability,cloudcover,wind_speed_10m,wind_gusts_10m,uv_index,weather_code` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,cloudcover_mean,sunrise,sunset` +
    `&forecast_days=5` +
    `&temperature_unit=fahrenheit` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch` +
    `&timezone=auto` +
    `&timeformat=unixtime`;

  const response = await fetchWithTimeout(url, 12000);

  if (!response || !response.ok) {
    return respondWithFallback(res, key, "forecast-failed", tempest);
  }

  const data = await response.json();

  if (!data?.hourly?.time?.length) {
    return respondWithFallback(res, key, "empty-hourly", tempest);
  }

  // ----------------------------------------------------------
  // RAW HOURLY (RAIN-FIRST, INCH-NATIVE)
// ----------------------------------------------------------
  const rawHourly = data.hourly.time.map((t, i) => {
    const rainIn = data.hourly.rain?.[i];
    const precipIn = data.hourly.precipitation?.[i];

    const finalPrecip =
      Number.isFinite(rainIn) ? rainIn :
      Number.isFinite(precipIn) ? precipIn :
      0;

    return {
      timestamp: normalizeOpenMeteoTimestamp(t),

      temperatureF: data.hourly.temperature_2m?.[i] ?? null,
      dewpointF: data.hourly.dew_point_2m?.[i] ?? null,
      relativeHumidity: data.hourly.relative_humidity_2m?.[i] ?? null,

      windSpeed: data.hourly.wind_speed_10m?.[i] ?? 0,
      windGust: data.hourly.wind_gusts_10m?.[i] ?? null,

      // inches of rain (or total precip if rain missing)
      precipitation: finalPrecip,

      // Open-Meteo sends probability as 0-100 percent.
      precipProbability: normalizeOpenMeteoPercent(
        data.hourly.precipitation_probability?.[i]
      ),

      // Open-Meteo sends cloud cover as 0-100 percent.
      cloudCover: normalizeOpenMeteoPercent(
        data.hourly.cloudcover?.[i]
      ),

      uvIndex: data.hourly.uv_index?.[i] ?? null,
      weatherCode: data.hourly.weather_code?.[i] ?? null
    };
  });

  // ----------------------------------------------------------
  // FINAL HOURLY NORMALIZATION
  // ----------------------------------------------------------
  const hourly = normalizeHourly(rawHourly);

  // ----------------------------------------------------------
  // DAILY NORMALIZATION
  // ----------------------------------------------------------
  const daily = (data.daily?.time || []).map((t, i) => ({
    timestamp: normalizeOpenMeteoTimestamp(t),

    tempMax: data.daily.temperature_2m_max?.[i] ?? null,
    tempMin: data.daily.temperature_2m_min?.[i] ?? null,

    precipProbability: normalizeOpenMeteoPercent(
      data.daily.precipitation_probability_max?.[i]
    ),

    cloudCover: normalizeOpenMeteoPercent(
      data.daily.cloudcover_mean?.[i]
    ),

    sunrise: normalizeOpenMeteoTimestamp(data.daily.sunrise?.[i]),
    sunset: normalizeOpenMeteoTimestamp(data.daily.sunset?.[i])
  }));

  // ----------------------------------------------------------
  // TEMPEST SMOOTHING
  // ----------------------------------------------------------
  const hourlySmoothed = smoothTransitionWithTempest(hourly, tempest);

  // ----------------------------------------------------------
  // PAYLOAD
  // ----------------------------------------------------------
  const payload = {
    hourly: hourlySmoothed,
    daily,

    current: tempest
      ? {
          ...tempest,
          isRainingNow: (tempest.precipRate ?? 0) > 0
        }
      : null,

    _source: "open-meteo+tempest"
  };

  cache[key] = { ts: Date.now(), data: payload };
  lastGood[key] = payload;

  console.log("=== WEATHER NORMALIZED ===");
  console.log("hourly sample:", hourlySmoothed.slice(0, 5));
 console.log("daily sample:", daily.slice(0, 3));

  return res.status(200).json(payload);
}

// ============================================================
// HELPERS
// ============================================================

function normalizeOpenMeteoPercent(val) {
  if (!Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(1, val / 100));
}

function normalizeOpenMeteoTimestamp(t) {
  if (Number.isFinite(t)) return t < 1e12 ? t * 1000 : t;
  return new Date(t).getTime();
}

// ============================================================
// TEMPEST
// ============================================================

async function fetchTempest() {
  try {
    const res = await fetch("https://avlweather.com/api/router?route=tempest/device");
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
