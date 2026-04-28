// ============================================================
// /js/modules/renderComfortNow.js — V5 (LIGHTNING + IMPACT LIVE)
// ============================================================

import { calculateComfort } from "../intel/comfort.js";
import { assembleWithVoice } from "../intel/synthesizer/assembleWithVoice.js";
import { analyzeTrend } from "../intel/trend/analyzeTrend.js";
import { buildFullExplanation } from "../intel/explanations/buildFullExplanation.js";

// ============================================================
// UTILS
// ============================================================

const clamp = (v, min, max) =>
  v == null ? null : Math.max(min, Math.min(max, v));

// ============================================================
// ⚡ LIGHTNING PARSER
// ============================================================

function parseLightning(data = {}) {
  if (data.lightning?.detected) {
    return {
      lightning: data.lightning,
      thunder: data.thunder ?? true
    };
  }

  const count =
    data.lightning_strike_count ??
    data.lightningStrikeCount ??
    0;

  const distanceKm =
    data.lightning_strike_avg_distance ??
    data.lightningStrikeAvgDistance ??
    null;

  const distanceMiles =
    distanceKm != null
      ? distanceKm * 0.621371
      : null;

  if (count > 0) {
    return {
      lightning: {
        detected: true,
        distanceMiles: distanceMiles ?? 10
      },
      thunder: true
    };
  }

  return {
    lightning: null,
    thunder: false
  };
}

// ============================================================
// ⚡ IMPACT ENGINE
// ============================================================

function computeImpact(data = {}) {
  const lightning = data.lightning;
  const rain = data.rainContext;

  if (lightning?.detected) {
    const d = lightning.distanceMiles ?? 10;

    if (d <= 3) return 85;
    if (d <= 6) return 70;
    if (d <= 10) return 55;
    return 40;
  }

  if (rain === "heavy") return 50;
  if (rain === "steady") return 35;
  if (rain === "light") return 15;

  return 0;
}

function getImpactLabel(impact) {
  if (impact >= 80) return "Hazardous";
  if (impact >= 60) return "Stormy";
  if (impact >= 40) return "Unsettled";
  if (impact >= 20) return "Active";
  return "Calm";
}

// ============================================================
// 🌧️ RAIN CLASSIFICATION
// ============================================================

function getRainContext(rate = 0) {
  if (rate <= 0.05) return "none";
  if (rate < 0.2) return "mist";
  if (rate < 1.0) return "light";
  if (rate < 3.0) return "steady";
  return "heavy";
}

// ============================================================
// TEMPEST NORMALIZATION
// ============================================================

function normalizeTempest(obs = {}) {
  if (!obs) return null;

  const precipRate = obs.precip_rate ?? obs.precipRate ?? 0;

  return {
    temp: obs.air_temperature ?? null,
    humidity: clamp(obs.relative_humidity, 0, 100),

    wind: obs.wind_avg ?? 0,
    windSpeed: obs.wind_avg ?? 0,
    windGust: obs.wind_gust ?? 0,

    solarRadiation: clamp(obs.solar_radiation, 0, 1200),

    dewPoint:
      obs.dew_point ??
      calcDewPoint(obs.air_temperature, obs.relative_humidity),

    precipRate,
    rainContext: getRainContext(precipRate),

    // ⚡ raw lightning
    lightning_strike_count: obs.lightning_strike_count,
    lightning_strike_avg_distance: obs.lightning_strike_avg_distance
  };
}

// ============================================================
// BLEND TEMPEST → CURRENT
// ============================================================

function injectTempest(current, tempest) {
  if (!tempest) return current;

  return {
    ...current,

    temperatureF: tempest.temperatureF ?? current.temperatureF,

    humidity:
      tempest.relative_humidity ??
      tempest.humidity ??
      current.humidity,

    wind: tempest.windSpeed ?? current.wind,
    windSpeed: tempest.windSpeed ?? current.windSpeed,
    windGust: tempest.windGust ?? current.windGust,

    solarRadiation:
      tempest.solarRadiation ?? current.solarRadiation,

    precipRate: tempest.precipRate ?? current.precipRate ?? 0,
    rainContext: tempest.rainContext ?? current.rainContext ?? "none",

    lightning_strike_count: tempest.lightning_strike_count,
    lightning_strike_avg_distance: tempest.lightning_strike_avg_distance
  };
}

// ============================================================
// NORMALIZE INPUT
// ============================================================

function normalizeCurrent(data = {}) {
  const temp =
    data.temp ??
    data.temperature ??
    data.temperatureF ??
    null;

  const dewPoint =
    data.dewPoint ??
    data.dewpoint ??
    data.dew_point ??
    null;

  const windBase =
    data.wind ??
    data.windSpeed ??
    data.wind_avg ??
    0;

  return {
    ...data,
    temp,
    dewPoint,
    wind: windBase,
    windSpeed: windBase
  };
}

