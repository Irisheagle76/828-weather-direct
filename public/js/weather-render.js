// /js/weather-render.js
// ============================================================
// UNIFIED RENDERER — Raw Fetch → Human-Action → Comfort
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";

// ============================================================
// COMPATIBILITY LAYER
// ============================================================

function mapToLegacyFields(period) {
  if (!period) return null;

  const narrative = generateNarrative(period);

  console.log("NARRATIVE DEBUG:", narrative);
  console.log("PERIOD DEBUG:", period);

  return {
    // 🔴 spread FIRST
    ...period,

    // ✅ then override with correct UI values
    emoji: narrative?.emoji ?? "🌤️",

    title:
      period?.title ||
      (period?.dominantFactor
        ? period.dominantFactor.replace(/([A-Z])/g, " $1")
        : "Outlook"),

    notes: narrative?.main ?? "",
    secondaryFactors: narrative?.bullets ?? []
  };
}

// ============================================================
// MAIN ENTRY
// ============================================================

export async function renderWeather({
  lat,
  lon,
  tempestDeviceId,
  tempestToken
}) {
  // ✅ ENSURE DOM IS READY
  const todayEmojiEl = document.getElementById("today-emoji");
  const todayHeadlineEl = document.getElementById("today-headline");
  const todayTextEl = document.getElementById("today-text");
  const todayBulletsEl = document.getElementById("today-bullets");

  const tomorrowEmojiEl = document.getElementById("tomorrow-emoji");
  const tomorrowHeadlineEl = document.getElementById("tomorrow-headline");
  const tomorrowTextEl = document.getElementById("tomorrow-text");
  const tomorrowBulletsEl = document.getElementById("tomorrow-bullets");

  const comfortNowEl = document.getElementById("comfort-now-container");
  const futureComfortEl = document.getElementById("future-comfort-container");
  const updatedEl = document.getElementById("last-updated");

  console.log("DOM CHECK:", {
    todayEmojiEl,
    todayHeadlineEl,
    todayTextEl
  });

  // ----------------------------------------------------------
  // 1. FETCH
  // ----------------------------------------------------------
  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  // ----------------------------------------------------------
  // 2. INTEL
  // ----------------------------------------------------------
  const humanActionRaw = buildHumanActionIntel(raw);

  const humanAction = {
    today: mapToLegacyFields(humanActionRaw.today),
    tomorrow: mapToLegacyFields(humanActionRaw.tomorrow)
  };

  console.log("RAW INTEL:", raw);
  console.log("HUMAN ACTION INTEL:", humanAction);

  // ----------------------------------------------------------
  // 3. COMFORT
  // ----------------------------------------------------------
  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly,
    sky: null,
    futureComfortWindow: null
  });

  const futureComfort = buildFutureComfort(raw.hourly, computeComfort);

  // ----------------------------------------------------------
  // 4. RENDER TODAY
  // ----------------------------------------------------------
  if (humanAction.today && todayEmojiEl) {
    todayEmojiEl.textContent = humanAction.today.emoji;
    todayHeadlineEl.textContent = humanAction.today.title;
    todayTextEl.textContent = humanAction.today.notes;

    todayBulletsEl.innerHTML = (humanAction.today.secondaryFactors || [])
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  // ----------------------------------------------------------
  // 5. RENDER TOMORROW
  // ----------------------------------------------------------
  if (humanAction.tomorrow && tomorrowEmojiEl) {
    tomorrowEmojiEl.textContent = humanAction.tomorrow.emoji;
    tomorrowHeadlineEl.textContent = humanAction.tomorrow.title;
    tomorrowTextEl.textContent = humanAction.tomorrow.notes;

    tomorrowBulletsEl.innerHTML = (humanAction.tomorrow.secondaryFactors || [])
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  // ----------------------------------------------------------
  // 6. COMFORT NOW
  // ----------------------------------------------------------
  if (comfortNowEl && comfortNow) {
    comfortNowEl.innerHTML = `
      <div class="comfort-now-card" style="border-left: 6px solid ${comfortNow.color}">
        <div class="comfort-now-emoji">${comfortNow.emoji}</div>
        <div class="comfort-now-score">${comfortNow.comfortScore}</div>
        <div class="comfort-now-label">${comfortNow.label}</div>
        <div class="comfort-now-line1">${comfortNow.line1}</div>
        <div class="comfort-now-line2">${comfortNow.line2}</div>
      </div>
    `;
  }

  // ----------------------------------------------------------
  // 7. FUTURE COMFORT
  // ----------------------------------------------------------
  if (futureComfortEl && futureComfort) {
    futureComfortEl.innerHTML = futureComfort
      .map(item => `
        <div class="future-comfort-item" style="border-left: 4px solid ${item.color}">
          <div class="fc-hour">${item.hourLabel}</div>
          <div class="fc-emoji">${item.emoji}</div>
          <div class="fc-score">${item.comfortScore}</div>
          <div class="fc-temp">${item.temp}°</div>
        </div>
      `)
      .join("");
  }

  // ----------------------------------------------------------
  // 8. TIMESTAMP
  // ----------------------------------------------------------
  if (updatedEl) {
    updatedEl.textContent = new Date(raw.meta.fetchedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }
}