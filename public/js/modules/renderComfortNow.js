// /js/modules/renderComfortNow.js

import { calculateComfort } from "../intel/comfort.js";
import { assembleWithVoice } from "../intel/synthesizer/assembleWithVoice.js";

// ============================================================
// MODE ADJUSTMENTS
// ============================================================
function applyModeAdjustments(data, mode) {
  const adjusted = { ...data };

  if (mode === "trail") {
    adjusted.temp -= 3;
    adjusted.windSpeed = (adjusted.windSpeed ?? 0) * 1.2;
    adjusted.clouds = (adjusted.clouds ?? 0) + 10;
  }

  if (mode === "downtown") {
    adjusted.temp += 2;
    adjusted.windSpeed = (adjusted.windSpeed ?? 0) * 0.7;
  }

  return adjusted;
}

// ============================================================
// SYNTHESIZER ADAPTER
// ============================================================
function adaptComfortToIntel(c) {
  return {
    snapshot: {
      temp: c.temp,
      dewPoint: c.dewPoint,
      humidity: null,
      windSpeed: c.windSpeed ?? 0,
      windGust: null,
      precipType: ""
    },
    valleyFogRisk: false,
    ridgeFogRisk: false,
    smokeIndex: 0,
    frostRisk: false,
    freezeRisk: false,
    blackIceRisk: false
  };
}

function mapScoreToCategory(score) {
  if (score >= 8) return "veryComfortable";
  if (score >= 6.5) return "comfortable";
  if (score >= 5) return "slightlyUncomfortable";
  if (score >= 3.5) return "uncomfortable";
  return "harsh";
}

// ============================================================
// MAIN RENDER
// ============================================================
export function renderComfortNow(container, current, bestWindow, options = {}) {
  if (!container || !current) return;

  const mode = options.mode || "downtown";
  const isDay = options.isDay ?? true;

  const adjusted = applyModeAdjustments(current, mode);

  const comfort = calculateComfort(adjusted, {
    isDay,
    elevation: mode === "trail" ? 3000 : 2200,
    isValley: mode === "downtown"
  });

  if (!comfort) return;

  // ------------------------------------------------------------
  // MODE COMPARISON (IMPROVED LANGUAGE)
  // ------------------------------------------------------------
  const downtown = calculateComfort(applyModeAdjustments(current, "downtown"), { isDay });
  const trail = calculateComfort(applyModeAdjustments(current, "trail"), { isDay });

  const diff = Math.round((trail.score - downtown.score) * 10);

  function getWhyMessage(trail, downtown) {
    const d = {
      dew: trail.dewPoint - downtown.dewPoint,
      wind: trail.windSpeed - downtown.windSpeed,
      temp: trail.temp - downtown.temp
    };

    if (d.dew < -2) return "drier air";
    if (d.wind > 2) return "a bit more breeze";
    if (d.temp < -2) return "slightly cooler";

    if (d.dew > 2) return "more humidity";
    if (d.wind < -2) return "less airflow";
    if (d.temp > 2) return "a bit warmer";

    return "";
  }

  const why = getWhyMessage(trail, downtown);

  let modeNote = "";

  if (diff >= 2) {
    modeNote = why
      ? `🌲 Trails feel better — ${why}`
      : "🌲 Trails feel better right now";
  } else if (diff <= -2) {
    modeNote = why
      ? `🏙 Downtown feels better — ${why}`
      : "🏙 Downtown feels better right now";
  } else {
    modeNote = "Conditions feel similar across locations";
  }

  // ------------------------------------------------------------
  // SCORE
  // ------------------------------------------------------------
  const scoreValue = Math.round(comfort.score * 10);
  const scoreClass = getComfortClass(scoreValue);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // VOICE
  // ------------------------------------------------------------
  const intel = adaptComfortToIntel(comfort);
  const category = mapScoreToCategory(comfort.score);

  const narrative = assembleWithVoice(intel, "today", category, comfort.goldilocks);

  let headline = narrative.headline;
  if (comfort.goldilocks) headline = "Near perfect comfort";
  if (comfort.score <= 3) headline = "Uncomfortable";

  // ------------------------------------------------------------
  // BULLETS (FORCE DEPTH)
  // ------------------------------------------------------------
  let bullets = narrative.bullets || [];

  if (bullets.length < 2) {
    bullets = [
      bullets[0],
      buildFallbackBullet(comfort)
    ].filter(Boolean);
  }

  const bulletsHTML = `
    <ul class="comfort-bullets">
      ${bullets.map(b => `<li>${b}</li>`).join("")}
    </ul>
  `;

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  container.innerHTML = `
    <div class="comfort-module ${goldiClass}" data-accordion="comfort">

      <div class="comfort-main">
        <div class="comfort-emoji">${narrative.emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-score ${scoreClass}">
            ${scoreValue}
          </div>

          <div class="comfort-text">${headline}</div>

          ${bulletsHTML}

          ${
            comfort.goldilocks
              ? `<div class="comfort-goldi">✨ Ideal conditions right now</div>`
              : ""
          }

          <div class="comfort-mode-note">${modeNote}</div>
        </div>
      </div>

      <!-- EXPANDED -->
      <div class="comfort-expand">

        <div class="comfort-expand-row">
          <span>Temperature</span>
          <span>${round(comfort.temp)}°</span>
        </div>

        <div class="comfort-expand-row">
          <span>Dew Point</span>
          <span>${round(comfort.dewPoint)}°</span>
        </div>

        <div class="comfort-expand-row">
          <span>Wind</span>
          <span>${formatWind(comfort.windSpeed)}</span>
        </div>

        ${renderBestWindow(bestWindow)}

        <div class="comfort-extra-line">
          Comfort blends temperature, humidity, and wind into how it actually feels outside.
        </div>

      </div>
    </div>
  `;

  attachComfortInfoToggle(container);
  attachComfortAccordion(container);
}

// ============================================================
// HELPERS
// ============================================================
function round(v) {
  return v != null ? Math.round(v) : "--";
}

function getComfortClass(score) {
  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "okay";
  if (score >= 35) return "poor";
  return "bad";
}

function formatWind(wind) {
  if (!wind || wind < 1) return "Calm";
  return `${Math.round(wind)} mph`;
}

function buildFallbackBullet(c) {
  if (c.dewPoint > 65) return "Humidity adds a heavier feel";
  if (c.windSpeed > 8) return "A noticeable breeze is present";
  if (c.temp < 50) return "Cool air has a bit of a bite";
  if (c.temp > 80) return "Warm conditions build through the day";
  return "Conditions feel fairly balanced overall";
}

// ============================================================
// INTERACTIONS
// ============================================================
function attachComfortAccordion(container) {
  const module = container.querySelector("[data-accordion='comfort']");
  if (!module) return;

  const header = module.querySelector(".comfort-main");

  if (!header) return;

  header.addEventListener("click", () => {
    module.classList.toggle("open");
  });
}

function attachComfortInfoToggle(container) {
  const btn = container.querySelector(".comfort-info-toggle");
  const panel = container.querySelector(".comfort-info-panel");

  if (!btn || !panel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("open");
  });
}

// ============================================================
// BEST WINDOW
// ============================================================
function renderBestWindow(bestWindow) {
  if (!bestWindow?.hours?.length) return "";

  const first = bestWindow.hours[0];
  const last = bestWindow.hours[bestWindow.hours.length - 1];

  return `
    <div class="comfort-expand-row">
      <span>Best Window</span>
      <span>${first.hourLabel}–${last.hourLabel}</span>
    </div>

    <div class="comfort-extra-line">
      This is the most comfortable stretch based on temperature and humidity.
    </div>
  `;
}