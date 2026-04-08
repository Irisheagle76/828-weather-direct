// ============================================================
// HUMAN-ACTION INTEL BUILDER — v6 (CLEAN + RESILIENT)
// - Never crashes
// - Handles empty / partial data
// - Canonical hourly → stable intel
// - Today/Tonight/Tomorrow logic fixed
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";
import { buildHumanVoice } from "./human-voice.js";

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  console.log("🔵 HA BUILDER START");

  const hourlyRaw = raw?.hourly;
  const hourly = normalizeOpenMeteo(hourlyRaw);

  // ------------------------------------------------------------
  // NO DATA → DEGRADED MODE
  // ------------------------------------------------------------
  if (!hourly.length) {
    console.warn("No hourly data — degraded mode");

    return {
      today: buildFallbackIntel("today"),
      tomorrow: buildFallbackIntel("tomorrow"),
      next6Hours: []
    };
  }

  // ------------------------------------------------------------
  // TIME CONTEXT
  // ------------------------------------------------------------
  const now = Date.now();
  const currentHour = new Date().getHours();
  const isTonightMode = currentHour >= 15;

  // ------------------------------------------------------------
  // TIME SLICES
  // ------------------------------------------------------------
  const next6  = sliceHours(hourly, now, 0, 6);
  const next24 = sliceHours(hourly, now, 0, 24);
  const next48 = sliceHours(hourly, now, 24, 48);

  // ------------------------------------------------------------
  // TODAY / TONIGHT
  // ------------------------------------------------------------
  let todayHours;

  if (isTonightMode) {
    // 6 PM → 6 AM
    todayHours = hourly.filter(h => {
      const hr = new Date(h.timestamp).getHours();
      return hr >= 18 || hr <= 6;
    });
  } else {
    todayHours = next24;
  }

  if (!todayHours.length) todayHours = next24;

  const todayIntel = buildPeriodIntel({
    hours: todayHours,
    label: isTonightMode ? "tonight" : "today",
    isTomorrow: false
  });

  // ------------------------------------------------------------
  // TOMORROW
  // ------------------------------------------------------------
  const tomorrowIntel = buildPeriodIntel({
    hours: next48,
    label: "tomorrow",
    isTomorrow: true
  });

  console.log("🔵 HA BUILDER END");

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel,
    next6Hours: next6
  };
}

// ------------------------------------------------------------
// PERIOD INTEL (CORE PIPELINE)
// ------------------------------------------------------------
function buildPeriodIntel({ hours, label, isTomorrow }) {
  if (!hours?.length) {
    return buildFallbackIntel(label, isTomorrow);
  }

  const snapshot = blendHours(hours);
  const evals = hours.map(evaluateHumanActionFactors);
  const core = aggregate(evals);

  const signals = buildSignals(snapshot);

  // 👇 ADD THIS
  const human = buildHumanVoice(signals, core.dominantFactor);

  return {
    dominantFactor: core.dominantFactor,
    confidence: core.confidence,
    secondaryFactors: core.secondaryFactors,

    dayLabel: label,
    isTomorrow,

    ...snapshot,
    signals,

    // 👇 THIS IS THE FIX
    summary: human.summary,
    detail: human.detail,
    feelsLikeLabel: human.feelsLike,

    hourlyEvaluations: evals
  };
}

// ------------------------------------------------------------
// BLEND HOURS (SAFE AVG)
// ------------------------------------------------------------
function blendHours(hours) {
  const vals = key =>
    hours
      .map(h => h[key])
      .filter(v => typeof v === "number" && Number.isFinite(v));

  const avg = key => {
    const v = vals(key);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };

  const max = key => {
    const v = vals(key);
    return v.length ? Math.max(...v) : null;
  };

  return {
    temp: avg("temperatureF"),
    feelsLike: avg("apparentF"),
    dewPoint: avg("dewpointF"),
    humidity: avg("relative_humidity"),

    windSpeed: avg("wind_speed"),
    windGust: max("wind_gust"),

    precipIntensity: avg("precipitation"),
    precipType:
      avg("precipitation") > 0
        ? avg("snowfall") > 0 ? "snow" : "rain"
        : "none",

    uvIndex: avg("uv_index"),
    visibility: avg("visibility"),
    cloudCover: avg("cloud_cover"),

    timestamp: hours[0]?.timestamp ?? null
  };
}

// ------------------------------------------------------------
// SIGNALS (UI SAFE DEFAULTS)
// ------------------------------------------------------------
function buildSignals(s) {
  return {
    temp: s.temp ?? 70,
    feelsLike: s.feelsLike ?? 70,
    dewPoint: s.dewPoint ?? 55,
    humidity: s.humidity ?? 50,
    windSpeed: s.windSpeed ?? 5,
    windGust: s.windGust ?? 8,
    cloudCover: s.cloudCover ?? 50,
    visibility: s.visibility ?? 10,
    precipIntensity: s.precipIntensity ?? 0
  };
}

