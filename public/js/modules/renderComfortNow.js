// /js/modules/renderComfortNow.js (v5 — FIXED & CLEANED)

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
  // SCORE (comfort.score is already 0–10)
  // ------------------------------------------------------------
  const scoreValue = Math.round(comfort.score * 10); // 0–100 scale
  const scoreClass = getComfortClass(scoreValue);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // SYNTHESIZER
  // ------------------------------------------------------------
  const intel = {
    signals: {
      temp: comfort.temp,
      dewPoint: comfort.dewPoint,
      windSpeed: comfort.windSpeed
    },
    dominantFactor: detectDominantFactor(comfort),
    confidence: 0.7
  };

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(comfort.score), // feed raw 0–10 score
    comfort.goldilocks
  );

  const headline = narrative?.headline || fallbackHeadline(comfort);
 const driverExplanation = unifiedDrivers
  .map(d => d.detail)
  .join(" ");

const explanation =
  narrative?.notes
    ? `${driverExplanation} ${narrative.notes}`
    : driverExplanation || fallbackExplanation(comfort);

  // ------------------------------------------------------------
  // SAFE VALUES
  // ------------------------------------------------------------
  const safeHeadline = headline || "Comfort looks good";
  const safeExplanation = typeof explanation === "string" ? explanation : "";

const unifiedDrivers = buildUnifiedDrivers(comfort);

const safeDrivers = unifiedDrivers.length
  ? unifiedDrivers.map(d => d.short).join(" • ")
  : "";

  const actions = buildActions(comfort);
  const safeActions = Array.isArray(actions) ? actions : [];

  const safeBestWindow = renderBestWindow(bestWindow) || "";

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  container.innerHTML = `
    <div class="comfort-module ${goldiClass}">

      <div class="comfort-main">

        <div class="comfort-score-block ${scoreClass}">
          <div class="comfort-score-main">${scoreValue}</div>
          <div class="comfort-score-label">comfort</div>
          ${safeDrivers ? `
            <div class="comfort-score-sub">${safeDrivers}</div>
          ` : ""}
        </div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-text">
            ${safeHeadline}
          </div>

          ${safeExplanation ? `
            <div class="comfort-explainer">
              ${safeExplanation}
            </div>
          ` : ""}
        </div>

      </div>

      <div class="comfort-expand">

        <div class="comfort-expand-headline">
          ${buildHeadline(comfort)}
        </div>

        ${safeActions.length ? `
          <div class="comfort-expand-actions">
            ${safeActions.map(a => `<div>• ${a}</div>`).join("")}
          </div>
        ` : ""}

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

        ${safeBestWindow}

      </div>

    </div>
  `;

  // ------------------------------------------------------------
  // ACCORDION HOOKUP (FIXED)
  // ------------------------------------------------------------
  attachAccordion(container);
}

// ============================================================
// SYNTH HELPERS
// ============================================================

function detectDominantFactor(c) {
  if (c.dewPoint >= 65) return "muggy";
  if (c.temp >= 85) return "heat";
  if (c.temp <= 45) return "cold";
  if (c.windSpeed >= 12) return "wind";
  if (c.dewPoint < 50) return "sun";
  return "neutral";
}

// ============================================================
// FALLBACKS
// ============================================================

function fallbackHeadline(c) {
  if (c.goldilocks) return "Near-perfect comfort";
  if (c.temp < 55) return "Cool and crisp";
  if (c.temp > 80) return "Warm conditions";
  return "Comfortable overall";
}

function fallbackExplanation(c) {
  const parts = [];

  if (c.dewPoint < 55) parts.push("Dry, comfortable air");
  else if (c.dewPoint > 65) parts.push("Humidity adds weight");

  if (c.windSpeed < 5) parts.push("with very little wind");
  else if (c.windSpeed > 12) parts.push("with noticeable breeze");

  return parts.join(", ") + ".";
}

// ============================================================
// SCORE DRIVERS
// ============================================================

function buildScoreDrivers(c) {
  const parts = [];

  if (c.dewPoint < 55) parts.push("Dry air");
  else if (c.dewPoint >= 65) parts.push("Humid");

  if (c.windSpeed < 5) parts.push("Calm");
  else if (c.windSpeed > 12) parts.push("Breezy");

  if (c.temp >= 65 && c.temp <= 75) parts.push("Ideal temp");
  else if (c.temp < 55) parts.push("Cool");
  else if (c.temp > 80) parts.push("Warm");

  return parts.slice(0, 3).join(" • ");
}

function buildUnifiedDrivers(c) {
  const drivers = [];

  // Moisture
  if (c.dewPoint < 50) {
    drivers.push({
      short: "Dry air",
      detail: "The air stays dry and crisp, which makes everything feel lighter."
    });
  } else if (c.dewPoint >= 65) {
    drivers.push({
      short: "Humid air",
      detail: "Humidity adds weight to the air and starts to affect comfort."
    });
  }

  // Wind
  if (c.windSpeed < 5) {
    drivers.push({
      short: "Calm wind",
      detail: "Very little wind keeps conditions steady and easy."
    });
  } else if (c.windSpeed > 12) {
    drivers.push({
      short: "Breezy",
      detail: "Noticeable wind adds movement and changes how it feels."
    });
  }

  // Temperature
  if (c.temp >= 65 && c.temp <= 75) {
    drivers.push({
      short: "Ideal temp",
      detail: "Temperatures sit right in the comfort sweet spot."
    });
  } else if (c.temp < 55) {
    drivers.push({
      short: "Cool air",
      detail: "Cool air adds a slight edge, especially in shade."
    });
  } else if (c.temp > 80) {
    drivers.push({
      short: "Warm",
      detail: "Heat begins to push the comfort level slightly."
    });
  }

  return drivers.slice(0, 3);
}

// ============================================================
// EXPANDED LOGIC
// ============================================================

function buildHeadline(c) {
  if (c.goldilocks)
    return "Everything is working in your favor right now";

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
    actions.push("Easy conditions for most outdoor plans");

  return actions;
}

// ============================================================
// HELPERS
// ============================================================

function round(v) {
  return v != null ? Math.round(v) : "--";
}

function getComfortClass(score) {
  if (score >= 85) return "elite";
  if (score >= 75) return "great";
  if (score >= 60) return "good";
  if (score >= 45) return "okay";
  return "poor";
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
    <div class="comfort-expand-row comfort-best-window">
      <span>Best Time Outside</span>
      <span>${first.hourLabel}–${last.hourLabel}</span>
    </div>
  `;
}