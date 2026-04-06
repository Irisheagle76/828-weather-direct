// /js/modules/renderComfortNow.js

import { calculateComfort } from "../intel/comfort.js";
import { assemble } from "../intel/synthesizer/assemble.js";

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
// Mode Helper for Trail vs. Downtown
// ============================================================
function getModeNoteFromSelection() {
  const active = document.querySelector('.mode-btn.active');
  if (!active) return "Conditions are balanced";

  const mode = active.dataset.mode;

  if (mode === "trail") {
    return "🌲 Better conditions on trails";
  }

  if (mode === "downtown") {
    return "🏙 Better conditions downtown";
  }

  return "Conditions are balanced";
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
  // MODE COMPARISON
  // ------------------------------------------------------------
  const downtown = calculateComfort(
    applyModeAdjustments(current, "downtown"),
    { isDay }
  );

  const trail = calculateComfort(
    applyModeAdjustments(current, "trail"),
    { isDay }
  );

const downtownScore = downtown.score;
const trailScore = trail.score;

const diff = Math.round((trailScore - downtownScore) * 10);

function getWhyMessage(trail, downtown) {
  const reasons = [];

  // Dew point / humidity (most important)
  if (trail.dewPoint < downtown.dewPoint - 2) {
    reasons.push("less humid");
  } else if (trail.dewPoint > downtown.dewPoint + 2) {
    reasons.push("more humid");
  }

  // Wind
  if (trail.windSpeed > downtown.windSpeed + 2) {
    reasons.push("more breeze");
  } else if (trail.windSpeed < downtown.windSpeed - 2) {
    reasons.push("calmer wind");
  }

  // Temperature
  if (trail.temp < downtown.temp - 2) {
    reasons.push("cooler air");
  } else if (trail.temp > downtown.temp + 2) {
    reasons.push("warmer air");
  }

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
  modeNote = "⚖️ Conditions are similar across locations";
}

  // ------------------------------------------------------------
  // SCORE
  // ------------------------------------------------------------
  const scoreValue = Math.round(comfort.score * 10);
  const score = `${scoreValue} / 100`;
  const scoreClass = getComfortClass(scoreValue);

  // ------------------------------------------------------------
  // 🔥 SYNTHESIZER (CORRECTLY WIRED)
  // ------------------------------------------------------------
  const intel = adaptComfortToIntel(comfort);
  const category = mapScoreToCategory(comfort.score);

  const narrative = assemble.assemble(
  intel,
  "today",
  category,
  comfort.goldilocks
);

  const headline = narrative?.headline || "Comfort conditions";
  const bullets = narrative?.bullets || [];
  const emoji = narrative?.emoji || getFallbackEmoji(comfort);

  const bulletsHTML =
    bullets.length === 1
      ? `<div class="comfort-support">${bullets[0]}</div>`
      : `<ul class="comfort-bullets">${bullets.map(b => `<li>${b}</li>`).join("")}</ul>`;

  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  container.innerHTML = `
    <div class="comfort-module ${goldiClass}" data-accordion="comfort">

      <div class="comfort-main">
        <div class="comfort-emoji">${emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-score-row">
            <div class="comfort-score ${scoreClass}">
              ${score}
            </div>

            <button class="comfort-info-btn" aria-expanded="false">ⓘ</button>
          </div>

          <div class="comfort-explainer hidden">
            Combines temperature, dew point, wind, and sun into a real-world comfort score.
          </div>

          <div class="comfort-text">${headline}</div>

       <div class="comfort-mode-note">
  ${modeNote}
  <span class="mode-info" title="Trail = cooler, breezier, more exposed conditions. Downtown = warmer, more sheltered.">ⓘ</span>
</div>
        </div>
      </div>

      <div class="comfort-body">
        ${bulletsHTML}
      </div>

      <div class="comfort-expand">

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Temperature</span>
          <span class="comfort-expand-value">${round(comfort.temp)}°</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Dew Point</span>
          <span class="comfort-expand-value">${round(comfort.dewPoint)}°</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Wind</span>
          <span class="comfort-expand-value">
            ${round(comfort.windSpeed)} mph
          </span>
        </div>

        ${renderBestWindow(bestWindow)}

      </div>
    </div>
  `;

  attachComfortInfoToggle(container);
  attachComfortAccordion(container);
}

// ============================================================
// FALLBACK EMOJI (only used if synthesizer fails)
// ============================================================
function getFallbackEmoji(c) {
  if (c.goldilocks) return "✨";
  if (c.flags?.veryHot && c.flags?.veryHumid) return "🥵";
  if (c.flags?.veryHot) return "☀️";
  if (c.flags?.crisp && c.score >= 7) return "🍃";
  if (c.score <= 3) return "🥶";
  return "🌤️";
}

// ============================================================
// BEST WINDOW
// ============================================================
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
      Most comfortable stretch based on better temperature and lower humidity.
    </div>
  `;
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
// UI BEHAVIOR
// ============================================================
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

function attachComfortAccordion(container) {
  const module = container.querySelector(".comfort-module");
  if (!module) return;

  module.addEventListener("click", (e) => {
    if (e.target.closest(".comfort-info-btn")) return;
    module.classList.toggle("active");
  });
}