// /js/modules/renderComfortNow.js

import { calculateComfort } from "./js/intel/comfort.js";

//
// =========================
// MODE ADJUSTMENTS
// =========================
function applyModeAdjustments(data, mode) {
  const adjusted = { ...data };

  if (mode === "trail") {
    adjusted.temp -= 3;
    adjusted.wind *= 1.2;
    adjusted.clouds += 10;
  }

  if (mode === "downtown") {
    adjusted.temp += 2;
    adjusted.wind *= 0.7;
  }

  return adjusted;
}

//
// =========================
// MAIN RENDER
// =========================
export function renderComfortNow(container, current, bestWindow, options = {}) {
  if (!container || !current) return;

  const mode = options.mode || "downtown";
  const isDay = options.isDay ?? true;

  // =========================
  // PRIMARY MODE CALCULATION
  // =========================
  const adjusted = applyModeAdjustments(current, mode);

  const comfortNow = calculateComfort(adjusted, {
    isDay,
    elevation: mode === "trail" ? 3000 : 2200,
    isValley: mode === "downtown"
  });

  if (!comfortNow) return;

// =========================
// COMPARISON (ENHANCED)
// =========================
const downtown = calculateComfort(
  applyModeAdjustments(current, "downtown"),
  { isDay, elevation: 2200, isValley: true }
);

const trail = calculateComfort(
  applyModeAdjustments(current, "trail"),
  { isDay, elevation: 3000, isValley: false }
);

const diff = Math.round((trail.score - downtown.score) * 10) / 10;

// Build message + metadata
let modeNote = "";
let modeClass = "";
let modeArrow = "";

if (diff >= 2) {
  modeNote = `+${diff} better on trails`;
  modeClass = "better-trail";
  modeArrow = "↗";
} else if (diff <= -2) {
  modeNote = `${diff} better downtown`;
  modeClass = "better-city";
  modeArrow = "↘";
}

  // =========================
  // SCORE (convert to 0–100)
  // =========================
  const scoreValue = Math.round(comfortNow.score * 10);
  const score = `${scoreValue} / 100`;
  const scoreClass = getComfortClass(scoreValue);

  // =========================
  // HEADLINE
  // =========================
  let headline = `${comfortNow.label}`;

  if (comfortNow.goldilocks) headline = "Perfect Outside";
  else if (comfortNow.flags.veryHot && comfortNow.flags.veryHumid) headline = "Hot & Sticky";
  else if (comfortNow.flags.veryHot) headline = "Very Hot";
  else if (comfortNow.flags.veryHumid) headline = "Humid";
  else if (comfortNow.flags.crisp && comfortNow.score >= 7) headline = "Crisp & Comfortable";

  // =========================
  // BULLETS
  // =========================
  const bullets = buildBullets(comfortNow);

  const bulletsHTML =
    bullets.length === 1
      ? `<div class="comfort-support">${bullets[0]}</div>`
      : bullets.map(b => `<li>${b}</li>`).join("");

  const goldiClass = comfortNow.goldilocks ? "goldilocks" : "";

  // =========================
  // RENDER
  // =========================
  container.innerHTML = `
    <div class="comfort-module ${goldiClass}" data-accordion="comfort">

      <!-- TOP ROW -->
      <div class="comfort-main">
        <div class="comfort-emoji">${getEmoji(comfortNow)}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-score-row">
            <div class="comfort-score ${scoreClass}">
              ${score}
            </div>

            <button class="comfort-info-btn" aria-expanded="false">
              ⓘ
            </button>
          </div>

          <div class="comfort-explainer hidden">
            Blends temperature, humidity (dew point), wind, and sun into a comfort score tuned for Asheville.
          </div>

          <div class="comfort-text">
            ${headline}
          </div>

          ${
            modeNote
              ? `<div class="comfort-mode-note">${modeNote}</div>`
              : ""
          }
        </div>
      </div>

      <!-- BULLETS -->
      <div class="comfort-body">
        ${
          bullets.length === 1
            ? bulletsHTML
            : `<ul class="comfort-bullets">${bulletsHTML}</ul>`
        }
      </div>

      <!-- EXPANDED PANEL -->
      <div class="comfort-expand">

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Temperature</span>
          <span class="comfort-expand-value">${comfortNow.temp}°</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Dew Point</span>
          <span class="comfort-expand-value">${comfortNow.dewPoint}°</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Wind</span>
          <span class="comfort-expand-value">
            ${current.wind != null ? Math.round(current.wind) + " mph" : "--"}
          </span>
        </div>

        ${renderBestWindow(bestWindow)}

      </div>

    </div>
  `;

  attachComfortInfoToggle(container);
  attachComfortAccordion(container);
}

//
// =========================
// BULLETS
// =========================
function buildBullets(c) {
  if (c.goldilocks) {
    return [
      "Perfect temperature",
      "Comfortable humidity",
      "Light breeze"
    ];
  }

  const bullets = [];

  if (c.flags.veryHot) bullets.push("Very hot");
  if (c.flags.veryHumid) bullets.push("Sticky humidity");
  if (c.flags.harshSun) bullets.push("Harsh sun");

  if (c.flags.crisp) bullets.push("Crisp mountain air");
  if (c.flags.windy && !c.flags.veryHot) bullets.push("Nice breeze");

  if (!bullets.length) {
    if (c.score >= 7) bullets.push("Comfortable overall");
    else if (c.score >= 5) bullets.push("Not bad");
    else bullets.push("Conditions not ideal");
  }

  return bullets.slice(0, 3);
}

//
// =========================
// EMOJI
// =========================
function getEmoji(c) {
  if (c.goldilocks) return "✨";
  if (c.flags.veryHot && c.flags.veryHumid) return "🥵";
  if (c.flags.veryHot) return "☀️";
  if (c.flags.crisp && c.score >= 7) return "🍃";
  if (c.score <= 3) return "🥶";
  return "🌤️";
}

//
// =========================
// BEST WINDOW
// =========================
function renderBestWindow(bestWindow) {
  if (!bestWindow || !bestWindow.hours?.length) return "";

  const first = bestWindow.hours[0];
  const last = bestWindow.hours[bestWindow.hours.length - 1];

  return `
    <div class="comfort-expand-row">
      <span class="comfort-expand-label">Best Window</span>
      <span class="comfort-expand-value">
        ${first.hourLabel}–${last.hourLabel}
      </span>
    </div>

    <div class="comfort-extra-line">
      Most comfortable stretch based on lower humidity, lighter wind, and better temperature balance.
    </div>
  `;
}

//
// =========================
// INFO TOGGLE
// =========================
function attachComfortInfoToggle(container) {
  const btn = container.querySelector(".comfort-info-btn");
  const explainer = container.querySelector(".comfort-explainer");

  if (!btn || !explainer) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = explainer.classList.toggle("hidden");
    btn.setAttribute("aria-expanded", !isHidden);
  });
}

//
// =========================
// SCORE COLOR
// =========================
function getComfortClass(score) {
  if (score == null) return "neutral";

  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "okay";
  if (score >= 35) return "poor";
  return "bad";
}

//
// =========================
// ACCORDION
// =========================
function attachComfortAccordion(container) {
  const module = container.querySelector(".comfort-module");
  if (!module) return;

  module.addEventListener("click", (e) => {
    if (e.target.closest(".comfort-info-btn")) return;
    module.classList.toggle("active");
  });
}