// ------------------------------------------------------------
// TIME SLICING
// ------------------------------------------------------------
function sliceHours(hourly, now, startHr, endHr) {
  return hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= startHr && diff < endHr;
  });
}

// ------------------------------------------------------------
// AGGREGATION
// ------------------------------------------------------------
function aggregate(evals) {
  if (!evals?.length) {
    return {
      dominantFactor: "stable",
      confidence: 0.2,
      secondaryFactors: []
    };
  }

  const stats = {};

  for (const e of evals) {
    const f = e.dominantFactor;
    if (!stats[f]) stats[f] = { count: 0, total: 0 };

    stats[f].count++;
    stats[f].total += e.confidence;
  }

  const ranked = Object.entries(stats)
    .map(([factor, s]) => ({
      factor,
      score: s.total * (1 + s.count * 0.5)
    }))
    .sort((a, b) => b.score - a.score);

  return {
    dominantFactor: ranked[0]?.factor ?? "stable",
    confidence:
      evals.reduce((a, e) => a + e.confidence, 0) / evals.length,
    secondaryFactors: ranked.slice(1, 3).map(r => r.factor)
  };
}

// ------------------------------------------------------------
// FALLBACK INTEL
// ------------------------------------------------------------
function buildFallbackIntel(label, isTomorrow = false) {
  return {
    dominantFactor: "stable",
    confidence: 0.2,
    secondaryFactors: [],

    dayLabel: label,
    isTomorrow,

    signals: {
      temp: 70,
      feelsLike: 70,
      dewPoint: 55,
      humidity: 50,
      windSpeed: 5,
      windGust: 8,
      cloudCover: 50,
      visibility: 10,
      precipIntensity: 0
    },

    hourlyEvaluations: []
  };
}
function buildHumanSummary({ dominantFactor, signals }) {
  const { temp, dewPoint, windSpeed, humidity } = signals;

  // ------------------------------------------------------------
  // CLASSIFY
  // ------------------------------------------------------------
  const tempLevel =
    temp >= 86 ? "hot" :
    temp >= 75 ? "warm" :
    temp >= 60 ? "mild" :
    temp >= 45 ? "cool" :
    "cold";

  const humidityLevel =
    dewPoint >= 70 ? "oppressive" :
    dewPoint >= 65 ? "humid" :
    dewPoint >= 55 ? "comfortable" :
    "dry";

  const windLevel =
    windSpeed < 1 ? "calm" :
    windSpeed < 5 ? "light" :
    windSpeed < 12 ? "breezy" :
    "windy";

  // ------------------------------------------------------------
  // SUMMARY (NO VAGUE LANGUAGE)
  // ------------------------------------------------------------
  let summary;

  if (tempLevel === "hot" && humidityLevel !== "dry")
    summary = "Hot and uncomfortable";

  else if (tempLevel === "hot")
    summary = "Hot";

  else if (tempLevel === "warm" && humidityLevel !== "dry")
    summary = "Warm and slightly sticky";

  else if (tempLevel === "warm")
    summary = "Warm";

  else if (tempLevel === "mild")
    summary = "Comfortable";

  else if (tempLevel === "cool" && windLevel !== "calm")
    summary = "Cool with a breeze";

  else if (tempLevel === "cool")
    summary = "Cool";

  else
    summary = "Chilly";

  // ------------------------------------------------------------
  // DETAIL (ONE CLEAR DRIVER)
  // ------------------------------------------------------------
  let detail;

  switch (dominantFactor) {
    case "heat":
      detail = "Feels warm in the sun";
      break;

    case "cold":
      detail = "Cool air is noticeable";
      break;

    case "humidity":
      detail = "Humidity makes it feel heavier";
      break;

    case "wind":
      detail =
        windLevel === "calm"
          ? "Calm conditions"
          : `Breeze around ${Math.round(windSpeed)} mph`;
      break;

    default:
      detail = "";
  }

  // ------------------------------------------------------------
  // FEELS LIKE LABEL
  // ------------------------------------------------------------
  const feels =
    temp >= 95 ? "Oppressive heat" :
    temp >= 85 ? "Very warm" :
    temp >= 75 ? "T-shirt weather" :
    temp >= 65 ? "Comfortable" :
    temp >= 55 ? "Light jacket weather" :
    temp >= 45 ? "Jacket recommended" :
    "Cold";

  return { summary, detail, feelsLike: feels };
}