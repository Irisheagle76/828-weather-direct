import { computeDroughtFireIndexLive } from "../lib/drought-fire/computeDroughtFireIndex.js";
import { getForecast } from "../lib/forecast.js";

// -----------------------------
// CONFIG
// -----------------------------
const STATION_ID = 127602;

// -----------------------------
// TEMPEST FETCH
// -----------------------------
async function getTempestObs() {
  try {
    const base =
      process.env.BASE_URL ||
      "https://avlweather.com"; // fallback for prod

    const url = `${base}/api/tempest/device?stationId=${STATION_ID}&token=${process.env.TEMPEST_TOKEN}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.warn("Tempest fetch failed:", res.status);
      return null;
    }

    const data = await res.json();

    return data?.current_conditions || null;

  } catch (err) {
    console.warn("Tempest fetch error:", err);
    return null;
  }
}

// -----------------------------
// MAIN HANDLER
// -----------------------------
export default async function handler(req, res) {
  try {
    const [obs, forecast] = await Promise.all([
      getTempestObs(),
      getForecast()
    ]);

    // -----------------------------
    // CURRENT CONDITIONS
    // -----------------------------
    const tempF = obs?.air_temperature ?? 75;
    const rh = obs?.relative_humidity ?? 40;
    const windGust = obs?.wind_gust ?? obs?.wind_avg ?? 5;

    // -----------------------------
    // TEMPERATURE ANOMALY
    // -----------------------------
    const normalTemp = getNormalTemp(forecast);
    const tempAnomalyF = tempF - normalTemp;

    // -----------------------------
    // DAYS SINCE RAIN
    // -----------------------------
    const daysSinceRain = getDaysSinceRain(forecast);

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

function getNormalTemp(forecast) {
  if (forecast?.daily?.[0]?.temp_normal != null) {
    return forecast.daily[0].temp_normal;
  }

  if (forecast?.daily?.[0]?.temp?.day != null) {
    return forecast.daily[0].temp.day;
  }

  return 70;
}

function getDaysSinceRain(forecast) {
  const days = forecast?.daily || [];

  for (let i = 0; i < days.length; i++) {
    const d = days[i];

    const precip =
      d.precip ??
      d.rain ??
      d.qpf ??
      0;

    if (precip >= 0.25) {
      return i;
    }
  }

  return 10;
}