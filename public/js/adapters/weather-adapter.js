// ============================================================
// WEATHER ADAPTER
// Translates fetchAllIntel → UI-friendly format
// ============================================================

import { fetchAllIntel } from '/js/weather-render.js';


// MAIN ENTRY (used by preview)
export async function getWeatherForUI({ lat, lon }) {
  const raw = await fetchAllIntel({ lat, lon });

  return {
    current: adaptCurrent(raw.current),
    hourly: adaptHourly(raw.hourly),
    daily: raw.daily || []
  };
}


// ============================================================
// CURRENT
// ============================================================

function adaptCurrent(current) {
  if (!current) return null;

  return {
    temp: current.temp ?? current.temperature ?? null,
    humidity: current.humidity ?? current.relative_humidity ?? null,
    wind: current.wind ?? current.wind_speed ?? 0
  };
}


// ============================================================
// HOURLY
// ============================================================

function adaptHourly(hourly) {
  if (!hourly?.time?.length) return [];

  return hourly.time.map((t, i) => ({
    time: t,
    temp: hourly.temperature_2m?.[i],
    humidity: hourly.relative_humidity_2m?.[i]
  }));
}