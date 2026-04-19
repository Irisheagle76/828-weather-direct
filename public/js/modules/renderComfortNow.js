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

  // 👇 ADD THIS LINE
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

function buildFullExplanation(c, narrative, hourly = []) {
  const primary = [];
  const secondary = [];

  // --------------------------------------------------
  // 1. CORE FEEL (always first)
  // --------------------------------------------------
  if (c.dewPoint < 50)
    primary.push("Dry air makes it feel crisp and light.");
  else if (c.dewPoint > 65)
    primary.push("Humidity adds weight to the air.");

  if (c.temp < 55)
    primary.push("Cool temperatures add a noticeable chill.");
  else if (c.temp > 80)
    primary.push("Warm temperatures are starting to impact comfort.");

  // --------------------------------------------------
  // 2. TREND (ALWAYS PROMINENT)
  // --------------------------------------------------
  const trend = analyzeTrend(hourly);

  if (trend.strongWarmup) {
    primary.push("A rapid warm-up is expected over the next few hours.");
  } else if (trend.mildWarmup) {
    primary.push("Temperatures trend upward through late morning.");
  } else {
    primary.push(
      c.temp < 60
        ? "Temperatures gradually improve through the morning."
        : "Conditions remain fairly steady over the next few hours."
    );
  }

  // --------------------------------------------------
  // 3. SECONDARY DETAILS
  // --------------------------------------------------
  if (trend.afternoonPeak) {
    secondary.push("The warmest stretch arrives early this afternoon.");
  }

  if (trend.coolingAfterPeak) {
    secondary.push("Conditions ease slightly after the peak.");
  }

  if (trend.windIncreasing) {
    secondary.push("Winds increase as the day progresses.");
  }

  if (trend.drying) {
    secondary.push("Air continues drying out.");
  }

  if (c.windSpeed > 10) {
    secondary.push("A steady breeze is influencing how it feels.");
  }

  if (c.dewPoint < 45 && c.windSpeed > 8) {
    secondary.push("Dry air and wind may accelerate drying conditions.");
  }

  // --------------------------------------------------
  // 4. SYNTH (ONLY IF WE SOMEHOW FAILED)
  // --------------------------------------------------
  if (!primary.length && narrative?.notes) {
    primary.push(narrative.notes);
  }

  // --------------------------------------------------
  // FINAL COMPOSITION (structured, not random)
  // --------------------------------------------------
  return [...primary.slice(0, 2), ...secondary.slice(0, 2)].join(" ");
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

function analyzeTrend(hourly = []) {
  if (!hourly.length) return {};

  const now = Date.now();

  const future = hourly
    .filter(h => h.timestamp >= now)
    .slice(0, 5); // look slightly further

  if (future.length < 2) return {};

  const first = future[0];
  const peak = future.reduce((max, h) =>
    h.temperatureF > max.temperatureF ? h : max,
    future[0]
  );

  const last = future[future.length - 1];

  const tempRise = peak.temperatureF - first.temperatureF;
  const tempDrop = last.temperatureF - peak.temperatureF;

  const windRise =
    (last.windSpeed ?? 0) - (first.windSpeed ?? 0);

  const humidityDrop =
    (first.relative_humidity ?? 0) -
    (last.relative_humidity ?? 0);

  return {
    strongWarmup: tempRise >= 6,
    mildWarmup: tempRise >= 3,

    afternoonPeak:
      peak.timestamp !== first.timestamp,

    coolingAfterPeak: tempDrop < -2,

    windIncreasing: windRise > 3,

    drying: humidityDrop > 5
  };
}