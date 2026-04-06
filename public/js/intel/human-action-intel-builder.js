// ============================================================
// HUMAN-ACTION INTEL BUILDER — v2 (TIME-CORRECT + STABLE)
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
    return { today: null, tomorrow: null, next6Hours: [] };
  }

  const hourly = normalizeOpenMeteo(raw.hourly);

  if (!hourly.length) {
    console.error("❌ Normalized hourly empty");
    return { today: null, tomorrow: null, next6Hours: [] };
  }

  const now = Date.now();
  const currentHour = new Date().getHours();
  const isTonightMode = currentHour >= 15;

  // ------------------------------------------------------------
  // TIME SLICING (ROLLING — NO MIDNIGHT BUGS)
  // ------------------------------------------------------------
  const next24 = sliceByHoursAhead(hourly, 0, 24);
  const next48 = sliceByHoursAhead(hourly, 24, 48);

  const next6Hours = sliceByHoursAhead(hourly, 0, 6);

  console.log("🕒 next6:", next6Hours.map(h =>
    new Date(h.timestamp).toLocaleTimeString([], { hour: "numeric" })
  ));

  // ------------------------------------------------------------
  // TODAY / TONIGHT WINDOW
  // ------------------------------------------------------------
  let todayHours;

  if (isTonightMode) {
    todayHours = hourly.filter(h => {
      const hr = new Date(h.timestamp).getHours();
      return hr >= 18 || hr <= 6;
    });
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

const todayIntel = {
  ...ensureSynthFields(todayIntelCore, todaySnapshot),
  ...todaySnapshot,
  hourlyEvaluations: todayEvaluations // optional but useful
};

  // ------------------------------------------------------------
  // TOMORROW (24–48 WINDOW)
  // ------------------------------------------------------------
  const tomorrowHours = next48;

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

const tomorrowIntel = {
  ...ensureSynthFields(tomorrowIntelCore, tomorrowSnapshot),
  ...tomorrowSnapshot,
  stats: tomorrowStats,
  hourlyEvaluations: tomorrowEvaluations
};

  console.log("🔵 HA BUILDER END");

  return {
    today: todayIntel,
    tomorrow: tomorrowIntel,
    next6Hours
  };
}

// ------------------------------------------------------------
// TIME SLICING (CORE FIX)
// ------------------------------------------------------------
function sliceByHoursAhead(hourly, startHr, endHr) {
  const now = Date.now();

  return hourly.filter(h => {
    const diff = (h.timestamp - now) / 36e5;
    return diff >= startHr && diff < endHr;
  });
}

// ------------------------------------------------------------
// SIGNAL LAYER (🔥 NEW — KEY UPGRADE)
// ------------------------------------------------------------
function addSignalFields(intel, snapshot) {
  if (!snapshot) return intel;

  return {
    ...intel,

    signals: {
      temp: snapshot.temp,
      feelsLike: snapshot.feelsLike,
      dewPoint: snapshot.dewPoint,
      humidity: snapshot.humidity,
      windSpeed: snapshot.windSpeed,
      windGust: snapshot.windGust,
      cloudCover: snapshot.cloudCover,
      visibility: snapshot.visibility,
      precipIntensity: snapshot.precipIntensity
    }
  };
}

// ------------------------------------------------------------
// SYNTH SAFETY
// ------------------------------------------------------------
function ensureSynthFields(intel, snapshot) {
  const base = intel ?? {};

  return {
    factors: Array.isArray(base.factors) ? base.factors : [],
    precipType: base.precipType ?? snapshot?.precipType ?? "none",
    precipChance: base.precipChance ?? 0,
    snapshot: snapshot ?? base.snapshot ?? {},
    ...base
  };
}

// ------------------------------------------------------------
// BLEND HOURS (simple average)
// ------------------------------------------------------------
function blendHours(hours) {
  if (!hours || !hours.length) return null;

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
    smokeIndex: avg("smoke_index"),
    frostRisk: avg("frost_risk"),
    freezeRisk: avg("freeze_risk"),
    inversionRisk: avg("inversion_risk"),
    blackIceRisk: avg("black_ice_risk"),
    valleyFogRisk: avg("valley_fog_risk"),
    ridgeFogRisk: avg("ridge_fog_risk"),
    timestamp: hours[0].timestamp
  };
}

// ------------------------------------------------------------
// FORWARD-BIAS BLEND (UNCHANGED CORE IDEA)
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
    smokeIndex: mix(core.smokeIndex, ext?.smokeIndex),
    frostRisk: mix(core.frostRisk, ext?.frostRisk),
    freezeRisk: mix(core.freezeRisk, ext?.freezeRisk),
    inversionRisk: mix(core.inversionRisk, ext?.inversionRisk),
    blackIceRisk: mix(core.blackIceRisk, ext?.blackIceRisk),
    valleyFogRisk: mix(core.valleyFogRisk, ext?.valleyFogRisk),
    ridgeFogRisk: mix(core.ridgeFogRisk, ext?.ridgeFogRisk),
    timestamp: core.timestamp
  };
}

// ------------------------------------------------------------
// AGGREGATION (IMPROVED SECONDARY FILTERING)
// ------------------------------------------------------------

function aggregateHumanAction(evals) {
  if (!evals || !evals.length) {
    return {
      dominantFactor: "default",
      confidence: 0.2,
      secondaryFactors: []
    };
  }

  const stats = {};

  for (const e of evals) {
    const f = e.dominantFactor;

    if (!stats[f]) {
      stats[f] = { count: 0, total: 0 };
    }

    stats[f].count++;
    stats[f].total += e.confidence;
  }

  const ranked = Object.entries(stats)
    .map(([factor, s]) => ({
      factor,
      score: s.total * s.count
    }))
    .sort((a, b) => b.score - a.score);

  const dominant = ranked[0]?.factor || "default";

  // 🔥 smarter secondary selection
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
// BUILD SUMMARY NOTES (aligned with aggregation)
// ------------------------------------------------------------
function buildSummaryNotes(dominant, secondary, confidence) {
  const bullets = [];

  switch (dominant) {
    case "rain":
      bullets.push("Rain plays a consistent role through the period.");
      break;
    case "wind":
      bullets.push("Wind is a steady influence on how it feels.");
      break;
    case "heat":
      bullets.push("Warm conditions shape the overall feel.");
      break;
    case "cold":
      bullets.push("Cool conditions dominate much of the period.");
      break;
    case "muggy":
      bullets.push("Moisture in the air adds a heavier feel.");
      break;
    case "fog":
      bullets.push("Reduced visibility is a recurring factor.");
      break;
    default:
      bullets.push("Multiple subtle factors shape the overall feel.");
  }

  if (secondary.includes("wind")) {
    bullets.push("Breezes add some variability at times.");
  }

  if (secondary.includes("rain")) {
    bullets.push("Periods of precipitation mix into the pattern.");
  }

  if (secondary.includes("muggy")) {
    bullets.push("Humidity occasionally adds a touch of heaviness.");
  }

  if (secondary.includes("cold")) {
    bullets.push("Cool undertones appear at times.");
  }

  if (secondary.includes("heat")) {
    bullets.push("Warmer moments develop intermittently.");
  }

  if (confidence < 0.4) {
    bullets.push("Conditions shift rather than staying consistent.");
  }

  return bullets.slice(0, 3);
}
