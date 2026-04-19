// ============================================================
// WEATHER ADAPTER (V3 — CANONICAL + GUST SUPPORT)
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

    precipitation:
      c.precipitation ??
      c.rain ??
      0,

    cloudCover:
      c.cloudCover ??
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
    return hourly.map(normalizeHourObject).filter(Boolean);
  }

  // ------------------------------------------------------------
  // CASE 2: Open-Meteo style (arrays)
  // ------------------------------------------------------------
  if (hourly?.time?.length) {
   return hourly.time
  .map((t, i) =>
    normalizeHourObject({
      timestamp: new Date(t).getTime(),

      temperatureF: hourly.temperature_2m?.[i] ?? null,
      dewpointF: hourly.dew_point_2m?.[i] ?? null,

      relativeHumidity:
        hourly.relative_humidity_2m?.[i] ?? null,

      windSpeed:
        hourly.wind_speed_10m?.[i] ?? 0,

      windGust:
        hourly.wind_gusts_10m?.[i] ?? null,

      precipitation:
        hourly.precipitation?.[i] ?? 0,

      cloudCover:
        hourly.cloudcover?.[i] ?? null,

      uvIndex:
        hourly.uv_index?.[i] ?? null
    })
  )
  .filter(Boolean)
  .sort((a, b) => a.timestamp - b.timestamp);
  console.log("ADAPTER OUTPUT SAMPLE:", hourly[0]);
  
  return [];
}

// ============================================================
// NORMALIZE SINGLE HOUR
// ============================================================

function normalizeHourObject(h) {
  const ts = h.timestamp ?? h.time ?? h.ts;
  if (!ts) return null;

  return {
    timestamp:
      typeof ts === "number"
        ? ts
        : new Date(ts).getTime(),

    // TEMP
    temperatureF:
      h.temperatureF ??
      h.temp ??
      null,

    // DEWPOINT
    dewpointF:
      h.dewpointF ??
      h.dew_point ??
      null,

    // HUMIDITY
    relativeHumidity:
      h.relativeHumidity ??
      h.relative_humidity ??
      h.humidity ??
      null,

    // WIND (FINALIZED)
    windSpeed:
      h.windSpeed ??
      h.wind_speed ??
      h.wind ??
      0,

    windGust:
      h.windGust ??
      h.wind_gust ??
      null,

    // OTHER
    precipitation:
      h.precipitation ??
      h.rain ??
      0,

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
}