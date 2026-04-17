// ============================================================
// WEATHER ADAPTER (V2 — CANONICAL SCHEMA)
// ============================================================

import { fetchAllIntel } from '/js/weather-fetch.js';

// ============================================================
// MAIN ENTRY
// ============================================================

export async function getWeatherForUI({ lat, lon }) {
  const raw = await fetchAllIntel({ lat, lon });

  return {
    current: adaptCurrent(raw?.current || raw?.current_conditions),
    hourly: adaptHourly(raw?.hourly),
    daily: raw?.daily || []
  };
}

// ============================================================
// CURRENT → NORMALIZED
// ============================================================

function adaptCurrent(c) {
  if (!c) return null;

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

    relative_humidity:
      c.relative_humidity ??
      c.humidity ??
      null,

    windSpeed:
      c.windSpeed ??
      c.wind_speed ??
      c.wind ??
      c.wind_avg ??
      0,

    precipitation:
      c.precipitation ??
      c.rain ??
      0,

    cloudCover:
      c.cloud_cover ??
      c.cloudcover ??
      null
  };
}

// ============================================================
// HOURLY → NORMALIZED ARRAY
// ============================================================

function adaptHourly(hourly) {
  if (!hourly) return [];

  // ------------------------------------------------------------
  // CASE 1: Already normalized (array)
  // ------------------------------------------------------------
  if (Array.isArray(hourly)) {
    return hourly.map(h => normalizeHourObject(h)).filter(Boolean);
  }

  // ------------------------------------------------------------
  // CASE 2: Open-Meteo style (arrays)
  // ------------------------------------------------------------
  if (hourly?.time?.length) {
    return hourly.time.map((t, i) => normalizeHourObject({
      timestamp: new Date(t).getTime(),

      temperatureF: hourly.temperature_2m?.[i],
      dewpointF: hourly.dewpoint_2m?.[i],
      relative_humidity: hourly.relative_humidity_2m?.[i],
      windSpeed: hourly.wind_speed_10m?.[i],
      precipitation: hourly.precipitation?.[i],
      cloudCover: hourly.cloudcover?.[i]
    })).filter(Boolean);
  }

  console.warn("⚠️ Unknown hourly format:", hourly);
  return [];
}

// ============================================================
// NORMALIZE SINGLE HOUR
// ============================================================

function normalizeHourObject(h) {
  const ts = h.timestamp ?? h.time ?? h.ts;

  if (!ts) return null;

  return {
    timestamp: typeof ts === "number" ? ts : new Date(ts).getTime(),

    temperatureF:
      h.temperatureF ??
      h.temp ??
      h.temperature ??
      null,

    dewpointF:
      h.dewpointF ??
      h.dew ??
      null,

    relative_humidity:
      h.relative_humidity ??
      h.humidity ??
      null,

    windSpeed:
      h.windSpeed ??
      h.wind_speed ??
      0,

    precipitation:
      h.precipitation ??
      h.rain ??
      0,

    cloudCover:
      h.cloudCover ??
      h.cloud_cover ??
      null
  };
}