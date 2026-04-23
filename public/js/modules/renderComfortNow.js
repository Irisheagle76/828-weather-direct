// ============================================================
// /js/modules/renderComfortNow.js — V2 (RAIN-AWARE)
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

    // 🌧️ RAIN
    precipRate,
    isRainingNow: precipRate > 0
  };
}

// ============================================================
// BLEND TEMPEST → CURRENT
// ============================================================

function injectTempest(current, tempest) {
  if (!tempest) return current;

  return {
    ...current,

    temperatureF:
      tempest.temperatureF ??
      current.temperatureF,

    humidity:
      tempest.relative_humidity ??
      tempest.humidity ??
      current.humidity,

    wind:
      tempest.windSpeed ??
      current.wind,

    windSpeed:
      tempest.windSpeed ??
      current.windSpeed,

    windGust:
      tempest.windGust ??
      current.windGust,

    solarRadiation:
      tempest.solarRadiation ??
      current.solarRadiation,

    // 🌧️ RAIN
    precipRate:
      tempest.precipRate ?? current.precipRate ?? 0,

    isRainingNow:
      tempest.isRainingNow ?? current.isRainingNow ?? false
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
// 🌧️ RAIN IMPACT ENGINE
// ============================================================

function applyRainImpact(score, data) {
  const precipRate = data?.precipRate ?? 0;
  const tempF = data?.temperatureF ?? data?.temp ?? null;

  // debounce jitter
  const effectiveRain = precipRate > 0.05 ? precipRate : 0;

  let rainLevel = "none";
  if (effectiveRain > 0 && effectiveRain < 0.2) rainLevel = "mist";
  else if (effectiveRain < 1.0) rainLevel = "light";
  else if (effectiveRain < 3.0) rainLevel = "moderate";
  else if (effectiveRain >= 3.0) rainLevel = "heavy";

  let impact = 0;
  if (rainLevel === "mist") impact = -0.1;
  if (rainLevel === "light") impact = -0.2;
  if (rainLevel === "moderate") impact = -0.4;
  if (rainLevel === "heavy") impact = -0.6;

  // warm rain relief
  if (tempF != null && tempF > 85 && rainLevel === "light") {
    impact += 0.1;
  }

  // evening softening
  const hour = new Date().getHours();
  if (hour >= 18 && rainLevel !== "heavy") {
    impact += 0.1;
  }

  // clamp so it never dominates
  impact = Math.max(impact, -0.5);

  return score + impact;
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
  // 🌧️ APPLY RAIN TO SCORE
  // ------------------------------------------------------------

  comfort.score = applyRainImpact(comfort.score ?? 0, adjusted);

  // ------------------------------------------------------------
  // SCORE
  // ------------------------------------------------------------

  const score = Math.round((comfort.score || 0) * 10);
  const scoreClass = getComfortClass(score);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // INTEL + TREND
  // ------------------------------------------------------------

  const intel = {
    signals: {
      temp: comfort.temp,
      dewPoint: comfort.dewPoint,
      wind: comfort.windSpeed,
      rain: adjusted.precipRate // 🌧️ subtle signal
    },
    dominantFactor: detectDominantFactor(comfort),
    confidence: 0.75
  };

  const trend = analyzeTrend(hourly);

  // ------------------------------------------------------------
  // NARRATIVE
  // ------------------------------------------------------------

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(comfort.score),
    comfort.goldilocks,
    trend
  );

  // ------------------------------------------------------------
  // TEXT
  // ------------------------------------------------------------

  const headline =
    narrative?.headline ||
    fallbackHeadline(comfort);

  const explanation = buildFullExplanation(
    comfort,
    narrative,
    trend
  );

  // ------------------------------------------------------------
  // DRIVERS
  // ------------------------------------------------------------

  const drivers = buildDrivers(comfort);

  // 🌧️ Inject rain driver if present
  if (adjusted.precipRate > 0.05) {
    drivers.push({
      short: "rain",
      long: "Rain is slightly reducing comfort"
    });
  }

  const driverShort = drivers.map(d => d.short).join(" • ");
  const actions = buildActions(comfort);

  // ------------------------------------------------------------
  // DEBUG
  // ------------------------------------------------------------

  console.log("COMFORT:", comfort);
  console.log("RAIN:", adjusted.precipRate);

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