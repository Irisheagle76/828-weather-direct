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
  const el = document.getElementById("current-obs-inline");
  if (!el || !current) return;

  el.innerHTML = `
    <div class="obs-row">

      <div class="obs-item">
        <span class="obs-emoji">🌡️</span>
        <span class="obs-value">${fmt(current.temp)}</span>
      </div>

      <div class="obs-item">
        <span class="obs-emoji">💧</span>
        <span class="obs-label">Dew</span>
        <span class="obs-value">${fmt(current.dewPoint)}</span>
      </div>

      <div class="obs-item">
        <span class="obs-emoji">💦</span>
        <span class="obs-value">${pct(current.humidity)}</span>
      </div>

      <div class="obs-item">
        <span class="obs-emoji">💨</span>
        <span class="obs-value">${wind(current.windSpeed)}</span>
      </div>

      ${
        current.windGust
          ? `
        <div class="obs-item">
          <span class="obs-label">Gusts</span>
          <span class="obs-value">${Math.round(current.windGust)} mph</span>
        </div>
      `
          : ""
      }

      <div class="obs-item">
        <span class="obs-emoji">☀️</span>
        <span class="obs-label">UV</span>
        <span class="obs-value">
          ${current.uv != null ? current.uv.toFixed(1) : "--"}
        </span>
      </div>

    </div>
  `;
}
// ----------------------------------------------------------
//Render Current Obs Helpers
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
// Future Comfort Helper
// ------------------------------------------------------------
function getComfortEmoji(score) {
  if (score == null) return "—";

  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  if (score >= 50) return "😐";
  if (score >= 35) return "😕";
  return "🥵";
}

function getComfortLabel(score) {
  if (score == null) return "";

  if (score >= 80) return "Great";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 35) return "Poor";
  return "Harsh";
}

function getComfortTrend(items) {
  const scores = items
    .map(i => i.score)
    .filter(s => s != null);

  if (scores.length < 2) return "steady";

  const first = scores[0];
  const last = scores[scores.length - 1];
  const diff = last - first;

  if (diff >= 8) return "improving";
  if (diff <= -8) return "worsening";
  return "steady";
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

console.log("CURRENT:", current);
console.log("ELEMENT:", document.getElementById("current-conditions"));

renderCurrentObs(current);

  // ------------------------------------------------------------
  // COMFORT
  // ------------------------------------------------------------

  const comfort = computeComfortSafe(current);

  const comfortForRender = comfort
    ? {
        ...comfort,
        bullets: buildComfortBullets(current),
      }
    : null;

  const bestWindow = findBestComfortWindow(hourly);

  if (comfortForRender) {
    renderComfortNow($("comfort-now-container"), comfortForRender, bestWindow);
  }
// ------------------------------------------------------------
  // Comfort Bullets
  // ------------------------------------------------------------

function buildComfortBullets(current, score) {
  if (!current) return [];

  const bullets = [];

  const temp = current.temp;
  const dew = current.dewPoint;
  const wind = current.windSpeed;

  // --- primary driver (based on score) ---
  if (score != null) {
    if (score < 40) {
      bullets.push("Conditions are being driven by discomfort factors.");
    } else if (score < 60) {
      bullets.push("Conditions are mixed with some limiting factors.");
    } else {
      bullets.push("Conditions are generally supportive for outdoor activity.");
    }
  }

  // --- humidity ---
  if (dew != null) {
    if (dew >= 65) {
      bullets.push("Humidity is high and adds a sticky feel.");
    } else if (dew >= 55) {
      bullets.push("Humidity is noticeable but not the main issue.");
    }
  }

  // --- wind ---
  if (wind != null) {
    if (wind <= 4) {
      bullets.push("Light winds limit cooling and air movement.");
    } else if (wind >= 12) {
      bullets.push("Breezes provide some relief from warmth.");
    }
  }

  // --- temperature ---
  if (temp != null) {
    if (temp >= 85) {
      bullets.push("Warm temperatures are the main source of discomfort.");
    } else if (temp <= 55) {
      bullets.push("Cool air may feel brisk, especially in shade.");
    }
  }

  return bullets.slice(0, 3);
}

// ------------------------------------------------------------
// FUTURE COMFORT (FIXED — STARTS FROM NOW)
// ------------------------------------------------------------

const now = Date.now();
const getTs = h => (h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp);

// Find current hour index (same logic you already use elsewhere)
let startIdx = hourly.findIndex(h => getTs(h) >= now);
if (startIdx === -1) startIdx = hourly.length - 6;

// Step back one hour so it includes "current hour"
startIdx = Math.max(0, startIdx - 1);

const slice = hourly.slice(startIdx, startIdx + 6);

console.log(
  "🕒 FUTURE HOURS:",
  slice.map(h =>
    new Date(getTs(h)).toLocaleTimeString([], { hour: "numeric" })
  )
);

const future = slice.map(h => {
  const ts = getTs(h);

  const comfort = computeComfortSafe({
    temp: h.temperatureF,
    dewPoint: h.dewpointF,
    humidity: h.relative_humidity,
    windSpeed: h.wind_speed,
    windDir: h.wind_dir,
    obsTimeLocal: ts
  });

  const score = comfort?.comfortScore ?? null;

  return {
    hourLabel: new Date(ts).toLocaleTimeString([], { hour: "numeric" }),
    temp: h.temperatureF,
    score,
    emoji: getComfortEmoji(score),
    label: getComfortLabel(score)
  };
});

const trend = getComfortTrend(future);

renderFutureComfort($("future-comfort-container"), future, trend);

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