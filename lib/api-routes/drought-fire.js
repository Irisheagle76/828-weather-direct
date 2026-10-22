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

    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

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
    if (!obs || !Number.isFinite(obs.timestamp) || Math.abs(Date.now() - obs.timestamp) > 30 * 60 * 1000) {
      throw new Error("Fresh current weather observations are unavailable");
    }

    const tempF =
      obs?.temperatureF ??
      obs?.tempF ??
      obs?.temp ??
      cToF(obs?.air_temperature);
    const rh = obs?.relative_humidity ?? obs?.humidity;

    const windGust =
      obs?.windGust ??
      obs?.wind_gust_mph ??
      msToMph(obs?.wind_gust);
    if (![tempF, rh, windGust].every(Number.isFinite) || rh < 0 || rh > 100 || windGust < 0) {
      throw new Error("Current weather inputs are incomplete");
    }
    const rainRateInHr = (obs?.precipRate ?? obs?.precip_rate ?? 0) / 25.4;
    const rainTodayMm =
      obs?.precipAccumLocalDay ??
      obs?.precip_accum_local_day ??
      obs?.local_day_precip_accum ?? null;
    const rainTodayIn = Number.isFinite(rainTodayMm) ? rainTodayMm / 25.4 : null;
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
    const daysSinceRain = null; // Filled from observed CPC history by the index.
    // -----------------------------
    // RUN INDEX
    // -----------------------------
    const result = await computeDroughtFireIndexLive({
      hourly: Array.isArray(weather?.hourly) ? weather.hourly : [],
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

    res.setHeader?.("Cache-Control", "public, max-age=60, s-maxage=300");
    res.status(200).json({
      ...result,
      weatherContext: {
        tempF,
        rh,
        windGust,
        tempAnomalyF,
        daysSinceRain: result.daysSinceRain,
        observedAt: new Date(obs.timestamp).toISOString(),
        rainTodayIn,
        rainRateInHr,
        rainNext6hIn,
        precipProbabilityToday
      }
    });

  } catch (err) {
    console.error("🔥 DROUGHT/FIRE ERROR:", err);

    res.setHeader?.("Cache-Control", "no-store");
    res.status(503).json({
      error: "Fire weather index temporarily unavailable",
      detail: err.message
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
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? (n * 9) / 5 + 32 : null;
}

function msToMph(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n * 2.237 : null;
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
