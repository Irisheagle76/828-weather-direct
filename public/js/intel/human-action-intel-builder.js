// ============================================================
// HUMAN-ACTION INTEL BUILDER — v3 (FULLY SAFE + STABLE)
// ============================================================

import { evaluateHumanActionFactors } from "../modules/human-action-2/core-engine.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ------------------------------------------------------------
// MAIN BUILDER
// ------------------------------------------------------------
export function buildHumanActionIntel(raw) {
  console.log("🔵 HA BUILDER START");

  if (!raw || !raw.hourly) {
    console.error("❌ No hourly data:", raw);
    return buildEmptyIntel();
  }

  const hourly = normalizeOpenMeteo(raw.hourly);

  if (!hourly.length) {
    console.error("❌ Normalized hourly empty");
    return buildEmptyIntel();
  }

  const now = Date.now();
  const currentHour = new Date().getHours();
  const isTonightMode = currentHour >= 15;

  // ------------------------------------------------------------
  // TIME SLICING
  // ------------------------------------------------------------
  const next24 = sliceByHoursAhead(hourly, 0, 24);
  const next48 = sliceByHoursAhead(hourly, 24, 48);
  const next6Hours = sliceByHoursAhead(hourly, 0, 6);

  // ------------------------------------------------------------
  // TODAY / TONIGHT
  // ------------------------------------------------------------
  let todayHours;

  if (isTonightMode) {
    todayHours = hourly.filter(h => {
      const hr = new Date(h.timestamp).getHours();
      return hr >= 18 || hr <= 6;
    });

    if (!todayHours.length) {
      todayHours = next24;
    }
  } else {
    todayHours = next24;
  }

  const todayExtended = sliceByHoursAhead(hourly, 0, 36);
  const todaySnapshot = blendHoursWithForwardBias(todayHours, todayExtended);

  if (todaySnapshot) {
    todaySnapshot.dayLabel = isTonightMode ? "tonight" : "today";
    todaySnapshot.isTomorrow = false;
  }

  const todayEvaluations = todayHours.map(h =>
    evaluateHumanActionFactors(h)
  );

  const todayIntelCore = aggregateHumanAction(todayEvaluations);

  const todayIntelBase = {
    ...ensureSynthFields(todayIntelCore, todaySnapshot),
    ...todaySnapshot,
    hourlyEvaluations: todayEvaluations
  };

  const todayIntel = addSignalFields(todayIntelBase, todaySnapshot);

  // ------------------------------------------------------------
  // TOMORROW
  // ------------------------------------------------------------
const tomorrowHours = sliceByHoursAhead(hourly, 24, 48);

console.log("🟡 tomorrowHours length:", tomorrowHours.length);

const tomorrowSnapshot = blendHours(tomorrowHours);

  if (tomorrowSnapshot) {
    tomorrowSnapshot.dayLabel = "tomorrow";
    tomorrowSnapshot.isTomorrow = true;
  }

  const tomorrowStats = computeTomorrowStats(tomorrowHours);

  const tomorrowEvaluations = tomorrowHours.map(h =>
    evaluateHumanActionFactors(h)
  );

  const tomorrowIntelCore = aggregateHumanAction(tomorrowEvaluations);

  const tomorrowIntelBase = {
    ...ensureSynthFields(tomorrowIntelCore, tomorrowSnapshot),
    ...tomorrowSnapshot,
    stats: tomorrowStats,
    hourlyEvaluations: tomorrowEvaluations
  };

  const tomorrowIntel = addSignalFields(tomorrowIntelBase, tomorrowSnapshot);

  console.log("🔵 HA BUILDER END");

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel,
    next6Hours
  };
}

// ------------------------------------------------------------
// TIME SLICING
// ------------------------------------------------------------
function sliceByHoursAhead(hourly, startHr, endHr) {
  const now = Date.now();

  console.log("🟠 sample timestamp:", hourly[0]?.timestamp);
  
  return hourly.filter(h => {
    let ts = h.timestamp;

    // 🛠 normalize timestamp
    if (typeof ts === "string") ts = new Date(ts).getTime();
    if (ts < 1e12) ts = ts * 1000; // seconds → ms

    const diff = (ts - now) / 36e5;

    return diff >= startHr && diff < endHr;
  });
}

// ------------------------------------------------------------
// SIGNAL LAYER
// ------------------------------------------------------------
function addSignalFields(intel, snapshot) {
  return {
    ...intel,
    signals: {
      temp: snapshot?.temp ?? 70,
      feelsLike: snapshot?.feelsLike ?? 70,
      dewPoint: snapshot?.dewPoint ?? 55,
      humidity: snapshot?.humidity ?? 50,
      windSpeed: snapshot?.windSpeed ?? 5,
      windGust: snapshot?.windGust ?? 8,
      cloudCover: snapshot?.cloudCover ?? 50,
      visibility: snapshot?.visibility ?? 10,
      precipIntensity: snapshot?.precipIntensity ?? 0
    }
  };
}

