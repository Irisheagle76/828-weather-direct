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
  console.log("RAW WU OBS:", obs);

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
      stationId: stationId
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
    stationId: obs.stationID ?? stationId
  };
}

/**
 * HRRR via Iowa State IEM, normalized to Open‑Meteo‑like hourly structure.
 */
export async function getHRRRForecast(lat, lon) {
  const url = `https://mesonet.agron.iastate.edu/json/hrrr.php?lat=${lat}&lon=${lon}`;
  console.log("HRRR REQUEST URL:", url);

  const res = await fetch(url);
  if (!res.ok) throw new Error("HRRR fetch failed: " + res.status);

  const data = await res.json();
  console.log("RAW HRRR RESPONSE:", data);

  const hours = data?.data ?? [];

  const hourly = {
    time: [],
    temperature_2m: [],
    dewpoint_2m: [],
    precipitation: [],
    snowfall: [],
    windgusts_10m: [],
    uv_index: []
  };

  for (const h of hours) {
    hourly.time.push(h.valid);                 // ISO timestamp
    hourly.temperature_2m.push(h.tmpf ?? null);
    hourly.dewpoint_2m.push(h.dwpf ?? null);
    hourly.precipitation.push(h.p01m ?? 0);    // 1‑hr precip
    hourly.snowfall.push(h.snow ?? 0);         // if present
    hourly.windgusts_10m.push(h.gust ?? null);
    hourly.uv_index.push(null);                // HRRR doesn’t provide UV
  }

  console.log("NORMALIZED HRRR HOURLY:", hourly);
  return hourly;
}

/**
 * Get short‑term hourly forecast.
 * NOW: HRRR primary, Open‑Meteo as fallback (kept, but commented).
 */
export async function getShortTermForecast(lat, lon) {
  try {
    // Primary: HRRR (IEM)
    const hourly = await getHRRRForecast(lat, lon);
    console.log("USING HRRR HOURLY FORECAST");
    return hourly;
  } catch (err) {
    console.error("HRRR failed, falling back to Open‑Meteo:", err);
  }

  // Fallback: Open‑Meteo (kept for safety)
  /*
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,dewpoint_2m,precipitation,snowfall,windgusts_10m,uv_index` +
    `&forecast_days=3&timezone=America/New_York` +
    `&temperature_unit=fahrenheit` +
    `&dewpoint_unit=fahrenheit` +
    `&wind_speed_unit=mph` +
    `&precipitation_unit=inch`;

  console.log("OPEN-METEO REQUEST URL:", url);

  const res = await fetch(url);
  if (!res.ok) throw new Error("Short-term forecast fetch failed: " + res.status);

  const data = await res.json();
  console.log("OPEN-METEO RAW RESPONSE:", data);

  const hourly = data.hourly;
  console.log("OPEN-METEO FIRST HOUR:", hourly?.time?.[0]);
  console.log("OPEN-METEO LAST HOUR:", hourly?.time?.slice(-1)?.[0]);
  console.log("LOCAL NOW:", new Date().toString());

  return hourly;
  */

  // If both fail, return an empty structure so the app doesn’t explode.
  return {
    time: [],
    temperature_2m: [],
    dewpoint_2m: [],
    precipitation: [],
    snowfall: [],
    windgusts_10m: [],
    uv_index: []
  };
}

/**
 * Placeholder for MRMS fetch – will be wired to /api/mrms later.
 * For now, returns "no precip" so nothing breaks.
 */
export async function getMRMSPixel(lat, lon) {
  return { rate: 0, type: "none", intensity: "none" };
}
