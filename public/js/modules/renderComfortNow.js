// ============================================================
// /js/modules/renderComfortNow.js — V3 (RAIN-INTEGRATED NARRATIVE)
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

// ------------------------------------------------------------
// 🌧️ RAIN CLASSIFICATION
// ------------------------------------------------------------

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

    // 🌧️
    precipRate,
    rainContext: getRainContext(precipRate)
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

    // 🌧️
    precipRate: tempest.precipRate ?? current.precipRate ?? 0,
    rainContext: tempest.rainContext ?? current.rainContext ?? "none"
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
// 🌧️ RAIN IMPACT (SCORE)
// ============================================================

function applyRainImpact(score, data) {
  const rain = data?.rainContext;
  const tempF = data?.temperatureF ?? data?.temp ?? null;

  let impact = 0;

  if (rain === "mist") impact = -0.1;
  if (rain === "light") impact = -0.2;
  if (rain === "steady") impact = -0.4;
  if (rain === "heavy") impact = -0.6;

  // warm rain relief
  if (tempF > 85 && rain === "light") impact += 0.1;

  // evening softening
  const hour = new Date().getHours();
  if (hour >= 18 && rain !== "heavy") impact += 0.1;

  return score + Math.max(impact, -0.5);
}

// ============================================================
// 🌧️ DOMINANT FACTOR EXTENSION
// ============================================================

function detectDominantWithRain(comfort, rainContext) {
  if (rainContext === "heavy") return "rain-heavy";
  if (rainContext === "steady") return "rain";

  return detectDominantFactor(comfort);
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

  // ------------------------------------------------------------
  // DATA PREP
  // ------------------------------------------------------------

  const tempest = normalizeTempest(options.tempest ?? null);

  let normalized = normalizeCurrent(current);
  normalized = injectTempest(normalized, tempest);

  const adjusted = applyModeAdjustments(normalized, mode);

  const comfort = calculateComfort(adjusted, {
    isDay,
    elevation: mode === "trail" ? 3000 : 2200,
    isValley: mode === "downtown"
  });

  if (!comfort || comfort.temp == null) return;

  // ------------------------------------------------------------
  // 🌧️ SCORE IMPACT
  // ------------------------------------------------------------

  comfort.score = applyRainImpact(comfort.score ?? 0, adjusted);

  // ------------------------------------------------------------
  // SCORE UI
  // ------------------------------------------------------------

  const score = Math.round((comfort.score || 0) * 10);
  const scoreClass = getComfortClass(score);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // INTEL (RAIN INCLUDED PROPERLY)
  // ------------------------------------------------------------

  const rainContext = adjusted.rainContext;

  const intel = {
    signals: {
      temp: comfort.temp,
      dewPoint: comfort.dewPoint,
      wind: comfort.windSpeed,
      rain: adjusted.precipRate
    },
    rainContext,
    dominantFactor: detectDominantWithRain(comfort, rainContext),
    confidence: 0.75
  };

  const trend = analyzeTrend(hourly);

  // ------------------------------------------------------------
  // NARRATIVE (RAIN-AWARE INPUT)
  // ------------------------------------------------------------

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(comfort.score),
    comfort.goldilocks,
    trend
  );

  // ------------------------------------------------------------
  // 🌧️ HEADLINE BLENDING (NOT OVERRIDE)
  // ------------------------------------------------------------

  let headline =
    narrative?.headline ||
    fallbackHeadline(comfort);

  if (rainContext !== "none") {
    if (rainContext === "mist") {
      headline = `A light mist is softening the overall feel`;
    } else if (rainContext === "light") {
      headline = `Light rain is slightly reducing comfort`;
    } else if (rainContext === "steady") {
      headline = `Steady rain is actively impacting comfort`;
    } else if (rainContext === "heavy") {
      headline = `Heavy rain is significantly reducing comfort`;
    }
  }

  // ------------------------------------------------------------
  // 🌧️ EXPLANATION BLEND
  // ------------------------------------------------------------

  let explanation = buildFullExplanation(
    comfort,
    narrative,
    trend
  );

  if (rainContext !== "none") {
    const prefix =
      rainContext === "mist"
        ? "A light mist is in the mix."
        : rainContext === "light"
        ? "Light rain is slightly muting comfort."
        : rainContext === "steady"
        ? "Steady rain is a major factor right now."
        : "Heavy rain is dominating conditions.";

    explanation = `${prefix} ${explanation}`;
  }

  // ------------------------------------------------------------
  // DRIVERS
  // ------------------------------------------------------------

  const drivers = buildDrivers(comfort);

  if (rainContext !== "none") {
    drivers.push({
      short: "rain",
      long: "Rain is influencing overall comfort"
    });
  }

  const driverShort = drivers.map(d => d.short).join(" • ");
  const actions = buildActions(comfort);

  // ------------------------------------------------------------
  // DEBUG
  // ------------------------------------------------------------

  console.log("COMFORT:", comfort);
  console.log("RAIN CONTEXT:", rainContext);

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------

  container.innerHTML = `
    <div class="comfort-module ${goldiClass}">

      <div class="comfort-main">

        <div class="comfort-score-block ${scoreClass}">
          <div class="comfort-score-main">${score}</div>
          <div class="comfort-score-label">comfort</div>
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

        ${
          actions.length
            ? `
          <div class="comfort-expand-actions">
            ${actions.map(a => `<div>• ${a}</div>`).join("")}
          </div>
        `
            : ""
        }

        <div class="comfort-expand-drivers">

          <div class="comfort-expand-row">
            <span>🌡️ Temp</span>
            <span>${round(comfort.temp)}°</span>
          </div>

          <div class="comfort-expand-row">
            <span>💧 Dew</span>
            <span>${round(comfort.dewPoint)}°</span>
          </div>

          <div class="comfort-expand-row">
            <span>🌬️ Wind</span>
            <span>${formatWind(comfort.windSpeed)}</span>
          </div>

        </div>

        ${renderBestWindow(bestWindow)}

      </div>

    </div>
  `;

  attachAccordion(container);
}