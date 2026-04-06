// /js/weather-render.js

// ============================================================
// IMPORTS
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";
import { calculateComfort } from "./intel/comfort.js";

import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { generateNarrative } from "./intel/synthesizer/index.js";

import { renderComfortNow } from "./modules/renderComfortNow.js";
import { renderFutureComfort } from "./modules/renderFutureComfort.js";
import {
  renderHumanAction,
  renderHumanActionExpanded
} from "./modules/renderHumanAction.js";

// ============================================================
// HELPERS
// ============================================================

const $ = id => document.getElementById(id);

// ------------------------------------------------------------
// MODE ADJUSTMENT (shared)
// ------------------------------------------------------------
function applyModeAdjustments(data, mode) {
  const adjusted = { ...data };

  if (mode === "trail") {
    adjusted.temp -= 3;
    adjusted.wind *= 1.2;
    adjusted.clouds = (adjusted.clouds ?? 0) + 10;
  }

  if (mode === "downtown") {
    adjusted.temp += 2;
    adjusted.wind *= 0.7;
  }

  return adjusted;
}

// ------------------------------------------------------------
// CURRENT CONDITIONS
// ------------------------------------------------------------
function resolveCurrentConditions(raw, hourly) {
  if (!hourly?.length) return null;

  const now = Date.now();
  const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

  let idx = hourly.findIndex(h => getTs(h) >= now);
  if (idx === -1) idx = hourly.length - 1;

  const fallback = hourly[idx];

  return {
    temp: raw.tempest?.air_temperature ?? fallback.temperatureF ?? null,
    dewPoint: raw.tempest?.dew_point ?? fallback.dewpointF ?? null,
    humidity: raw.tempest?.relative_humidity ?? fallback.relative_humidity ?? null,
    wind: raw.tempest?.wind_avg != null
      ? raw.tempest.wind_avg * 2.23694
      : fallback.wind_speed ?? 0,
    clouds: fallback.cloudcover ?? 0,
    obsTimeLocal: raw.tempest?.timestamp ?? fallback.timestamp ?? Date.now()
  };
}

// ------------------------------------------------------------
// CURRENT OBS RENDER
// ------------------------------------------------------------
function renderCurrentObs(current) {
  const el = $("current-obs-inline");
  if (!el || !current) return;

  el.innerHTML = `
    <div class="obs-row">

      <div class="obs-item">
        🌡️ ${fmt(current.temp)}
        <span class="obs-label">${describeTemp(current.temp)}</span>
      </div>

      <div class="obs-item">
        💧 ${fmt(current.dewPoint)}
        <span class="obs-label">${describeDew(current.dewPoint)}</span>
      </div>

      <div class="obs-item">
        💦 ${pct(current.humidity)}
        <span class="obs-label">${describeHumidity(current.humidity)}</span>
      </div>

      <div class="obs-item">
        💨 ${wind(current.wind)}
        <span class="obs-label">${describeWind(current.wind)}</span>
      </div>

    </div>
  `;
}
function describeTemp(t) {
  if (t == null) return "";
  if (t < 40) return "Cold";
  if (t < 55) return "Chilly";
  if (t < 68) return "Cool";
  if (t < 78) return "Comfortable";
  if (t < 86) return "Warm";
  if (t < 93) return "Hot";
  return "Sweltering";
}

function describeDew(d) {
  if (d == null) return "";
  if (d < 45) return "Dry";
  if (d < 55) return "Pleasant";
  if (d < 62) return "Slightly humid";
  if (d < 68) return "Humid";
  if (d < 72) return "Sticky";
  return "Oppressive"; // Asheville summer trigger
}

function describeHumidity(h) {
  if (h == null) return "";
  if (h < 35) return "Dry";
  if (h < 55) return "Balanced";
  if (h < 70) return "Humid";
  if (h < 85) return "Heavy";
  return "Soupy";
}

function describeWind(w) {
  if (w == null) return "";
  if (w < 3) return "Still";
  if (w < 7) return "Light";
  if (w < 12) return "Breezy";
  if (w < 20) return "Windy";
  return "Gusty";
}

// ------------------------------------------------------------
// BEST WINDOW
// ------------------------------------------------------------
function findBestComfortWindow(hourly, mode, isDay) {
  if (!hourly?.length) return null;

  const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

  let best = null;

  for (let i = 0; i < hourly.length - 2; i++) {
    let sum = 0;
    const hours = [];

    for (let j = 0; j < 3; j++) {
      const h = hourly[i + j];
      const ts = getTs(h);

      const adjusted = applyModeAdjustments({
        temp: h.temperatureF,
        humidity: h.relative_humidity,
        wind: h.wind_speed,
        clouds: h.cloudcover
      }, mode);

      const c = calculateComfort(adjusted, { isDay });

      const score = c?.score ?? 0;

      hours.push({
        hourLabel: new Date(ts).toLocaleTimeString([], { hour: "numeric" }),
        score
      });

      sum += score;
    }

    const avg = sum / 3;

    if (!best || avg > best.avgScore) {
      best = { avgScore: avg, hours };
    }
  }

  return best;
}

// ============================================================
// MAIN ENTRY
// ============================================================
export async function renderWeather(config) {

  const mode = config.mode || "downtown";
  const isDay = true; // (you can refine later)

  let raw;

  // ------------------------------------------------------------
  // FETCH OR REUSE
  // ------------------------------------------------------------
  if (!config.skipFetch) {
    raw = await fetchAllIntel(config);
  } else {
    raw = config;
  }

  const hourly = normalizeOpenMeteo(raw.hourly);
  hourly.sort((a, b) => a.timestamp - b.timestamp);

  const current = resolveCurrentConditions(raw, hourly);

  renderCurrentObs(current);

  // ------------------------------------------------------------
  // COMFORT NOW
  // ------------------------------------------------------------
  renderComfortNow(
    $("comfort-now-container"),
    current,
    findBestComfortWindow(hourly, mode, isDay),
    { mode, isDay }
  );

  // ------------------------------------------------------------
  // FUTURE COMFORT
  // ------------------------------------------------------------
  const now = Date.now();
  const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

  let startIdx = hourly.findIndex(h => getTs(h) >= now);
  if (startIdx === -1) startIdx = hourly.length - 6;
  startIdx = Math.max(0, startIdx - 1);

  const slice = hourly.slice(startIdx, startIdx + 6);

  const future = slice.map(h => {
    const ts = getTs(h);

    const adjusted = applyModeAdjustments({
      temp: h.temperatureF,
      humidity: h.relative_humidity,
      wind: h.wind_speed,
      clouds: h.cloudcover
    }, mode);

    const c = calculateComfort(adjusted, { isDay });

    return {
      hourLabel: new Date(ts).toLocaleTimeString([], { hour: "numeric" }),
      temp: h.temperatureF,
      score: c?.score ?? null,
      goldilocks: c?.goldilocks ?? false
    };
  });

  renderFutureComfort($("future-comfort-container"), future);

  // ------------------------------------------------------------
  // HUMAN ACTION
  // ------------------------------------------------------------
  const intelRaw = buildHumanActionIntel(raw);
  const { today, tomorrow } = generateNarrative(
    intelRaw.today,
    intelRaw.tomorrow
  );

  renderHumanAction(today, tomorrow);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);

  // ------------------------------------------------------------
  // DEBUG
  // ------------------------------------------------------------
  window._raw = raw;
  window._hourly = hourly;
  window._current = current;

  return raw; // 🔥 REQUIRED for app.js caching
}