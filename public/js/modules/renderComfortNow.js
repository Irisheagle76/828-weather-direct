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
  // SCORE + STYLE
  // ------------------------------------------------------------
  const scoreValue = Math.round(comfort.score * 10);
  const scoreClass = getComfortClass(scoreValue);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // HEADLINE + BULLETS (collapsed)
  // ------------------------------------------------------------
  const narrative = assembleWithVoice(
    { snapshot: comfort },
    "today",
    mapScoreToCategory(comfort.score),
    comfort.goldilocks
  );

  let headline = narrative.headline;
  if (comfort.goldilocks) headline = "Near perfect comfort";
  if (comfort.score <= 3) headline = "Uncomfortable";

  const bullets = (narrative.bullets || []).slice(0, 2);

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  container.innerHTML = `
    <div class="comfort-module ${goldiClass}">

      <!-- COLLAPSED -->
      <div class="comfort-main">

        <div class="comfort-score-block ${scoreClass}">
          <div class="comfort-score-main">${scoreValue}</div>
          <div class="comfort-score-label">comfort</div>
        </div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-text">${headline}</div>

          <ul class="comfort-bullets">
            ${bullets.map(b => `<li>${b}</li>`).join("")}
          </ul>
        </div>

      </div>

      <!-- EXPANDED -->
      <div class="comfort-expand">

        <div class="comfort-expand-headline">
          ${buildHeadline(comfort)}
        </div>

        <div class="comfort-expand-actions">
          ${buildActions(comfort).map(a => `<div>• ${a}</div>`).join("")}
        </div>

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

// ============================================================
// ACTION LOGIC
// ============================================================

function buildHeadline(c) {
  if (c.goldilocks) return "Near-perfect conditions right now";

  if (c.dewPoint > 65 && c.temp > 75)
    return "Warm and humid — stickiness is the main factor";

  if (c.temp < 55)
    return "Cool air — a light layer will help";

  if (c.windSpeed > 12)
    return "Wind is strongly affecting comfort";

  if (c.temp > 85)
    return "Heat is the dominant factor";

  return "Conditions are generally comfortable";
}

function buildActions(c) {
  const actions = [];

  if (c.goldilocks) actions.push("Excellent time to be outside");
  if (c.temp < 55) actions.push("Bring a light layer");
  if (c.temp > 85) actions.push("Limit sun exposure");
  if (c.dewPoint > 65) actions.push("Expect stickiness");
  if (c.windSpeed > 10) actions.push("Wind will affect how it feels");

  if (!actions.length)
    actions.push("Comfortable conditions for most activities");

  return actions;
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

function mapScoreToCategory(score) {
  if (score >= 8) return "veryComfortable";
  if (score >= 6.5) return "comfortable";
  if (score >= 5) return "slightlyUncomfortable";
  if (score >= 3.5) return "uncomfortable";
  return "harsh";
}

// ============================================================
// ACCORDION
// ============================================================

function attachAccordion(container) {
  const module = container.querySelector(".comfort-module");
  const header = container.querySelector(".comfort-main");

  if (!module || !header) return;

  header.onclick = () => {
    module.classList.toggle("open");
  };
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
  `;
}