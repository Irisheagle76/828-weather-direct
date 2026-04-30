// ============================================================
// WEATHER ADAPTER — v6 (UNIT-SAFE + HONEST PRECIP)
// ============================================================

import { fetchAllIntel } from '/js/weather-fetch.js';

// 🌧️ UNIT CONSTANT
const MM_TO_IN = 0.0393701;

// ============================================================
// MAIN ENTRY
// ============================================================

export async function getWeatherForUI({ lat, lon }) {
  const raw = await fetchAllIntel({ lat, lon });

  return {
    current: adaptCurrent(raw?.current || raw?.current_conditions),
    hourly: adaptHourly(raw?.hourly),
    daily: adaptDaily(raw?.daily),

    tempest: raw?.current_conditions ?? null,
    wind_station: raw?.wind_station ?? null
  };
}

// ============================================================
// CURRENT CONDITIONS
// ============================================================

function adaptCurrent(c) {
  if (!c) return null;

  const rawPrecip =
    c.precipitation ??
    c.rain ??
    0;

  const isMetric = c.precipitation != null && c.rain == null;

  const precipAmount = isMetric
    ? rawPrecip * MM_TO_IN
    : rawPrecip;

  // Treat tiny noise as dry
  const effectivePrecip = precipAmount < 0.005 ? 0 : precipAmount;

  return {
    timestamp: c.timestamp ?? c.time ?? Date.now(),

    temperatureF:
      c.temperatureF ??
      c.temp ??
      c.temperature ??
      c.air_temperature ??
      null,

    dewpointF:
      c.dewpointF ??
      c.dew_point ??
      null,

    relativeHumidity:
      c.relativeHumidity ??
      c.relative_humidity ??
      c.humidity ??
      null,

    windSpeed:
      c.windSpeed ??
      c.wind_speed ??
      c.wind ??
      c.wind_avg ??
      0,

    windGust:
      c.windGust ??
      c.wind_gust ??
      null,

    // 🌧️ PRECIP
    precipAmount: effectivePrecip,
    precipProbability:
      c.precipitation_probability ??
      c.precipProbability ??
      0,

    isRainingNow: effectivePrecip > 0,

    cloudCover:
      c.cloudCover ??
      c.cloud_cover ??
      c.cloudcover ??
      null
  };
}

// ============================================================
// HOURLY NORMALIZATION
// ============================================================

function adaptHourly(hourly) {
  if (!hourly) return [];

  if (Array.isArray(hourly)) {
    return hourly.map(normalizeHourObject).filter(Boolean);
  }

  if (hourly?.time?.length) {
    return hourly.time
      .map((t, i) =>
        normalizeHourObject({
          timestamp: new Date(t).getTime(),

          temperatureF: hourly.temperature_2m?.[i] ?? null,
          dewpointF: hourly.dew_point_2m?.[i] ?? null,

          relativeHumidity:
            hourly.relative_humidity_2m?.[i] ?? null,

          windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
          windGust: hourly.wind_gusts_10m?.[i] ?? null,

          // 👇 RAW MM VALUE
          precipitation: hourly.precipitation?.[i] ?? 0,

          precipitation_probability:
            hourly.precipitation_probability?.[i] ?? null,

          cloudCover: hourly.cloudcover?.[i] ?? null,
          uvIndex: hourly.uv_index?.[i] ?? null
        })
      )
      .filter(Boolean)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  return [];
}

// ============================================================
// DAILY NORMALIZATION
// ============================================================

function adaptDaily(daily) {
  if (!daily) return [];

  if (daily?.time?.length) {
    return daily.time.map((t, i) => ({
      date: t,

      tempMax: daily.temperature_2m_max?.[i] ?? null,
      tempMin: daily.temperature_2m_min?.[i] ?? null,

      precipProbabilityMax:
        daily.precipitation_probability_max?.[i] ?? null
    }));
  }

  return [];
}

// ============================================================
// NORMALIZE SINGLE HOUR (CORE LOGIC — FIXED)
// ============================================================

function normalizeHourObject(h) {
  const ts = h.timestamp ?? h.time ?? h.ts;
  if (!ts) return null;

  // ------------------------------------------------------------
  // 🌧️ UNIT-SAFE PRECIP (FIXED)
  // ------------------------------------------------------------
  const rawPrecip =
    h.precipitation ??
    h.rain ??
    0;

  const isMetric =
    h.precipitation != null && h.rain == null;

  const precipAmount = isMetric
    ? rawPrecip * MM_TO_IN
    : rawPrecip;

  // Ignore microscopic noise (< 0.005")
  const effectivePrecip = precipAmount < 0.005 ? 0 : precipAmount;

  // Use raw probability; never force 70%
  const rawProbability =
    h.precipProbability ??
    h.precipitation_probability ??
    0;

  const precipProbability = rawProbability ?? 0;

  // ------------------------------------------------------------
  // 🌧️ PRECIP TYPE (TUNED FOR INCHES, FIXED)
// ------------------------------------------------------------
  let precipType = "none";

  if (effectivePrecip > 0 || precipProbability >= 20) {

    if (effectivePrecip < 0.005) {
      precipType =
        precipProbability >= 50 ? "drizzle" : "sprinkles";
    }

    else if (effectivePrecip < 0.03) {
      precipType =
        precipProbability >= 60 ? "light_rain" : "isolated_showers";
    }

    else if (effectivePrecip < 0.1) {
      precipType =
        precipProbability >= 60 ? "steady_rain" : "scattered_showers";
    }

    else {
      precipType = "soaking_rain";
    }
  }

  const timestamp =
    typeof ts === "number"
      ? ts
      : new Date(ts).getTime();

  return {
    timestamp,

    temperatureF: h.temperatureF ?? h.temp ?? null,
    dewpointF: h.dewpointF ?? h.dew_point ?? null,

    relativeHumidity:
      h.relativeHumidity ??
      h.relative_humidity ??
      h.humidity ??
      null,

    windSpeed:
      h.windSpeed ??
      h.wind_speed ??
      h.wind ??
      0,

    windGust:
      h.windGust ??
      h.wind_gust ??
      null,

    // 🌧️ FINAL MODEL (FIXED)
    precipAmount: effectivePrecip,
    precipProbability,
    precipType,
    isRainingNow: effectivePrecip > 0,

    cloudCover:
      h.cloudCover ??
      h.cloud_cover ??
      null,

    uvIndex:
      h.uvIndex ??
      h.uv_index ??
      null
  };
}
