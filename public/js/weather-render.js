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


// ============================================================
// V2 COMPATIBILITY HELPERS (OLD APP SAFETY NET)
// ============================================================

// -----------------------------
// FEELSCORE COLORS
// -----------------------------
function getFeelScoreColor(score) {
  if (score >= 85) return "#50c878";
  if (score >= 70) return "#64b4ff";
  if (score >= 55) return "#ffc864";
  if (score >= 40) return "#ff8c50";
  return "#ff5050";
}

function getFeelScoreBackground(score) {
  if (score >= 85) return "rgba(80, 200, 120, 0.12)";
  if (score >= 70) return "rgba(100, 180, 255, 0.12)";
  if (score >= 55) return "rgba(255, 200, 100, 0.12)";
  if (score >= 40) return "rgba(255, 140, 80, 0.12)";
  return "rgba(255, 80, 80, 0.12)";
}

// -----------------------------
// SCORE LABELS
// -----------------------------
function mapScoreToLabel(score) {
  if (score >= 85) return "Ideal";
  if (score >= 70) return "Comfortable";
  if (score >= 55) return "Slightly Off";
  if (score >= 40) return "Uncomfortable";
  return "Harsh";
}

function mapScoreToCategory(score) {
  if (score >= 85) return "ideal";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "neutral";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

// -----------------------------
// SAFE COMFORT (fallback wrapper)
// -----------------------------
function safeComfortScore(h) {
  try {
    const c = calculateComfort?.(h);
    return Math.round((c?.score || 0) * 10);
  } catch {
    return 50;
  }
}

// -----------------------------
// WEATHER ICON (fallback)
// -----------------------------
function getWeatherEmoji(h) {
  if (!h) return "–";

  const temp = h.temperatureF ?? h.temp ?? 70;
  const rain = h.precipitation ?? 0;

  if (rain > 0.1) return "🌧";
  if (temp > 85) return "☀️";
  if (temp < 40) return "❄️";

  return "⛅";
}

// -----------------------------
// HOUR FORMAT (safe)
// -----------------------------
function formatHour(ts) {
  if (!ts) return "--";

  const d = new Date(ts);
  const h = d.getHours();
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;

  return `${display}${suffix}`;
}

// -----------------------------
// BULLET SAFETY
// -----------------------------
function safeBullets(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 3);
}

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
    temp:
      obs.temperatureF ??
      obs.temp ??
      null,

    dewPoint:
      obs.dewpointF ??
      obs.dew_point ??
      null,

    humidity:
      obs.relative_humidity ??
      obs.humidity ??
      null,

    wind:
      obs.windSpeed ??
      obs.wind ??
      0,

    timestamp:
      obs.timestamp ??
      obs.ts ??
      null
  };
}
// ------------------------------------------------------------
// CURRENT OBS RENDER
// ------------------------------------------------------------

function renderCurrentObs(current) {
  const el = $("wx-metrics");
  if (!el) return;

  if (!current || current.temp == null) {
    el.innerHTML = `<div class="live-badge-chip">LIVE</div>`;
    return;
  }

  const updatedTime = new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  el.innerHTML = `
    <div class="live-badge-chip">LIVE</div>
    <div class="updated-time">Updated ${updatedTime}</div>

    <div class="live-pill">🌡️ ${fmt(current.temp)}</div>
    <div class="live-pill">💧 ${fmt(current.dewPoint)}</div>
    <div class="live-pill">💦 ${pct(current.humidity)}</div>
    <div class="live-pill">💨 ${windFmt(current.wind)}</div>
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
      temp: h.temperatureF ?? h.temp ?? null,
      dewpointF: h.dewpointF ?? h.dew_point ?? null,
      windSpeed: h.windSpeed ?? h.wind_speed ?? 0,
      obsTimeLocal: h.timestamp
    });

    return {
      hourLabel: new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" }),
      temp: h.temperatureF ?? h.temp ?? null,
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