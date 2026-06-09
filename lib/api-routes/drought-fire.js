import { computeDroughtFireIndexLive } from "../drought-fire/computeDroughtFireIndex.js";

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

    const url = `${base}/api/router?route=weather&type=hourly&lat=${LAT}&lon=${LON}`;

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

    const tempF =
      obs?.temperatureF ??
      obs?.tempF ??
      obs?.temp ??
      cToF(obs?.air_temperature) ??
      75;
    const rh = obs?.relative_humidity ?? obs?.humidity ?? 40;

    const windGust =
      obs?.windGust ??
      obs?.wind_gust_mph ??
      msToMph(obs?.wind_gust) ??
      weather?.hourly?.wind_gusts_10m?.[0] ??
      5;
    const rainRateInHr = obs?.precipRate ?? obs?.precip_rate ?? 0;
    const rainTodayIn =
      obs?.precipAccumLocalDay ??
      obs?.precip_accum_local_day ??
      obs?.local_day_precip_accum ??
      getRainTodayFromHourly(weather);
    const rainNext6hIn = getRainNextHours(weather, 6);
    const precipProbabilityToday = getTodayPrecipProbability(weather);

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
      tempF,
      rainTodayIn,
      rainRateInHr,
      rainNext6hIn,
      precipProbabilityToday
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
      rainTodayIn,
      rainRateInHr,
      rainNext6hIn,
      precipProbabilityToday,
      trendInput
    });

    res.status(200).json({
      ...result,
      weatherContext: {
        tempF,
        rh,
        windGust,
        tempAnomalyF,
        daysSinceRain,
        rainTodayIn,
        rainRateInHr,
        rainNext6hIn,
        precipProbabilityToday
      }
    });

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

function cToF(value) {
  const n = Number(value);
  return Number.isFinite(n) ? (n * 9) / 5 + 32 : null;
}

function msToMph(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n * 2.237 : null;
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

function getRainTodayFromHourly(weather) {
  const hours = Array.isArray(weather?.hourly) ? weather.hourly : [];
  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
  return hours.reduce((total, h) => {
    const ts = h?.timestamp;
    if (!Number.isFinite(ts)) return total;
    const day = new Date(ts).toLocaleDateString("en-US", { timeZone: "America/New_York" });
    if (day !== today) return total;
    const amount = Number(h.precipAmount ?? h.precipitation ?? 0);
    return total + (Number.isFinite(amount) ? amount : 0);
  }, 0);
}

function getRainNextHours(weather, hoursAhead = 6) {
  const hours = Array.isArray(weather?.hourly) ? weather.hourly : [];
  const endTs = Date.now() + hoursAhead * 60 * 60 * 1000;
  return sumRainThrough(hours, endTs);
}

function getTodayPrecipProbability(weather) {
  const today = Array.isArray(weather?.daily) ? weather.daily[0] : null;
  const daily = Number(today?.precipProbability);
  if (Number.isFinite(daily)) return daily > 1 ? daily / 100 : daily;

  const hours = Array.isArray(weather?.hourly) ? weather.hourly : [];
  const todayKey = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const values = hours
    .filter((h) => {
      const ts = h?.timestamp;
      return Number.isFinite(ts) &&
        new Date(ts).toLocaleDateString("en-US", { timeZone: "America/New_York" }) === todayKey;
    })
    .map((h) => Number(h.precipProbability))
    .filter(Number.isFinite);
  if (!values.length) return 0;
  const max = Math.max(...values);
  return max > 1 ? max / 100 : max;
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
