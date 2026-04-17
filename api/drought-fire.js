import { computeDroughtFireIndexLive } from "../lib/drought-fire/computeDroughtFireIndex.js";

// -----------------------------
// CONFIG
// -----------------------------
const LAT = 35.5951;
const LON = -82.5515;

// -----------------------------
// WEATHER FETCH (single source of truth)
// -----------------------------
async function getWeather() {
  try {
    const base =
      process.env.BASE_URL ||
      "https://avlweather.com";

    const url = `${base}/api/weather?type=hourly&lat=${LAT}&lon=${LON}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Weather fetch failed:", res.status);
      return null;
    }

    return await res.json();

  } catch (err) {
    console.warn("Weather fetch error:", err);
    return null;
  }
}

// -----------------------------
// MAIN HANDLER
// -----------------------------
export default async function handler(req, res) {
  try {
    const weather = await getWeather();

    // -----------------------------
    // CURRENT CONDITIONS
    // -----------------------------
    const obs = weather?.current_conditions || weather?.current || null;

    const tempF = obs?.air_temperature ?? obs?.temp ?? 75;
    const rh = obs?.relative_humidity ?? obs?.humidity ?? 40;
    const windGust =
      obs?.wind_gust ??
      weather?.hourly?.wind_gusts_10m?.[0] ??
      5;

    // -----------------------------
    // TEMPERATURE ANOMALY
    // -----------------------------
    const normalTemp = getNormalTemp(weather);
    const tempAnomalyF = tempF - normalTemp;

    // -----------------------------
    // DAYS SINCE RAIN
    // -----------------------------
    const daysSinceRain = getDaysSinceRain(weather);

    // -----------------------------
    // RUN INDEX
    // -----------------------------
    const result = await computeDroughtFireIndexLive({
      tempAnomalyF,
      daysSinceRain,
      rh,
      windGust,
      tempF
    });

    res.status(200).json(result);

  } catch (err) {
    console.error("Drought/Fire API error:", err);

    res.status(500).json({
      error: "failed to compute drought/fire index"
    });
  }
}

// -----------------------------
// HELPERS
// -----------------------------

function getNormalTemp(weather) {
  const temps = weather?.hourly?.temperature_2m;

  if (!temps || !temps.length) return 70;

  // use first 24h average
  const slice = temps.slice(0, 24);
  const avg =
    slice.reduce((a, b) => a + b, 0) / slice.length;

  return avg;
}

function getDaysSinceRain(weather) {
  const precip = weather?.hourly?.precipitation;

  if (!precip || !precip.length) return 10;

  let hours = 0;

  for (let i = 0; i < precip.length; i++) {
    if (precip[i] >= 0.25) {
      return Math.floor(hours / 24);
    }
    hours++;
  }

  return 10;
}