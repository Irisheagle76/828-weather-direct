// /js/weather-render.js
// ============================================================
// UNIFIED RENDERER — Raw Fetch → Human‑Action → Comfort
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";

// TODAY DOM TARGETS
const todayEmojiEl = document.getElementById("today-emoji");
const todayHeadlineEl = document.getElementById("today-headline");
const todayTextEl = document.getElementById("today-text");
const todayBulletsEl = document.getElementById("today-bullets");

// TOMORROW DOM TARGETS
const tomorrowEmojiEl = document.getElementById("tomorrow-emoji");
const tomorrowHeadlineEl = document.getElementById("tomorrow-headline");
const tomorrowTextEl = document.getElementById("tomorrow-text");
const tomorrowBulletsEl = document.getElementById("tomorrow-bullets");

// COMFORT DOM TARGETS
const comfortNowEl = document.getElementById("comfort-now-container");
const futureComfortEl = document.getElementById("future-comfort-container");

// TIMESTAMP
const updatedEl = document.getElementById("last-updated");

// ============================================================
// COMPATIBILITY LAYER — Map Human‑Action 2.0 → Legacy UI fields
// ============================================================

function mapToLegacyFields(period) {
  if (!period) return null;

  return {
    // Legacy UI fields
    emoji: period.sky?.primaryEmoji ?? "—",
    title: period.sky?.headline ?? period.summary ?? "",
    notes: period.narrative ?? "",
    secondaryFactors: period.events?.keyEvents ?? [],

    // Preserve all original fields
    ...period
  };
}

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
  const humanActionRaw = buildHumanActionIntel(raw);

  // Apply compatibility wrapper
  const humanAction = {
    today: mapToLegacyFields(humanActionRaw.today),
    tomorrow: mapToLegacyFields(humanActionRaw.tomorrow)
  };

  // Debug logs
  console.log("RAW INTEL:", raw);
  console.log("HUMAN ACTION INTEL:", humanAction);
  console.log("HOURLY (raw.hourly):", raw.hourly);

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
  if (updatedEl) {
    updatedEl.textContent = formatTimestamp(raw.meta.fetchedAt);
  }
}

// ============================================================
// TODAY RENDERER
// ============================================================

function renderToday(intel) {
  if (!intel) return;

  todayEmojiEl.textContent = intel.emoji ?? "—";
  todayHeadlineEl.textContent = intel.title ?? "Today";
  todayTextEl.textContent = intel.notes ?? "";

  todayBulletsEl.innerHTML = (intel.secondaryFactors ?? [])
    .map(f => `<li>${f}</li>`)
    .join("");
}

// ============================================================
// TOMORROW RENDERER
// ============================================================

function renderTomorrow(intel) {
  if (!intel) return;

  tomorrowEmojiEl.textContent = intel.emoji ?? "—";
  tomorrowHeadlineEl.textContent = intel.title ?? "Tomorrow";
  tomorrowTextEl.textContent = intel.notes ?? "";

  tomorrowBulletsEl.innerHTML = (intel.secondaryFactors ?? [])
    .map(f => `<li>${f}</li>`)
    .join("");
}

// ============================================================
// COMFORT NOW
// ============================================================

function renderComfortNow(c) {
  if (!comfortNowEl || !c) return;

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
  if (!futureComfortEl || !list) return;

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