// ------------------------------------------------------------
// SYNTH SAFETY
// ------------------------------------------------------------
function ensureSynthFields(intel, snapshot) {
  const base = intel ?? {};

  return {
    dominantFactor: base.dominantFactor ?? "default",
    confidence: base.confidence ?? 0.3,
    secondaryFactors: Array.isArray(base.secondaryFactors)
      ? base.secondaryFactors
      : [],

    precipType: base.precipType ?? snapshot?.precipType ?? "none",
    precipChance: base.precipChance ?? 0,
    snapshot: snapshot ?? base.snapshot ?? {},

    ...base
  };
}

// ------------------------------------------------------------
// BLEND HOURS
// ------------------------------------------------------------
function blendHours(hours) {
  if (!hours?.length) return null;

  const avg = key =>
    hours.reduce((a, h) => a + (h[key] ?? 0), 0) / hours.length;

  return {
    temp: avg("temperatureF"),
    feelsLike: avg("apparentF"),
    dewPoint: avg("dewpointF"),
    humidity: avg("relative_humidity"),
    windSpeed: avg("wind_speed"),
    windGust: avg("wind_gust"),

    precipType:
      avg("precipitation") > 0
        ? avg("snowfall") > 0 ? "snow" : "rain"
        : "none",

    precipIntensity: avg("precipitation"),
    uvIndex: avg("uv_index"),
    visibility: avg("visibility"),
    cloudCover: avg("cloud_cover"),

    timestamp: hours[0].timestamp
  };
}

// ------------------------------------------------------------
// FORWARD BIAS BLEND
// ------------------------------------------------------------
function blendHoursWithForwardBias(coreHours, extendedHours) {
  if (!coreHours?.length) return blendHours(extendedHours);

  const core = blendHours(coreHours);
  const ext = extendedHours?.length ? blendHours(extendedHours) : null;

  const mix = (a, b) =>
    a != null && b != null ? 0.7 * a + 0.3 * b : a ?? b ?? null;

  return {
    temp: mix(core.temp, ext?.temp),
    feelsLike: mix(core.feelsLike, ext?.feelsLike),
    dewPoint: mix(core.dewPoint, ext?.dewPoint),
    humidity: mix(core.humidity, ext?.humidity),
    windSpeed: mix(core.windSpeed, ext?.windSpeed),
    windGust: mix(core.windGust, ext?.windGust),

    precipType: core.precipType,
    precipIntensity: mix(core.precipIntensity, ext?.precipIntensity),

    uvIndex: mix(core.uvIndex, ext?.uvIndex),
    visibility: mix(core.visibility, ext?.visibility),
    cloudCover: mix(core.cloudCover, ext?.cloudCover),

    timestamp: core.timestamp
  };
}

// ------------------------------------------------------------
// AGGREGATION (STABLE)
// ------------------------------------------------------------
function aggregateHumanAction(evals) {
  if (!evals?.length) {
    return {
      dominantFactor: "default",
      confidence: 0.3,
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

  const dominant = ranked[0]?.factor || "default";

  const secondary = ranked
    .filter(r => r.score > ranked[0].score * 0.25)
    .slice(1, 3)
    .map(r => r.factor);

  const confidence =
    evals.reduce((a, e) => a + e.confidence, 0) / evals.length;

  return {
    dominantFactor: dominant,
    confidence,
    secondaryFactors: secondary
  };
}

// ------------------------------------------------------------
// EMPTY INTEL (NEVER CRASH)
// ------------------------------------------------------------
function buildEmptyIntel() {
  const base = {
    dominantFactor: "default",
    confidence: 0.3,
    secondaryFactors: [],
    signals: {
      temp: 70,
      dewPoint: 55,
      windSpeed: 5,
      windGust: 8,
      cloudCover: 50,
      visibility: 10,
      precipIntensity: 0
    }
  };

  return {
    today: base,
    tomorrow: base,
    next6Hours: []
  };
}

// ------------------------------------------------------------
// TOMORROW STATS
// ------------------------------------------------------------
function computeTomorrowStats(hours) {
  if (!hours?.length) {
    return {
      high: null,
      low: null,
      dewPoint: null,
      wind: null,
      gust: null,
      precipProb: 0
    };
  }

  const temps = hours.map(h => h.temperatureF).filter(v => v != null);
  const dew = hours.map(h => h.dewpointF).filter(v => v != null);
  const winds = hours.map(h => h.wind_speed).filter(v => v != null);
  const gusts = hours.map(h => h.wind_gust).filter(v => v != null);
  const precipProb = hours.map(h => h.precip_probability ?? 0);

  return {
    high: max(temps),
    low: min(temps),
    dewPoint: avg(dew),
    wind: avg(winds),
    gust: max(gusts),
    precipProb: max(precipProb)
  };
}

const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
const max = arr => arr.length ? Math.max(...arr) : null;
const min = arr => arr.length ? Math.min(...arr) : null;