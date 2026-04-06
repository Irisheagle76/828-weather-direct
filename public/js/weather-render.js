// ============================================================
// WEATHER RENDER — v6 (UNIFIED + CONTRACT-CLEAN)
// One pipeline: fetch → normalize → adjust → compute → render
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
const $ = id => document.getElementById(id);

// ✅ single timestamp helper (used everywhere)
const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

// ------------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------------
const fmt = v => (v != null ? Math.round(v) + "°" : "--");
const pct = v => (v != null ? Math.round(v) + "%" : "--");
const windFmt = v => (v != null ? Math.round(v) + " mph" : "--");

// ------------------------------------------------------------
// DESCRIPTORS
// ------------------------------------------------------------
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
  return "Oppressive";
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
// MODE ADJUSTMENTS (single source of truth)
// ------------------------------------------------------------
function adjustHour(h, mode) {
  const adjusted = { ...h };

  if (mode === "trail") {
    adjusted.temperatureF = (adjusted.temperatureF ?? 0) - 3;
    adjusted.wind_speed = (adjusted.wind_speed ?? 0) * 1.2;
    adjusted.cloud_cover = (adjusted.cloud_cover ?? 0) + 0.1;
  }

  if (mode === "downtown") {
    adjusted.temperatureF = (adjusted.temperatureF ?? 0) + 2;
    adjusted.wind_speed = (adjusted.wind_speed ?? 0) * 0.7;
  }

  return adjusted;
}

// ------------------------------------------------------------
// CURRENT CONDITIONS
// ------------------------------------------------------------
function resolveCurrent(raw, hourly) {
  if (!hourly?.length) return null;

  const now = Date.now();

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
    clouds: fallback.cloud_cover ?? 0,
    timestamp: raw.tempest?.timestamp ?? fallback.timestamp ?? Date.now()
  };
}

// ------------------------------------------------------------
// CURRENT OBS UI
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
        💨 ${windFmt(current.wind)}
        <span class="obs-label">${describeWind(current.wind)}</span>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// BEST 3-HOUR WINDOW
// ------------------------------------------------------------
function findBestWindow(hourly, mode, isDay) {
  let best = null;

  for (let i = 0; i < hourly.length - 2; i++) {
    let sum = 0;
    const hours = [];

    for (let j = 0; j < 3; j++) {
      const h = adjustHour(hourly[i + j], mode);

      const c = calculateComfort({
        temp: h.temperatureF,
        humidity: h.relative_humidity,
        wind: h.wind_speed,
        clouds: h.cloud_cover
      }, { isDay });

      const score = c?.score ?? 0;

      hours.push({
        hourLabel: new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" }),
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

  const hourNow = new Date().getHours();
  const isDay = hourNow >= 6 && hourNow < 18;

  // ------------------------------------------------------------
  // FETCH OR USE CACHE
  // ------------------------------------------------------------
  const raw = config.skipFetch
    ? config.raw
    : await fetchAllIntel(config);

  // ------------------------------------------------------------
  // NORMALIZE + SORT
  // ------------------------------------------------------------
  let hourly = config.skipFetch
    ? config.hourly
    : normalizeOpenMeteo(raw.hourly);

  hourly.sort((a, b) => a.timestamp - b.timestamp);

  // ------------------------------------------------------------
  // APPLY MODE (UNIFIED)
  // ------------------------------------------------------------
  const adjustedHourly = hourly.map(h => adjustHour(h, mode));

  // ------------------------------------------------------------
  // CURRENT CONDITIONS
  // ------------------------------------------------------------
  const current = resolveCurrent(raw, adjustedHourly);
  renderCurrentObs(current);

  // ------------------------------------------------------------
  // COMFORT NOW
  // ------------------------------------------------------------
  renderComfortNow(
    $("comfort-now-container"),
    current,
    findBestWindow(adjustedHourly, mode, isDay),
    { mode, isDay }
  );

  // ------------------------------------------------------------
  // FUTURE COMFORT (6-hour slice)
  // ------------------------------------------------------------
  const now = Date.now();

  let startIdx = adjustedHourly.findIndex(h => getTs(h) >= now);
  if (startIdx === -1) startIdx = adjustedHourly.length - 6;
  startIdx = Math.max(0, startIdx - 1);

  const future = adjustedHourly.slice(startIdx, startIdx + 6).map(h => {
    const c = calculateComfort({
      temp: h.temperatureF,
      humidity: h.relative_humidity,
      wind: h.wind_speed,
      clouds: h.cloud_cover
    }, { isDay });

    return {
      hourLabel: new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" }),
      temp: h.temperatureF,
      score: c?.score ?? null,
      goldilocks: c?.goldilocks ?? false
    };
  });

  renderFutureComfort($("future-comfort-container"), future);

  // ------------------------------------------------------------
  // HUMAN ACTION (NOW MODE-ALIGNED)
  // ------------------------------------------------------------
  const intelRaw = buildHumanActionIntel({
    ...raw,
    hourly: adjustedHourly
  });

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
  window._hourly = adjustedHourly;
  window._current = current;
  window._intel = intelRaw;

  // ------------------------------------------------------------
  // RETURN (CONTRACT CLEAN)
  // ------------------------------------------------------------
  return {
    raw,
    hourly: adjustedHourly,
    current,
    intel: intelRaw
  };
}