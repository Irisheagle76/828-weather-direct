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
// SYNTHESIZER ADAPTER (UNCHANGED)
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
// WIND FORMAT
// ============================================================
function formatWind(wind) {
  if (!wind || wind < 1) return "Calm";
  return `${Math.round(wind)} mph`;
}

// ============================================================
// MAIN RENDER
// ============================================================
export function renderComfortNow(container, current, bestWindow, options = {}) {
  if (!container || !current) return;

  const mode = options.mode || "downtown";
  const isDay = options.isDay ?? true;

  // ------------------------------------------------------------
  // PRIMARY COMFORT
  // ------------------------------------------------------------
  const adjusted = applyModeAdjustments(current, mode);

  const comfort = calculateComfort(adjusted, {
    isDay,
    elevation: mode === "trail" ? 3000 : 2200,
    isValley: mode === "downtown"
  });

  if (!comfort) return;

  // ------------------------------------------------------------
  // MODE COMPARISON (KEEP — THIS IS STRONG)
  // ------------------------------------------------------------
  const downtown = calculateComfort(
    applyModeAdjustments(current, "downtown"),
    { isDay }
  );

  const trail = calculateComfort(
    applyModeAdjustments(current, "trail"),
    { isDay }
  );

  const diff = Math.round((trail.score - downtown.score) * 10);

  function getWhyMessage(trail, downtown) {
    const reasons = [];

    if (trail.dewPoint < downtown.dewPoint - 2) reasons.push("less humid");
    else if (trail.dewPoint > downtown.dewPoint + 2) reasons.push("more humid");

    if (trail.windSpeed > downtown.windSpeed + 2) reasons.push("more breeze");
    else if (trail.windSpeed < downtown.windSpeed - 2) reasons.push("calmer wind");

    if (trail.temp < downtown.temp - 2) reasons.push("cooler air");
    else if (trail.temp > downtown.temp + 2) reasons.push("warmer air");

    return reasons.slice(0, 2).join(" and ");
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
    modeNote = "No major difference between locations";
  }

  // ------------------------------------------------------------
  // SCORE
  // ------------------------------------------------------------
  const scoreValue = Math.round(comfort.score * 10);
  const scoreClass = getComfortClass(scoreValue);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // 🔥 ASSEMBLE (UPGRADED — NOT REPLACED)
  // ------------------------------------------------------------
  const intel = adaptComfortToIntel(comfort);
  const category = mapScoreToCategory(comfort.score);

  const narrative = assembleWithVoice(
    intel,
    "today",
    category,
    comfort.goldilocks
  );

  // ------------------------------------------------------------
  // HEADLINE (SCORE-AWARE)
  // ------------------------------------------------------------
  let headline = narrative.headline;

  if (comfort.goldilocks) headline = "Near perfect comfort";
  if (comfort.score <= 3) headline = "Uncomfortable";

  const bullets = narrative.bullets || [];

  const bulletsHTML =
    bullets.length === 1
      ? `<div class="comfort-support">${bullets[0]}</div>`
      : bullets.length > 1
      ? `<ul class="comfort-bullets">${bullets.map(b => `<li>${b}</li>`).join("")}</ul>`
      : "";

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

          <!-- HEADLINE -->
          <div class="comfort-text">${headline}</div>

          <!-- BULLETS (your strength) -->
          ${bulletsHTML}

          <!-- GOLDILOCKS -->
          ${
            comfort.goldilocks
              ? `<div class="comfort-goldi">✨ Ideal conditions right now</div>`
              : ""
          }

          <!-- MODE CONTEXT -->
          <div class="comfort-mode-note">${modeNote}</div>
        </div>
      </div>

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

// ============================================================
// INTERACTIONS (FIX FOR MISSING FUNCTIONS)
// ============================================================

// Simple accordion toggle
function attachComfortAccordion(container) {
  const module = container.querySelector("[data-accordion='comfort']");
  if (!module) return;

  const header = module.querySelector(".comfort-main");
  const expand = module.querySelector(".comfort-expand");

  if (!header || !expand) return;

  header.addEventListener("click", () => {
    module.classList.toggle("open");
  });
}

// Optional info toggle (safe no-op if not present in DOM)
function attachComfortInfoToggle(container) {
  const btn = container.querySelector(".comfort-info-toggle");
  const panel = container.querySelector(".comfort-info-panel");

  if (!btn || !panel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // prevent accordion trigger
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
      Most comfortable stretch based on better temperature and lower humidity.
    </div>
  `;
}