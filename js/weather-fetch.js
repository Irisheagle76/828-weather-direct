// /js/weather-fetch.js

const WU_API_KEY = "1c1033ad619046df9033ad6190f6df02";

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
 */
export async function getWUCurrentConditions(stationId) {
  const url =
    `https://api.weather.com/v2/pws/observations/current?stationId=${stationId}` +
    `&format=json&units=e&apiKey=${WU_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("WU current conditions failed: " + res.status);

  const data = await res.json();
  const obs = data.observations[0];

  return {
    temp: obs.imperial?.temp ?? null,
    dewPoint: obs.imperial?.dewpt ?? null,
    humidity: obs.humidity ?? null,
    windSpeed: obs.imperial?.windSpeed ?? null,
    windGust: obs.imperial?.windGust ?? null,
    solarRadiation: obs.solarRadiation ?? null,
    uv: obs.uv ?? null,
    stationId: obs.stationID
  };
}

/**
 * Get short‑term hourly forecast from Open‑Meteo.
 */
export async function getShortTermForecast(lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,dewpoint_2m,precipitation,snowfall,windgusts_10m,uv_index` +
    `&forecast_days=3&timezone=America/New_York` +
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
 * For now, returns "no precip" so nothing breaks.
 */
export async function getMRMSPixel(lat, lon) {
  // This will be updated in the MRMS step.
  return { rate: 0, type: "none", intensity: "none" };
}
