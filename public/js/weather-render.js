// ============================================================
// WEATHER RENDER — v9 (TIME-AWARE + CLEAN PIPELINE)
// ============================================================

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";
import { calculateComfort } from "./intel/comfort.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js";

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
  // CURRENT CONDITIONS
  // ------------------------------------------------------------
  const current = resolveCurrent(data);
  renderCurrentObs(current);

  // ------------------------------------------------------------
  // COMFORT NOW
  // ------------------------------------------------------------
  const hourNow = new Date().getHours();
  const isDay = hourNow >= 6 && hourNow < 18;

  renderComfortNow(
    $("comfort-now-container"),
    current,
    findBestWindow(hourly),
    { mode, isDay }
  );

  // ------------------------------------------------------------
  // FUTURE COMFORT (NEXT 6 HOURS)
  // ------------------------------------------------------------
  const future = buildFutureSlice(hourly, isDay);
  renderFutureComfort($("future-comfort-container"), future);

  // ------------------------------------------------------------
  // 🔥 HUMAN ACTION (NEW SYSTEM — NO OVERRIDE)
  // ------------------------------------------------------------
  const intel = buildHumanActionIntel({
    ...data,
    hourly
  });

  // 🔥 DIRECT PASS (no generateNarrative)
  renderHumanAction(intel.today, intel.tomorrow);

  // 🔥 EXPANDED (accordion uses full data)
  renderHumanActionExpanded(intel.today, intel.tomorrow);
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
// CURRENT CONDITIONS
// ============================================================

function resolveCurrent(data) {
  const obs = data.current;

  if (!obs) return null;

  return {
    temp: obs.temp ?? null,
    dewPoint: obs.dew_point ?? null,
    humidity: obs.humidity ?? null,
    wind: obs.wind ?? 0,
    timestamp: obs.ts ?? null
  };
}

// ------------------------------------------------------------
// CURRENT OBS RENDER
// ------------------------------------------------------------

function renderCurrentObs(current) {
  const el = $("current-obs-inline");
  if (!el) return;

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
// FUTURE (NEXT 6 HOURS)
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
      dewpointF: h.dewpointF,
      windSpeed: h.wind_speed,
      obsTimeLocal: h.timestamp
    });

    return {
      hourLabel: new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" }),
      temp: h.temperatureF,
      score: c?.score ?? null
    };
  });
}

// ============================================================
// BEST WINDOW (USED BY COMFORT NOW)
// ============================================================

function findBestWindow(hourly) {
  let best = null;

  for (let i = 0; i < hourly.length - 2; i++) {
    let sum = 0;

    for (let j = 0; j < 3; j++) {
      const h = hourly[i + j];

      const c = calculateComfort({
        temp: h.temperatureF,
        dewpointF: h.dewpointF,
        windSpeed: h.wind_speed,
        obsTimeLocal: h.timestamp
      });

      sum += c?.score ?? 0;
    }

    const avg = sum / 3;

    if (!best || avg > best.score) {
      best = {
        score: avg,
        hours: hourly.slice(i, i + 3).map(h => ({
          hourLabel: new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" })
        }))
      };
    }
  }

  return best;
}