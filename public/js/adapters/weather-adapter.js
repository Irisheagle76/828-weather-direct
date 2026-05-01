// ============================================================
// WEATHER ADAPTER — v8 (INCH‑NATIVE + PROB‑NATIVE + CLEAN)
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

  // precipitation already in inches from weather.js
  const precipAmount = Number.isFinite(c.precipitation)
    ? c.precipitation
    : Number.isFinite(c.rain)
      ? c.rain
      : 0;

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

    precipAmount: effectivePrecip,
    precipProbability:
      Number.isFinite(c.precipProbability)
        ? c.precipProbability
        : Number.isFinite(c.precipitation_probability)
          ? (c.precipitation_probability > 1
              ? c.precipitation_probability / 100
              : c.precipitation_probability)
          : 0,

    isRainingNow: effectivePrecip > 0,

    cloudCover:
      Number.isFinite(c.cloudCover)
        ? c.cloudCover
        : Number.isFinite(c.cloud_cover)
          ? c.cloud_cover
          : Number.isFinite(c.cloudcover)
            ? c.cloudcover
            : null
  };
}

// ============================================================
// HOURLY NORMALIZATION
// ============================================================

function adaptHourly(hourly) {
  if (!hourly) return [];

  // Already normalized array from backend
  if (Array.isArray(hourly)) {
    return hourly.map(normalizeHourObject).filter(Boolean);
  }

  // Raw Open-Meteo shape
  if (hourly?.time?.length) {
    return hourly.time
      .map((t, i) =>
        normalizeHourObject({
          timestamp: new Date(t).getTime(),

          temperatureF: hourly.temperature_2m?.[i] ?? null,
          dewpointF: hourly.dew_point_2m?.[i] ?? null,

          relativeHumidity: hourly.relative_humidity_2m?.[i] ?? null,

          windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
          windGust: hourly.wind_gusts_10m?.[i] ?? null,

          // inches (already correct)
          precipAmount: hourly.precipitation?.[i] ?? 0,

          // 0–1
          precipProbability: hourly.precipitation_probability?.[i] ?? 0,

          // 0–1
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
        Number.isFinite(daily.precipitation_probability_max?.[i])
          ? (daily.precipitation_probability_max[i] > 1
              ? daily.precipitation_probability_max[i] / 100
              : daily.precipitation_probability_max[i])
          : 0
    }));
  }

  return [];
}

// ============================================================
// NORMALIZE SINGLE HOUR (FINAL, CLEAN)
// ============================================================

function normalizeHourObject(h) {
  const ts = h.timestamp ?? h.time ?? h.ts;
  if (!ts) return null;

  // ------------------------------------------------------------
  // PRECIP AMOUNT (INCHES)
// ------------------------------------------------------------
  let precipAmount = Number.isFinite(h.precipAmount)
    ? h.precipAmount
    : 0;

  if (precipAmount < 0.005) precipAmount = 0;

  // ------------------------------------------------------------
  // PRECIP PROBABILITY (0–1)
// ------------------------------------------------------------
  let precipProbability = 0;

  if (Number.isFinite(h.precipProbability)) {
    precipProbability = h.precipProbability;
  }

  // ------------------------------------------------------------
  // PRECIP TYPE
// ------------------------------------------------------------
  let precipType = "none";

  if (precipAmount > 0 || precipProbability >= 0.45) {
    if (precipAmount < 0.005) {
      precipType = precipProbability >= 0.5 ? "drizzle" : "sprinkles";
    } else if (precipAmount < 0.03) {
      precipType = precipProbability >= 0.6 ? "light_rain" : "isolated_showers";
    } else if (precipAmount < 0.1) {
      precipType = precipProbability >= 0.6 ? "steady_rain" : "scattered_showers";
    } else {
      precipType = "soaking_rain";
    }
  }

  const timestamp =
    typeof ts === "number" ? ts : new Date(ts).getTime();

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

    precipAmount,
    precipProbability,
    precipType,
    isRainingNow: precipAmount > 0,

    cloudCover:
      Number.isFinite(h.cloudCover)
        ? h.cloudCover
        : Number.isFinite(h.cloud_cover)
          ? h.cloud_cover
          : null,

    uvIndex:
      h.uvIndex ??
      h.uv_index ??
      null
  };
}
