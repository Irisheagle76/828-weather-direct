// /js/modules/renderComfortNow.js (v7 — HARDENED)

import { calculateComfort } from "../intel/comfort.js";
import { assembleWithVoice } from "../intel/synthesizer/assembleWithVoice.js";

// ============================================================
// NORMALIZE INPUT (single source of truth)
// ============================================================

function normalizeCurrent(data = {}) {
  const temp = data.temp ?? data.temperature ?? data.temperatureF ?? null;
  const dewPoint = data.dewPoint ?? data.dewpoint ?? null;

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
// MODE ADJUSTMENTS
// ============================================================

function applyModeAdjustments(data, mode) {
  const adjusted = { ...data };

  if (mode === "trail") {
    adjusted.temp -= 3;
    adjusted.wind *= 1.2;
    adjusted.windSpeed = adjusted.wind;
    adjusted.clouds = (adjusted.clouds ?? 0) + 10;
  }

  if (mode === "downtown") {
    adjusted.temp += 2;
    adjusted.wind *= 0.7;
    adjusted.windSpeed = adjusted.wind;
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

  // ------------------------------------------------------------
  // NORMALIZE FIRST (critical)
  // ------------------------------------------------------------
  const normalized = normalizeCurrent(current);
  const adjusted = applyModeAdjustments(normalized, mode);

  const comfort = calculateComfort(adjusted, {
    isDay,
    elevation: mode === "trail" ? 3000 : 2200,
    isValley: mode === "downtown"
  });

  if (!comfort || comfort.temp == null) {
    console.warn("⚠️ Invalid comfort object", comfort);
    return;
  }

  // ------------------------------------------------------------
  // SCORE
  // ------------------------------------------------------------
  const score = Math.round((comfort.score || 0) * 10);
  const scoreClass = getComfortClass(score);
  const goldiClass = comfort.goldilocks ? "goldilocks" : "";

  // ------------------------------------------------------------
  // SYNTH INPUT (guaranteed shape)
  // ------------------------------------------------------------
  const intel = {
    signals: {
      temp: comfort.temp,
      dewPoint: comfort.dewPoint,
      wind: comfort.windSpeed
    },
    dominantFactor: detectDominantFactor(comfort),
    confidence: 0.7
  };

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(comfort.score),
    comfort.goldilocks
  );

  // ------------------------------------------------------------
  // DRIVERS
  // ------------------------------------------------------------
  const drivers = buildDrivers(comfort);

  const driverShort = drivers.map(d => d.short).join(" • ");
  const driverDetail = drivers.map(d => d.detail).join(" ");

  // ------------------------------------------------------------
  // TEXT
  // ------------------------------------------------------------
  const headline =
    narrative?.headline || fallbackHeadline(comfort);

  const explanation =
    narrative?.notes
      ? `${driverDetail} ${narrative.notes}`.trim()
      : driverDetail || fallbackExplanation(comfort);

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
          ${driverShort ? `<div class="comfort-score-sub">${driverShort}</div>` : ""}
        </div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-text">${headline}</div>

          ${explanation ? `
            <div class="comfort-explainer">${explanation}</div>
          ` : ""}
        </div>

      </div>

      <div class="comfort-expand">

        <div class="comfort-expand-headline">
          ${buildHeadline(comfort)}
        </div>

        ${actions.length ? `
          <div class="comfort-expand-actions">
            ${actions.map(a => `<div>• ${a}</div>`).join("")}
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

        ${renderBestWindow(bestWindow)}

      </div>

    </div>
  `;

  attachAccordion(container);
}

// ============================================================
// LOGIC
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
// DRIVERS (cleaned)
// ============================================================

function buildDrivers(c) {
  const d = [];

  if (c.dewPoint < 50) d.push(["Dry air", "The air feels crisp and light."]);
  else if (c.dewPoint >= 65) d.push(["Humid", "Humidity adds weight to the air."]);

  if (c.windSpeed < 5) d.push(["Calm", "Very little wind present."]);
  else if (c.windSpeed > 12) d.push(["Breezy", "Wind noticeably affects feel."]);

  if (c.temp >= 65 && c.temp <= 75)
    d.push(["Ideal temp", "Temperatures are in the comfort sweet spot."]);
  else if (c.temp < 55)
    d.push(["Cool", "Cool air adds a slight edge."]);
  else if (c.temp > 80)
    d.push(["Warm", "Heat is beginning to affect comfort."]);

  return d.slice(0, 3).map(([short, detail]) => ({ short, detail }));
}

// ============================================================
// TEXT FALLBACKS
// ============================================================

function fallbackHeadline(c) {
  if (c.goldilocks) return "Near-perfect comfort";
  if (c.temp < 55) return "Cool and crisp";
  if (c.temp > 80) return "Warm conditions";
  return "Comfortable overall";
}

function fallbackExplanation(c) {
  const parts = [];

  if (c.dewPoint < 55) parts.push("Dry air");
  else if (c.dewPoint > 65) parts.push("Humidity noticeable");

  if (c.windSpeed < 5) parts.push("light wind");
  else if (c.windSpeed > 12) parts.push("breezy");

  return parts.length ? parts.join(", ") + "." : "";
}

// ============================================================
// ACTIONS
// ============================================================

function buildActions(c) {
  const a = [];

  if (c.goldilocks) a.push("Excellent time to be outside");
  if (c.temp < 55) a.push("Bring a light layer");
  if (c.temp > 85) a.push("Limit sun exposure");
  if (c.dewPoint > 65) a.push("Expect humidity");
  if (c.windSpeed > 10) a.push("Wind will be noticeable");

  return a.length ? a : ["Easy outdoor conditions"];
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

function formatWind(w) {
  if (!w || w < 1) return "Calm";
  return `${Math.round(w)} mph`;
}

function mapScoreToCategory(score) {
  if (score >= 8) return "veryComfortable";
  if (score >= 6.5) return "comfortable";
  if (score >= 5) return "slight";
  if (score >= 3.5) return "uncomfortable";
  return "harsh";
}

// ============================================================
// UI
// ============================================================

function attachAccordion(container) {
  const module = container.querySelector(".comfort-module");
  const header = container.querySelector(".comfort-main");
  if (!module || !header) return;
  header.onclick = () => module.classList.toggle("open");
}

function renderBestWindow(bestWindow) {
  if (!bestWindow?.hours?.length) return "";

  const first = bestWindow.hours[0];
  const last = bestWindow.hours.at(-1);

  return `
    <div class="comfort-expand-row comfort-best-window">
      <span>Best Time Outside</span>
      <span>${first.hourLabel}–${last.hourLabel}</span>
    </div>
  `;
}