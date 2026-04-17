import { computeDroughtFireIndexLive } from "../lib/drought-fire/computeDroughtFireIndex.js";

// ⚠️ Update these paths if needed
import { getTempestObs } from "../lib/tempest.js";
import { getForecast } from "../lib/forecast.js";

export default async function handler(req, res) {
  try {
    const obsRaw = await getTempestObs();
    const forecast = await getForecast();

    // -----------------------------
    // 1. NORMALIZE TEMPEST DATA
    // -----------------------------
    const obs = normalizeTempest(obsRaw);

    const tempF = obs.tempF;
    const rh = obs.rh;
    const windGust = obs.windGust;

    // -----------------------------
    // 2. TEMPERATURE ANOMALY
    // -----------------------------
    const normalTemp = getNormalTemp(forecast);
    const tempAnomalyF = tempF - normalTemp;

    // -----------------------------
    // 3. DAYS SINCE RAIN
    // -----------------------------
    const daysSinceRain = getDaysSinceRain(forecast);

    // -----------------------------
    // 4. RUN INDEX
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
    res.status(500).json({ error: "failed to compute drought/fire index" });
  }
}

//
// 🧩 HELPERS
//

// -----------------------------
// Normalize Tempest response
// -----------------------------
function normalizeTempest(obsRaw) {
  // CASE 1: already parsed object
  if (obsRaw?.air_temperature !== undefined) {
    return {
      tempF: obsRaw.air_temperature,
      rh: obsRaw.relative_humidity,
      windGust: obsRaw.wind_gust || 0
    };
  }

  // CASE 2: Tempest obs array format
  if (obsRaw?.obs?.[0]) {
    const o = obsRaw.obs[0];

    return {
      tempF: o[7],        // air temp
      rh: o[8],           // humidity
      windGust: o[3] || 0 // gust
    };
  }

  // fallback (safe defaults)
  return {
    tempF: 75,
    rh: 40,
    windGust: 5
  };
}

// -----------------------------
// Get normal temperature
// -----------------------------
function getNormalTemp(forecast) {
  if (forecast?.daily?.[0]?.temp_normal) {
    return forecast.daily[0].temp_normal;
  }

  if (forecast?.daily?.[0]?.temp?.day) {
    return forecast.daily[0].temp.day;
  }

  return 70;
}

// -----------------------------
// Days since meaningful rain
// -----------------------------
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