import { computeDroughtFireIndexLive } from "../lib/drought-fire/computeDroughtFireIndex.js";

// -----------------------------
// CONFIG
// -----------------------------
const LAT = 35.5951;
const LON = -82.5515;

const AVL_MONTHLY_MEAN_TEMP_NORMALS_F = [
  38.7, 42.1, 48.4, 57.0, 64.8, 71.8,
  75.1, 74.0, 68.3, 57.9, 47.8, 41.4
];

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
    const trendInput = getTrendInput(weather, {
      tempAnomalyF,
      daysSinceRain,
      rh,
      windGust,
      tempF
    });

    // -----------------------------
    // DEBUG INPUTS (important)
    // -----------------------------
    console.log("📥 INPUT CHECK:", {
      tempAnomalyF,
      daysSinceRain,
      rh,
      windGust,
      tempF
    });

    // -----------------------------
    // RUN INDEX
    // -----------------------------
    const result = await computeDroughtFireIndexLive({
      tempAnomalyF,
      daysSinceRain,
      rh,
      windGust,
      tempF,
      trendInput
    });

    console.log("✅ DROUGHT/FIRE RESULT:", result);

    res.status(200).json(result);

  } catch (err) {
    console.error("🔥 DROUGHT/FIRE ERROR:", err);

    res.status(500).json({
      error: err.message,
      stack: err.stack
    });
  }
}

// -----------------------------
// HELPERS
// -----------------------------

function getNormalTemp(weather) {
  return AVL_MONTHLY_MEAN_TEMP_NORMALS_F[new Date().getMonth()];
}

function getDaysSinceRain(weather) {
  const precip = getHourlyPrecipSeries(weather);

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

function getHourlyPrecipSeries(weather) {
  const hourly = weather?.hourly;

  if (Array.isArray(hourly)) {
    return hourly.map(h => h?.precipAmount ?? h?.precipitation ?? 0);
  }

  return hourly?.precipitation ?? null;
}

function getTrendInput(weather, current) {
  const hours = Array.isArray(weather?.hourly) ? weather.hourly : [];
  const target = getFutureHour(hours, 6);

  if (!target) return null;

  const futureTempF =
    target.temperatureF ??
    target.temperature_2m ??
    current.tempF;

  const futureRh =
    target.relativeHumidity ??
    target.relative_humidity ??
    current.rh;

  const futureWindGust =
    target.windGust ??
    target.wind_gust ??
    target.wind_gusts_10m ??
    current.windGust;

  const rainNext6h = sumRainThrough(hours, target.timestamp);

  return {
    tempAnomalyF: futureTempF - getNormalTemp(weather),
    daysSinceRain: rainNext6h >= 0.25
      ? 0
      : current.daysSinceRain + 0.25,
    rh: futureRh,
    windGust: futureWindGust,
    tempF: futureTempF
  };
}

function getFutureHour(hours, hoursAhead) {
  const targetTs = Date.now() + hoursAhead * 60 * 60 * 1000;
  let best = null;
  let bestDiff = Infinity;

  for (const h of hours) {
    const ts = h?.timestamp;
    if (!Number.isFinite(ts)) continue;

    const diff = Math.abs(ts - targetTs);
    if (diff < bestDiff) {
      best = h;
      bestDiff = diff;
    }
  }

  return best;
}

function sumRainThrough(hours, endTs) {
  if (!Number.isFinite(endTs)) return 0;
  const now = Date.now();

  return hours.reduce((total, h) => {
    const ts = h?.timestamp;
    if (!Number.isFinite(ts) || ts < now || ts > endTs) return total;
    const amount = h.precipAmount ?? h.precipitation ?? 0;
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}
