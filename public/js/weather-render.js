// /js/weather-render.js
// ============================================================
// UNIFIED RENDERER — Raw Fetch → Current → Human-Action → Comfort
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";

// ============================================================
// CURRENT OBSERVATIONS (Tempest → WU → Hourly fallback)
// ============================================================

function renderCurrentObservations(raw) {
  if (!raw) return;

  const t = raw.tempest;
  const wu = raw.wu;
  const h = raw.hourly;

  const current = {
    temp:
      t?.air_temperature ??
      wu?.imperial?.temp ??
      h?.temperature_2m?.[0],

    feels:
      t?.feels_like ??
      wu?.imperial?.heatIndex ??
      wu?.imperial?.windChill ??
      h?.apparent_temperature?.[0],

    dew:
      t?.dew_point ??
      wu?.imperial?.dewpt ??
      h?.dewpoint_2m?.[0],

    humidity:
      t?.relative_humidity ??
      wu?.humidity ??
      h?.relativehumidity_2m?.[0],

    wind:
      t?.wind_avg ??
      wu?.imperial?.windSpeed ??
      h?.wind_speed_10m?.[0],

    gust:
      t?.wind_gust ??
      wu?.imperial?.windGust ??
      h?.windgusts_10m?.[0],

    uv:
      wu?.uv ??
      h?.uv_index?.[0] ??
      0
  };

  console.log("CURRENT OBS:", current);

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null && !isNaN(val)) el.textContent = val;
  };

  set("wu-temp", `${Math.round(current.temp)}°`);
  set("wu-feels", `Feels like ${Math.round(current.feels ?? current.temp)}°`);

  set("wu-dew", `${Math.round(current.dew)}°`);
  set("wu-humidity", `Humidity ${Math.round(current.humidity)}%`);

  set("wu-wind", `${Math.round(current.wind)} mph`);
  set("wu-wind-gust", `Gusts ${Math.round(current.gust ?? 0)} mph`);

  set("wu-uv", `${Math.round(current.uv ?? 0)}`);
}

// ============================================================
// COMPATIBILITY LAYER (Narrative → UI)
// ============================================================

function mapToLegacyFields(period) {
  if (!period) return null;

  const narrative = generateNarrative(period);

  return {
    ...period, // spread FIRST

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
  // ----------------------------------------------------------
  // DOM (grab at runtime)
  // ----------------------------------------------------------
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

  // ----------------------------------------------------------
  // FETCH
  // ----------------------------------------------------------
  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  console.log("RAW INTEL:", raw);

  // ----------------------------------------------------------
  // CURRENT OBS (THIS WAS MISSING)
  // ----------------------------------------------------------
  renderCurrentObservations(raw);

  // ----------------------------------------------------------
  // HUMAN ACTION
  // ----------------------------------------------------------
  const humanActionRaw = buildHumanActionIntel(raw);

  const humanAction = {
    today: mapToLegacyFields(humanActionRaw.today),
    tomorrow: mapToLegacyFields(humanActionRaw.tomorrow)
  };

  console.log("HUMAN ACTION:", humanAction);

  // ----------------------------------------------------------
  // COMFORT
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
  // TODAY
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
  // TOMORROW
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
  // COMFORT NOW
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
  // FUTURE COMFORT
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
  // TIMESTAMP
  // ----------------------------------------------------------
  if (updatedEl) {
    updatedEl.textContent = new Date(raw.meta.fetchedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }
}