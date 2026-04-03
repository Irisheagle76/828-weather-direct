// /js/weather-render.js

// ============================================================
// IMPORTS
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";
import { computeComfort } from "./intel/comfort.js";
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
// CURRENT CONDITIONS (clean + minimal)
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
    windSpeed:
      raw.tempest?.wind_avg != null
        ? raw.tempest.wind_avg * 2.23694
        : fallback.wind_speed ?? 0,
    windGust:
      raw.tempest?.wind_gust != null
        ? raw.tempest.wind_gust * 2.23694
        : fallback.wind_gust ?? null,
    windDir: raw.tempest?.wind_direction ?? fallback.wind_dir ?? "",
    uv: raw.tempest?.uv ?? fallback.uv_index ?? 0,
    obsTimeLocal: raw.tempest?.timestamp ?? fallback.timestamp ?? Date.now()
  };
}
// ------------------------------------------------------------
// Render Current Obs
// ------------------------------------------------------------
function renderCurrentObs(current) {
  const el = document.getElementById("current-conditions");
  if (!el || !current) return;

  el.innerHTML = `
    <div class="obs-row">
      🌡️ ${fmt(current.temp)}
      • 💧 Dew ${fmt(current.dewPoint)}
      • 💦 ${pct(current.humidity)}
      • 💨 ${wind(current.windSpeed)}
      ${current.windGust ? `• Gusts ${Math.round(current.windGust)} mph` : ""}
      • ☀️ UV ${current.uv != null ? current.uv.toFixed(1) : "--"}
    </div>
  `;
}
// ------------------------------------------------------------
// Render Current Obs Helpers
// ------------------------------------------------------------
function fmt(v) {
  return v != null ? Math.round(v) + "°" : "--";
}

function pct(v) {
  return v != null ? Math.round(v) + "%" : "--";
}

function wind(v) {
  return v != null ? Math.round(v) + " mph" : "--";
}
// ------------------------------------------------------------
// SAFE COMFORT WRAPPER
// ------------------------------------------------------------

function computeComfortSafe(current) {
  if (!current) return null;

  let dew = current.dewPoint;

  if (dew == null && current.temp != null) {
    dew = current.temp - 20;
  }

  return computeComfort({
    wu: {
      temp: current.temp,
      dewPoint: dew,
      windSpeed: current.windSpeed ?? 0,
      windDir: current.windDir ?? "",
      humidity: current.humidity ?? null,
      uv: current.uv ?? null,
      obsTimeLocal: current.obsTimeLocal ?? Date.now()
    }
  });
}

// ------------------------------------------------------------
// BEST WINDOW (leave logic as-is)
// ------------------------------------------------------------

function findBestComfortWindow(hourly, windowSize = 3) {
  if (!Array.isArray(hourly) || hourly.length < windowSize) return null;

  const now = Date.now();
  const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

  let startIndex = hourly.findIndex(h => getTs(h) >= now);
  if (startIndex === -1) startIndex = hourly.length - windowSize;

  let best = null;

  for (let start = startIndex; start <= hourly.length - windowSize; start++) {
    let sum = 0;
    const hours = [];

    for (let i = 0; i < windowSize; i++) {
      const h = hourly[start + i];
      const ts = getTs(h);

      const c = computeComfortSafe({
        temp: h.temperatureF,
        dewPoint: h.dewpointF,
        humidity: h.relative_humidity,
        windSpeed: h.wind_speed,
        windDir: h.wind_dir,
        obsTimeLocal: ts
      });

      const score = c?.comfortScore ?? 0;

      hours.push({
        hourLabel: new Date(ts).toLocaleTimeString([], { hour: "numeric" }),
        temp: h.temperatureF,
        comfortScore: score,
        emoji: c?.emoji,
        label: c?.category
      });

      sum += score;
    }

    const avg = sum / windowSize;

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
  const raw = await fetchAllIntel(config);

  const hourly = normalizeOpenMeteo(raw.hourly);
  hourly.sort((a, b) => a.timestamp - b.timestamp);

  const current = resolveCurrentConditions(raw, hourly);
const current = resolve
  // ------------------------------------------------------------
  // COMFORT
  // ------------------------------------------------------------

  const comfort = computeComfortSafe(current);

  const comfortForRender = comfort
    ? {
        ...comfort,
        bullets: [], // (we'll improve later)
      }
    : null;

  const bestWindow = findBestComfortWindow(hourly);

  if (comfortForRender) {
    renderComfortNow($("comfort-now-container"), comfortForRender, bestWindow);
  }

  // ------------------------------------------------------------
  // FUTURE COMFORT
  // ------------------------------------------------------------

  const future = hourly.slice(0, 6).map(h => ({
    hourLabel: new Date(h.timestamp).toLocaleTimeString([], { hour: "numeric" }),
    temp: h.temperatureF,
    emoji: "—",
    label: ""
  }));

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
  // DEBUG (optional)
  // ------------------------------------------------------------

  window._raw = raw;
  window._hourly = hourly;
  window._current = current;
}