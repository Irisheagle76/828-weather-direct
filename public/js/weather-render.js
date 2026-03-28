// /js/weather-render.js
// ============================================================
// UNIFIED RENDERER — Raw Fetch → Human‑Action → Comfort
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./synthesizer.js";

// DOM targets
const todayEl = document.getElementById("today-outlook");
const tomorrowEl = document.getElementById("tomorrow-outlook");
const updatedEl = document.getElementById("last-updated");

const comfortNowEl = document.getElementById("comfort-now-container");
const futureComfortEl = document.getElementById("future-comfort-container");

// ============================================================
// MAIN ENTRY — called by app.js
// ============================================================

export async function renderWeather({ lat, lon, tempestDeviceId, tempestToken }) {
  // 1. RAW INTEL
  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  // 2. HUMAN‑ACTION INTEL (Today + Tomorrow)
  const humanAction = buildHumanActionIntel(raw);

  // 3. COMFORT NOW (Tempest-first)
  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly,
    sky: null,
    futureComfortWindow: null
  });

  // 4. FUTURE COMFORT (next 6 hours)
  const futureComfort = buildFutureComfort(raw.hourly, computeComfort);

  // 5. RENDER ALL MODULES
  renderToday(humanAction.today);
  renderTomorrow(humanAction.tomorrow);
  renderComfortNow(comfortNow);
  renderFutureComfortList(futureComfort);

  // 6. TIMESTAMP
  updatedEl.textContent = formatTimestamp(raw.meta.fetchedAt);
}

// ============================================================
// TODAY / TOMORROW
// ============================================================

function renderToday(intel) {
  const narrative = generateNarrative(intel);
  renderOutlook(todayEl, intel, narrative);
}

function renderTomorrow(intel) {
  const narrative = generateNarrative(intel);
  renderOutlook(tomorrowEl, intel, narrative);
}

function renderOutlook(container, intel, narrative) {
  container.innerHTML = `
    <div class="ha-headline">
      <span class="ha-emoji">${intel.emoji}</span>
      <span class="ha-title">${intel.title}</span>
    </div>

    <div class="ha-main-text">
      ${narrative.main}
    </div>

    <ul class="ha-bullets">
      ${narrative.bullets.map(b => `<li>${b}</li>`).join("")}
    </ul>
  `;
}

// ============================================================
// COMFORT NOW
// ============================================================

function renderComfortNow(c) {
  if (!comfortNowEl) return;

  comfortNowEl.innerHTML = `
    <div class="comfort-now-card" style="border-left: 6px solid ${c.color}">
      <div class="comfort-now-emoji">${c.emoji}</div>
      <div class="comfort-now-score">${c.comfortScore}</div>
      <div class="comfort-now-label">${c.label}</div>
      <div class="comfort-now-line1">${c.line1}</div>
      <div class="comfort-now-line2">${c.line2}</div>
    </div>
  `;
}

// ============================================================
// FUTURE COMFORT (6-hour list)
// ============================================================

function renderFutureComfortList(list) {
  if (!futureComfortEl) return;

  futureComfortEl.innerHTML = list
    .map(item => {
      return `
        <div class="future-comfort-item" style="border-left: 4px solid ${item.color}">
          <div class="fc-hour">${item.hourLabel}</div>
          <div class="fc-emoji">${item.emoji}</div>
          <div class="fc-score">${item.comfortScore}</div>
          <div class="fc-temp">${item.temp}°</div>
        </div>
      `;
    })
    .join("");
}

// ============================================================
// TIMESTAMP
// ============================================================

function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}