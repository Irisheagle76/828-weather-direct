// /js/weather-render.js
// ============================================================
// FINAL RENDERER — Current + Human Action + Comfort + Source
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";

// ============================================================
// DATA SOURCE INDICATOR
// ============================================================

function updateDataSourceIndicator(raw) {
  const labelEl = document.getElementById("wu-status-label");
  const textEl = document.getElementById("wu-status-text");
  const dot = document.getElementById("wu-status-dot");

  if (!labelEl || !textEl || !dot) return;

  if (raw.tempest) {
    labelEl.textContent = "Tempest Live";
    textEl.textContent = "Real-time data from your Tempest station.";
    dot.classList.add("ok");
    dot.classList.remove("error");
    return;
  }

  if (raw.wu) {
    labelEl.textContent = "Nearby Station";
    textEl.textContent = "Using nearby personal weather station.";
    dot.classList.add("ok");
    dot.classList.remove("error");
    return;
  }

  labelEl.textContent = "Model Data";
  textEl.textContent = "Using forecast model data.";
  dot.classList.add("error");
  dot.classList.remove("ok");
}

// ============================================================
// CURRENT OBSERVATIONS
// ============================================================

function renderCurrentObservations(raw) {
  if (!raw) return;

  const t = raw.tempest;
  const wu = raw.wu;
  const h = raw.hourly;

  const current = {
    temp: t?.air_temperature ?? wu?.imperial?.temp ?? h?.temperature_2m?.[0],
    feels:
      t?.feels_like ??
      wu?.imperial?.heatIndex ??
      wu?.imperial?.windChill ??
      h?.apparent_temperature?.[0],
    dew: t?.dew_point ?? wu?.imperial?.dewpt ?? h?.dewpoint_2m?.[0],
    humidity:
      t?.relative_humidity ?? wu?.humidity ?? h?.relativehumidity_2m?.[0],
    wind: t?.wind_avg ?? wu?.imperial?.windSpeed ?? h?.wind_speed_10m?.[0],
    gust: t?.wind_gust ?? wu?.imperial?.windGust ?? h?.windgusts_10m?.[0],
    uv: wu?.uv ?? h?.uv_index?.[0] ?? 0
  };

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
// MAP ENGINE → UI
// ============================================================

function mapToLegacyFields(period) {
  if (!period) return null;

  const narrative = generateNarrative(period);

  return {
    ...period,
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
  // DOM
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

  // FETCH
  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  console.log("RAW:", raw);

  // 🔥 NEW: SOURCE + CURRENT
  updateDataSourceIndicator(raw);
  renderCurrentObservations(raw);

  // HUMAN ACTION
  const humanRaw = buildHumanActionIntel(raw);

  const human = {
    today: mapToLegacyFields(humanRaw.today),
    tomorrow: mapToLegacyFields(humanRaw.tomorrow)
  };

  // COMFORT
  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly
  });

  const futureComfort = buildFutureComfort(raw.hourly, computeComfort);

  // TODAY
  if (human.today && todayEmojiEl) {
    todayEmojiEl.textContent = human.today.emoji;
    todayHeadlineEl.textContent = human.today.title;
    todayTextEl.textContent = human.today.notes;

    todayBulletsEl.innerHTML = (human.today.secondaryFactors || [])
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  // TOMORROW
  if (human.tomorrow && tomorrowEmojiEl) {
    tomorrowEmojiEl.textContent = human.tomorrow.emoji;
    tomorrowHeadlineEl.textContent = human.tomorrow.title;
    tomorrowTextEl.textContent = human.tomorrow.notes;

    tomorrowBulletsEl.innerHTML = (human.tomorrow.secondaryFactors || [])
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  // COMFORT NOW
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

  // FUTURE COMFORT
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

  // TIMESTAMP
  if (updatedEl && raw.meta?.fetchedAt) {
    updatedEl.textContent = new Date(raw.meta.fetchedAt).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
  }
}