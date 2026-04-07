// ============================================================
// WEATHER RENDER — v8 (TEMPEST-CORRECT + TIME-AWARE)
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";
import { calculateComfort } from "./intel/comfort.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js";
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
const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

// ------------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------------
const fmt = v => (v != null ? Math.round(v) + "°" : "--");
const pct = v => (v != null ? Math.round(v) + "%" : "--");
const windFmt = v => (v != null ? Math.round(v) + " mph" : "--");

// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------
export function renderWeather({ data, isLoading, mode = "downtown" }) {

  if (isLoading) {
    setLoadingUI();
    return;
  }

  if (!data) {
    setUnavailableUI();
    return;
  }

  // ------------------------------------------------------------
  // NORMALIZE HOURLY
  // ------------------------------------------------------------
  let hourly = normalizeOpenMeteo(data.hourly);
  hourly.sort((a, b) => a.timestamp - b.timestamp);

  // ------------------------------------------------------------
  // CURRENT CONDITIONS (FIXED)
  // ------------------------------------------------------------
  const current = resolveCurrent(data, hourly);
  renderCurrentObs(current);

  // ------------------------------------------------------------
  // COMFORT NOW
  // ------------------------------------------------------------
  const hourNow = new Date().getHours();
  const isDay = hourNow >= 6 && hourNow < 18;

  renderComfortNow(
    $("comfort-now-container"),
    current,
    findBestWindow(hourly, mode, isDay),
    { mode, isDay }
  );

  // ------------------------------------------------------------
  // FUTURE COMFORT (FIXED TIME ALIGNMENT)
  // ------------------------------------------------------------
  const future = buildFutureSlice(hourly, isDay);
  renderFutureComfort($("future-comfort-container"), future);

  // ------------------------------------------------------------
  // HUMAN ACTION
  // ------------------------------------------------------------
  const intelRaw = buildHumanActionIntel({
    ...data,
    hourly
  });

  const { today, tomorrow } = generateNarrative(
    intelRaw.today,
    intelRaw.tomorrow
  );

  renderHumanAction(today, tomorrow);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);
}

// ============================================================
// UI STATES
// ============================================================

function setLoadingUI() {
  setText("comfort-now-container", "Loading comfort…");
  setText("future-comfort-container", "Loading forecast…");
  setText("current-obs-inline", "Loading observations…");
}

function setUnavailableUI() {
  setText("comfort-now-container", "Unavailable");
  setText("future-comfort-container", "Unavailable");
  setText("current-obs-inline", "Observations unavailable");
}

function setText(id, text) {
  const el = $(id);
  if (el) el.innerHTML = text;
}

// ============================================================
// CURRENT CONDITIONS (TEMPEST-FIRST, FULLY FIXED)
// ============================================================

function resolveCurrent(data, hourly) {
  if (!hourly?.length) return null;

  const fallback = hourly[0];

  // 🔥 Correct priority order
  const obs =
    data.current ||        // ✅ NEW (Tempest)
    data.tempest ||        // legacy
    data.wu?.current ||    // legacy
    null;

  return {
    temp:
      obs?.temp ??
      obs?.air_temperature ??
      fallback.temperatureF ??
      null,

    dewPoint:
      obs?.dew_point ??
      fallback.dewpointF ??
      null,

    humidity:
      obs?.humidity ??
      obs?.relative_humidity ??
      fallback.relative_humidity ??
      null,

    wind:
      obs?.wind ??
      obs?.wind_avg ??
      fallback.wind_speed ??
      0,

    timestamp:
      obs?.ts ??
      obs?.timestamp ??
      fallback.timestamp
  };
}

// ------------------------------------------------------------
// CURRENT OBS RENDER
// ------------------------------------------------------------
function renderCurrentObs(current) {
  const el = $("current-obs-inline");
  if (!el) return;

console.log("CURRENT DEBUG:", current);

  if (!current || current.temp == null) {
    el.innerHTML = "Observations unavailable";
    return;
  }

  el.innerHTML = `
    <div class="obs-row">
      <div class="obs-item">🌡️ ${fmt(current.temp)}</div>
      <div class="obs-item">💧 ${fmt(current.dewPoint)}</div>
      <div class="obs-item">💦 ${pct(current.humidity)}</div>
      <div class="obs-item">💨 ${windFmt(current.wind)}</div>
    </div>
  `;
}

// ============================================================
// FUTURE (TIME-ALIGNED FIX)
// ============================================================

function buildFutureSlice(hourly, isDay) {
  const now = Date.now();

  const startIndex = hourly.findIndex(h => getTs(h) >= now);

  const slice =
    startIndex === -1
      ? hourly.slice(0, 6)
      : hourly.slice(startIndex, startIndex + 6);

  return slice.map(h => {
    const c = calculateComfort({
      temp: h.temperatureF,
      humidity: h.relative_humidity,
      wind: h.wind_speed,
      clouds: h.cloud_cover
    }, { isDay });

    return {
      hourLabel: new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" }),
      temp: h.temperatureF,
      score: c?.score ?? null
    };
  });
}

// ============================================================
// BEST WINDOW (UNCHANGED)
// ============================================================

function findBestWindow(hourly, mode, isDay) {
  let best = null;

  for (let i = 0; i < hourly.length - 2; i++) {
    let sum = 0;

    for (let j = 0; j < 3; j++) {
      const h = hourly[i + j];

      const c = calculateComfort({
        temp: h.temperatureF,
        humidity: h.relative_humidity,
        wind: h.wind_speed,
        clouds: h.cloud_cover
      }, { isDay });

      sum += c?.score ?? 0;
    }

    const avg = sum / 3;

    if (!best || avg > best) best = avg;
  }

  return best;
}