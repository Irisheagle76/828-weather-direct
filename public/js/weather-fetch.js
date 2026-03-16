// /js/weather-fetch.js

const WU_API_KEY = "09a5bd1deb4948caa5bd1deb4968cab8";

/**
 * Get nearest Weather Underground PWS station for a lat/lon.
 */
export async function getNearestWUStation(lat, lon) {
  const url =
    `https://api.weather.com/v3/location/near?geocode=${lat},${lon}` +
    `&product=pws&format=json&apiKey=${WU_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("WU station lookup failed: " + res.status);

  const data = await res.json();
  return {
    stationId: data.location.stationId[0],
    distance: data.location.distance?.[0] ?? null
  };
}

/**
 * Get current conditions from a specific WU PWS station.
 * (Normalized so your app always receives consistent fields.)
 */
export async function getWUCurrentConditions(stationId) {
  const url =
    `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}` +
    `&format=json&units=e&apiKey=${WU_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("WU current conditions failed: " + res.status);

  const data = await res.json();
  const obs = data.observations?.[0];

  if (!obs) {
    return {
      temp: null,
      dewPoint: null,
      humidity: null,
      windSpeed: null,
      windGust: null,
      windDir: null,
      solarRadiation: null,
      uv: null,
      stationId: stationId,
      history: [] // consistent shape
    };
  }

  const imp = obs.imperial || {};

  return {
    temp: imp.temp ?? obs.temperature ?? null,
    dewPoint: imp.dewpt ?? obs.dewpt ?? null,
    humidity: obs.humidity ?? null,

    windSpeed: imp.windSpeed ?? obs.windSpeed ?? null,
    windGust: imp.windGust ?? obs.windGust ?? null,
    windDir: obs.winddir ?? null,

    solarRadiation: obs.solarRadiation ?? null,
    uv: obs.uv ?? null,

    stationId: obs.stationID ?? stationId,

    history: [] // no longer used, but kept for shape
  };
}

/**
 * (Deprecated in your app) — WU hourly history.
 * You are no longer using this for trend detection.
 */
export async function getWUHistory(stationId) {
  const url =
    `https://api.weather.com/v2/pws/observations/hourly?stationId=${stationId}` +
    `&format=json&units=e&apiKey=${WU_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("WU history fetch failed: " + res.status);

  const data = await res.json();
  return data.observations ?? [];
}

/**
 * ⭐ NEW — Get Tempest DEVICE observations (ALWAYS includes today's high/low).
 * This is the correct endpoint for reliable trend detection.
 */
export async function getTempestDeviceObs(deviceId, token) {
  const url =
    `https://swd.weatherflow.com/swd/rest/observations/device/${deviceId}` +
    `?token=${token}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Tempest device obs failed: " + res.status);

  const data = await res.json();
  const obs = data.obs?.[0];

  if (!obs) return null;

  return {
    temp: obs.air_temperature ?? null,
    dewPoint: obs.dew_point ?? null,
    windSpeed: obs.wind_avg ?? null,
    windGust: obs.wind_gust ?? null,
    windDir: obs.wind_direction ?? null,
    pressure: obs.station_pressure ?? null,
    solarRadiation: obs.solar_radiation ?? null,

    // ⭐ Guaranteed on device endpoint
    tempHighToday: obs.air_temperature_hi ?? null,
    tempLowToday: obs.air_temperature_lo ?? null,

    raw: obs
  };
}

/**
 * Get short‑term hourly forecast from Open‑Meteo.
 */
export async function getShortTermForecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=` +
      `temperature_2m,` +
      `dewpoint_2m,` +
      `rain,` +
      `snowfall,` +
      `wind_speed_10m,` +
      `wind_gusts_10m,` +
      `wind_direction_10m,` +
      `cloudcover,` +
      `uv_index` +
    `&forecast_days=3` +
    `&timezone=America/New_York` +
    `&temperature_unit=fahrenheit` +
    `&dewpoint_unit=fahrenheit` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Short-term forecast fetch failed: " + res.status);

  return (await res.json()).hourly;
}

/**
 * Placeholder for MRMS fetch – will be wired to /api/mrms later.
 */
export async function getMRMSPixel(lat, lon) {
  return { rate: 0, type: "none", intensity: "none" };
}
