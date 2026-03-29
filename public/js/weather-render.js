// /js/weather-render.js
// ============================================================
// FINAL RENDERER — CLEAN + FIXED
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";
import { normalizeOpenMeteo } from "./normalize-hourly.js";

// ============================================================
// HELPERS
// ============================================================

const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);

// ============================================================
// CURRENT OBSERVATIONS
// ============================================================

function renderCurrentObservations(raw) {
  const t = raw?.tempest;
  const wu = raw?.wu;
  const h = raw?.hourly;

  const current = {
    temp:
      (t?.air_temperature != null ? cToF(t.air_temperature) : null) ??
      wu?.imperial?.temp ??
      h?.temperature_2m?.[0],

    feels:
      (t?.feels_like != null ? cToF(t.feels_like) : null) ??
      wu?.imperial?.heatIndex ??
      wu?.imperial?.windChill ??
      h?.apparent_temperature?.[0],

    dew:
      (t?.dew_point != null ? cToF(t.dew_point) : null) ??
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
      h?.wind_gusts_10m?.[0], // ✅ fixed

    uv:
      wu?.uv ??
      h?.uv_index?.[0] ??
      0
  };

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el && val != null && !isNaN(val)) el.textContent = val;
  };

  set("wu-temp", `${Math.round(current.temp)}°`);
  set("wu-feels", `Feels like ${Math.round(current.feels ?? current.temp)}°`);

  set("wu-dew", `${Math.round(current.dew ?? 0)}°`);
  set("wu-humidity", `Humidity ${Math.round(current.humidity ?? 0)}%`);

  set("wu-wind", `${Math.round(current.wind ?? 0)} mph`);
  set("wu-wind-gust", `Gusts ${Math.round(current.gust ?? 0)} mph`);

  set("wu-uv", `${Math.round(current.uv ?? 0)}`);
}

// ============================================================
// DATA SOURCE INDICATOR
// ============================================================

function updateDataSourceIndicator(raw) {
  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");
  const dot = document.getElementById("wu-status-dot");

  if (!label || !text || !dot) return;

  if (raw.tempest) {
    label.textContent = "Tempest Live";
    text.textContent = "Real-time station data";
    dot.classList.add("ok");
    dot.classList.remove("error");
    return;
  }

  if (raw.wu) {
    label.textContent = "Nearby Station";
    text.textContent = "Using local weather station";
    dot.classList.add("ok");
    dot.classList.remove("error");
    return;
  }

  label.textContent = "Model Data";
  text.textContent = "Using forecast model";
  dot.classList.add("error");
  dot.classList.remove("ok");
}

// ============================================================
// MAP ENGINE → UI
// ============================================================

function mapToLegacyFields(period) {
  if (!period) return null;

  const narrative = generateNarrative(period);

  return {
    ...period,
    emoji: narrative?.emoji ?? "🌤️",
    title: narrative?.title ?? "Outlook",
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
  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  // --- TOP BLOCK ---
  updateDataSourceIndicator(raw);
  renderCurrentObservations(raw);

  // --- HUMAN ACTION ---
  const intelRaw = buildHumanActionIntel(raw);

  const today = mapToLegacyFields(intelRaw.today);
  const tomorrow = mapToLegacyFields(intelRaw.tomorrow);

  const todayEmoji = document.getElementById("today-emoji");
  const todayHeadline = document.getElementById("today-headline");
  const todayText = document.getElementById("today-text");
  const todayBullets = document.getElementById("today-bullets");

  const tomorrowEmoji = document.getElementById("tomorrow-emoji");
  const tomorrowHeadline = document.getElementById("tomorrow-headline");
  const tomorrowText = document.getElementById("tomorrow-text");
  const tomorrowBullets = document.getElementById("tomorrow-bullets");

  if (today && todayEmoji) {
    todayEmoji.textContent = today.emoji;
    todayHeadline.textContent = today.title;
    todayText.textContent = today.notes;
    todayBullets.innerHTML = (today.secondaryFactors || [])
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  if (tomorrow && tomorrowEmoji) {
    tomorrowEmoji.textContent = tomorrow.emoji;
    tomorrowHeadline.textContent = tomorrow.title;
    tomorrowText.textContent = tomorrow.notes;
    tomorrowBullets.innerHTML = (tomorrow.secondaryFactors || [])
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  // --- COMFORT ---
  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly
  });

  // ✅ FIX: normalize before using
  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);

  const futureComfort = buildFutureComfort(
    hourlyNormalized,
    computeComfort
  );

  const comfortNowEl = document.getElementById("comfort-now-container");
  const futureComfortEl = document.getElementById("future-comfort-container");

  if (comfortNowEl && comfortNow) {
    comfortNowEl.innerHTML = `
      <div style="border-left: 6px solid ${comfortNow.color}">
        <div>${comfortNow.emoji}</div>
        <div>${comfortNow.comfortScore}</div>
        <div>${comfortNow.label}</div>
      </div>
    `;
  }

  if (futureComfortEl && futureComfort) {
    futureComfortEl.innerHTML = futureComfort
      .map(c => `<div>${c.hourLabel} ${c.temp}°</div>`)
      .join("");
  }
}