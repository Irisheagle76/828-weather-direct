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

    humidity: mix(tempest.humidity, current.humidity, 0.85),

    wind: mix(tempest.windSpeed, current.wind, 0.8),
    windSpeed: mix(tempest.windSpeed, current.windSpeed, 0.8),

    windGust: Math.max(
      current.windGust ?? 0,
      tempest.windGust ?? 0
    ),

    solarRadiation:
      tempest.solarRadiation ?? current.solarRadiation
  };
}

// ============================================================
// NORMALIZE INPUT
// ============================================================

function normalizeCurrent(data = {}) {
  const temp = data.temp ?? data.temperature ?? data.temperatureF ?? null;

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

  // ------------------------------------------------------------
  // TEXT (FIXED)
  // ------------------------------------------------------------
  const headline =
    narrative?.headline || fallbackHeadline(comfort);

  const explanation = buildFullExplanation(comfort, narrative);

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

          <div class="comfort-explainer">${explanation}</div>
        </div>

      </div>

      <div class="comfort-expand">

        <div class="comfort-expand-headline">
          ${buildHeadline(score)}
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
// 🧠 NEW: FULL EXPLANATION ENGINE
// ============================================================

function buildFullExplanation(c, narrative) {
  const parts = [];

  // 1. FEEL
  if (c.dewPoint < 50)
    parts.push("Dry air makes it feel crisp and light.");
  else if (c.dewPoint > 65)
    parts.push("Humidity adds weight to the air.");

  if (c.temp < 55)
    parts.push("Cool temperatures add a noticeable chill.");
  else if (c.temp > 80)
    parts.push("Warm temperatures are starting to impact comfort.");

  if (c.windSpeed > 10)
    parts.push("A steady breeze is influencing how it feels.");

  // 2. TREND (always included)
  if (narrative?.trend === "improving") {
    parts.push("Conditions improve through the day.");
  } else if (narrative?.trend === "worsening") {
    parts.push("Conditions become less comfortable later.");
  } else {
    // fallback trend logic
    if (c.temp < 60 && c.dewPoint < 55) {
      parts.push("Expect a steady warm-up into more comfortable conditions.");
    }
  }

  // 3. EDGE SIGNAL
  if (c.dewPoint < 45 && c.windSpeed > 8) {
    parts.push("Dry air and wind may accelerate drying conditions.");
  }

  // 4. SYNTH BONUS
  if (narrative?.notes) {
    parts.push(narrative.notes);
  }

  return parts.slice(0, 3).join(" ");
}

// ============================================================
// REMAINING FUNCTIONS (UNCHANGED)
// ============================================================

function detectDominantFactor(c) {
  if (c.dewPoint >= 65) return "muggy";
  if (c.temp >= 85) return "heat";
  if (c.temp <= 45) return "cold";
  if (c.windSpeed >= 12) return "wind";
  if (c.dewPoint < 50) return "dry";
  return "neutral";
}

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

function fallbackHeadline(c) {
  if (c.goldilocks) return "Near-perfect comfort";
  if (c.temp < 55) return "Cool and crisp";
  if (c.temp > 80) return "Warm conditions";
  return "Comfortable overall";
}

function buildHeadline(score) {
  if (score >= 85) return "Feels really nice out";
  if (score >= 70) return "Comfortable overall";
  if (score >= 55) return "A bit uneven at times";
  return "Mixed comfort conditions";
}

function buildActions(c) {
  const a = [];

  if (c.goldilocks) a.push("Excellent time to be outside");
  if (c.temp < 55) a.push("Bring a light layer");
  if (c.temp > 85) a.push("Limit sun exposure");
  if (c.dewPoint > 65) a.push("Expect humidity");
  if (c.windSpeed > 10) a.push("Wind will be noticeable");

  return a.length ? a : ["Easy outdoor conditions"];
}

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