// ============================================================
// 🌧️ RAIN IMPACT (UNCHANGED)
// ============================================================

function applyRainImpact(score, data) {
  const rain = data?.rainContext;
  const tempF = data?.temperatureF ?? data?.temp ?? null;

  let impact = 0;

  if (rain === "mist") impact = -0.1;
  if (rain === "light") impact = -0.2;
  if (rain === "steady") impact = -0.4;
  if (rain === "heavy") impact = -0.6;

  if (tempF > 85 && rain === "light") impact += 0.1;

  const hour = new Date().getHours();
  if (hour >= 18 && rain !== "heavy") impact += 0.1;

  return score + Math.max(impact, -0.5);
}

// ============================================================
// MAIN RENDER
// ============================================================

export function renderComfortNow(
  container,
  current,
  bestWindow,
  options = {}
) {
  if (!container || !current) return;

  const mode = options.mode || "downtown";
  const isDay = options.isDay ?? true;
  const hourly = options.hourly ?? [];

  const tempest = normalizeTempest(options.tempest ?? null);

  let normalized = normalizeCurrent(current);
  normalized = injectTempest(normalized, tempest);

  // ⚡ LIGHTNING
  const { lightning, thunder } = parseLightning(normalized);
  normalized.lightning = lightning;
  normalized.thunder = thunder;

  const impact = computeImpact(normalized);
  const impactLabel = getImpactLabel(impact);

  const adjusted = applyModeAdjustments(normalized, mode);

  const comfort = calculateComfort(adjusted, {
    isDay,
    elevation: mode === "trail" ? 3000 : 2200,
    isValley: mode === "downtown"
  });

  if (!comfort || comfort.temp == null) return;

  comfort.score = applyRainImpact(comfort.score ?? 0, adjusted);

  const score = Math.round((comfort.score || 0) * 10);
  const scoreClass = getComfortClass(score);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  const rainContext = adjusted.rainContext;

  const trend = analyzeTrend(hourly);

  const narrative = assembleWithVoice(
    {
      signals: {
        temp: comfort.temp,
        dewPoint: comfort.dewPoint,
        wind: comfort.windSpeed,
        rain: adjusted.precipRate
      },
      rainContext,
      dominantFactor: detectDominantWithRain(comfort, rainContext),
      confidence: 0.75
    },
    "today",
    mapScoreToCategory(comfort.score),
    comfort.goldilocks,
    trend
  );

  // ============================================================
  // ⚡ HEADLINE (STORM OVERRIDE)
  // ============================================================

  let headline =
    narrative?.headline ||
    fallbackHeadline(comfort);

  if (impact >= 60) {
    headline = "Thunderstorms are impacting conditions";
  } else if (impact >= 40) {
    headline = "Unsettled weather is affecting comfort";
  } else if (rainContext !== "none") {
    if (rainContext === "light") {
      headline = "Light rain is slightly reducing comfort";
    } else if (rainContext === "steady") {
      headline = "Steady rain is actively impacting comfort";
    } else if (rainContext === "heavy") {
      headline = "Heavy rain is significantly reducing comfort";
    }
  }

  let explanation = buildFullExplanation(
    comfort,
    narrative,
    trend
  );

  const drivers = buildDrivers(comfort);

  if (impact >= 40) {
    drivers.unshift({
      short: "⚡ storms",
      long: "Storms are impacting conditions"
    });
  }

  const driverShort = drivers.map(d => d.short).join(" • ");
  const actions = buildActions(comfort);

  container.innerHTML = `
    <div class="comfort-module ${goldiClass}">

      <div class="comfort-main">

        <div class="comfort-score-block ${scoreClass} ${impact >= 60 ? "storm" : ""}">
          <div class="comfort-score-main">${score}</div>
          <div class="comfort-score-label">comfort</div>
          ${
            impact >= 40
              ? `<div class="comfort-impact-label">⚡ ${impactLabel}</div>`
              : ""
          }
          ${
            driverShort
              ? `<div class="comfort-score-sub">${driverShort}</div>`
              : ""
          }
        </div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>
          <div class="comfort-text">${headline}</div>
          <div class="comfort-explainer">${explanation}</div>
        </div>

      </div>

      <div class="comfort-expand">
        <div class="comfort-expand-headline">
          ${buildHeadline(score)}
        </div>
        ${renderBestWindow(bestWindow)}
      </div>

    </div>
  `;

  attachAccordion(container);
}