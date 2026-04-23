// ============================================================
// /js/modules/renderComfortNow.js (v9 — NARRATIVE FIXED)
// ============================================================

import { calculateComfort } from "../intel/comfort.js";
import { assembleWithVoice } from "../intel/synthesizer/assembleWithVoice.js";

// ============================================================
// UTILS
// ============================================================

const clamp = (v, min, max) =>
  v == null ? null : Math.max(min, Math.min(max, v));

const mix = (a, b, w) =>
  a == null ? b : b == null ? a : a * w + b * (1 - w);

// ============================================================
// TEMPEST NORMALIZATION
// ============================================================

function normalizeTempest(obs = {}) {
  if (!obs) return null;

  return {
    temp: obs.air_temperature ?? null,
    humidity: clamp(obs.relative_humidity, 0, 100),

    wind: obs.wind_avg ?? 0,
    windSpeed: obs.wind_avg ?? 0,
    windGust: obs.wind_gust ?? 0,

    solarRadiation: clamp(obs.solar_radiation, 0, 1200),

    dewPoint:
      obs.dew_point ??
      calcDewPoint(obs.air_temperature, obs.relative_humidity)
  };
}

// ============================================================
// BLEND TEMPEST → CURRENT
// ============================================================

function injectTempest(current, tempest) {
  if (!tempest) return current;

  return {
    ...current,

    // 🌡️ Temperature
    temperatureF:
      tempest.temperatureF ??
      current.temperatureF,

    // 💧 Humidity — trust Tempest
    humidity:
      tempest.relative_humidity ??
      tempest.humidity ??
      current.humidity,

    // 🌬️ Wind — trust Tempest
    wind:
      tempest.windSpeed ??
      current.wind,

    windSpeed:
      tempest.windSpeed ??
      current.windSpeed,

    // 💨 Gust — DO NOT use Math.max
    windGust:
      tempest.windGust ??
      tempest.wind_gust ??
      current.windGust,

    // ☀️ Solar
    solarRadiation:
      tempest.solarRadiation ??
      current.solarRadiation
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

  const tempestRaw = options.tempest ?? null;
  const tempest = normalizeTempest(tempestRaw);

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
  // SCORE
  // ------------------------------------------------------------

  const score = Math.round((comfort.score || 0) * 10);
  const scoreClass = getComfortClass(score);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // SYNTH
  // ------------------------------------------------------------

  const intel = {
    signals: {
      temp: comfort.temp,
      dewPoint: comfort.dewPoint,
      wind: comfort.windSpeed
    },
    dominantFactor: detectDominantFactor(comfort),
    confidence: 0.75
  };

  const trend = analyzeTrend(hourly);

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(comfort.score),
    comfort.goldilocks,
    trend
  );

  // ------------------------------------------------------------
  // DRIVERS
  // ------------------------------------------------------------

  const drivers = buildDrivers(comfort);
  const driverShort = drivers.map(d => d.short).join(" • ");

  // ------------------------------------------------------------
  // TEXT
  // ------------------------------------------------------------

  const headline =
    narrative?.headline ||
    fallbackHeadline(comfort);

  console.log("COMFORT:", comfort);
  console.log("HOURLY LENGTH:", hourly.length);
  console.log("NARRATIVE:", narrative);

  const explanation = buildFullExplanation(
    comfort,
    narrative,
    hourly
  );

  const actions = buildActions(comfort);

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