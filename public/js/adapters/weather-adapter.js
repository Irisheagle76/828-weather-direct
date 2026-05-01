// ============================================================
// WEATHER ADAPTER — v7 (INCH‑NATIVE + PROB‑NATIVE + CLEAN)
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

  // precipitation is already in inches from weather.js
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
      c.precipProbability ??
      c.precipitation_probability ??
      0, // already 0–1

    isRainingNow: effectivePrecip > 0,

    cloudCover:
      c.cloudCover ??
      c.cloud_cover ??
      c.cloudcover ??
      null // already 0–1
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

          relativeHumidity: hourly.relative_humidity_2m?.[i] ?? null,

          windSpeed: hourly.wind_speed_10m?.[i] ?? 0,
          windGust: hourly.wind_gusts_10m?.[i] ?? null,

          // inches (already correct)
          precipitation: hourly.precipitation?.[i] ?? 0,

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
        daily.precipitation_probability_max?.[i] ?? null // already 0–1
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
  // PRECIP AMOUNT (INCHES, SUPPORT BOTH SHAPES)
  // ------------------------------------------------------------
  let precipAmount = Number.isFinite(h.precipAmount)
    ? h.precipAmount
    : Number.isFinite(h.precipitation)
      ? h.precipitation
      : 0;

  if (precipAmount < 0.005) precipAmount = 0;

  // ------------------------------------------------------------
  // PRECIP PROBABILITY (0–1, SUPPORT BOTH SHAPES)
  // ------------------------------------------------------------
  let precipProbability;

  if (Number.isFinite(h.precipProbability)) {
    precipProbability = h.precipProbability;
  } else if (Number.isFinite(h.precipitation_probability)) {
    const raw = h.precipitation_probability;
    precipProbability = raw > 1 ? raw / 100 : raw;
  } else {
    precipProbability = 0;
  }

  // ------------------------------------------------------------
  // PRECIP TYPE (INCH‑NATIVE)
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

    precipAmount,
    precipProbability,
    precipType,
    isRainingNow: precipAmount > 0,

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
