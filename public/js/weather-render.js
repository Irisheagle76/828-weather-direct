// /js/weather-render.js
// ============================================================
// FINAL RENDERER — MODERNIZED TO MATCH CSS MODULES
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";

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

  const temp =
    (t?.air_temperature != null ? cToF(t.air_temperature) : null) ??
    wu?.imperial?.temp ??
    h?.temperature_2m?.[0];

  const feels =
    (t?.feels_like != null ? cToF(t.feels_like) : null) ??
    wu?.imperial?.heatIndex ??
    wu?.imperial?.windChill ??
    h?.apparent_temperature?.[0];

  const dew =
    (t?.dew_point != null ? cToF(t.dew_point) : null) ??
    wu?.imperial?.dewpt ??
    h?.dewpoint_2m?.[0];

  const humidity =
    t?.relative_humidity ??
    wu?.humidity ??
    h?.relativehumidity_2m?.[0];

  const wind =
    t?.wind_avg ??
    wu?.imperial?.windSpeed ??
    h?.wind_speed_10m?.[0];

  const gust =
    t?.wind_gust ??
    wu?.imperial?.windGust ??
    h?.wind_gusts_10m?.[0];

  const uv =
    wu?.uv ??
    h?.uv_index?.[0] ??
    0;

  document.getElementById("wu-temp").textContent =
    temp != null ? `${Math.round(temp)}°` : "--";

  document.getElementById("wu-feels").textContent =
    feels != null ? `Feels like ${Math.round(feels)}°` : "Feels like --";

  document.getElementById("wu-dew").textContent =
    dew != null ? `${Math.round(dew)}°` : "--";

  document.getElementById("wu-humidity").textContent =
    humidity != null ? `Humidity ${Math.round(humidity)}%` : "Humidity --";

  document.getElementById("wu-wind").textContent =
    wind != null ? `${Math.round(wind)} mph` : "--";

  document.getElementById("wu-wind-gust").textContent =
    gust != null ? `Gusts ${Math.round(gust)} mph` : "Gusts --";

  document.getElementById("wu-uv").textContent =
    uv != null ? `${Math.round(uv)}` : "--";
}

// ============================================================
// DATA SOURCE INDICATOR
// ============================================================

function updateDataSourceIndicator(raw) {
  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");
  const dot = document.getElementById("wu-status-dot");

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
// HUMAN-ACTION RENDERING
// ============================================================

function renderHumanAction(today, tomorrow) {
  const todayEmoji = document.getElementById("today-emoji");
  const todayHeadline = document.getElementById("today-headline");
  const todayText = document.getElementById("today-text");
  const todayBullets = document.getElementById("today-bullets");

  const tomorrowEmoji = document.getElementById("tomorrow-emoji");
  const tomorrowHeadline = document.getElementById("tomorrow-headline");
  const tomorrowText = document.getElementById("tomorrow-text");
  const tomorrowBullets = document.getElementById("tomorrow-bullets");

  if (today) {
    todayEmoji.textContent = today.emoji;
    todayHeadline.textContent = today.title;
    todayText.textContent = today.notes;

    todayBullets.innerHTML = today.secondaryFactors
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  if (tomorrow) {
    tomorrowEmoji.textContent = tomorrow.emoji;
    tomorrowHeadline.textContent = tomorrow.title;
    tomorrowText.textContent = tomorrow.notes;

    tomorrowBullets.innerHTML = tomorrow.secondaryFactors
      .map(b => `<li>${b}</li>`)
      .join("");
  }
}

// ============================================================
// COMFORT MODULE RENDERING
// ============================================================

function renderComfortNow(container, comfort) {
  container.innerHTML = `
    <div class="comfort-module fade-in">
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>
          <div class="comfort-text">${comfort.label}</div>
          <div class="comfort-sub">${comfort.comfortScore} / 100</div>
        </div>
      </div>

      <div class="comfort-expand">
        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Feels Like</span>
          <span class="comfort-expand-value">${Math.round(comfort.feelsLike)}°</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Humidity</span>
          <span class="comfort-expand-value">${comfort.humidity ?? "--"}%</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Wind</span>
          <span class="comfort-expand-value">${comfort.wind ?? "--"} mph</span>
        </div>
      </div>
    </div>
  `;
}

function renderFutureComfort(container, items) {
  container.innerHTML = `
    <div class="next6-module fade-in">
      <div class="next6-header">
        <div class="next6-label">Next 6 Hours</div>
      </div>

      <div class="next6-strip">
        ${items
          .map(
            h => `
          <div class="next6-hour">
            <div class="next6-hour-label">${h.hourLabel}</div>
            <div class="next6-hour-emoji">${h.emoji}</div>
            <div class="next6-hour-temp">${h.temp}°</div>
            <div class="next6-hour-factor">${h.label}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ============================================================
// ACCORDION — ONE MODULE OPEN AT A TIME (SAFE VERSION)
// ============================================================

function initializeAccordion() {
  // Remove any old listeners by cloning nodes
  const modules = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  modules.forEach(module => {
    const clone = module.cloneNode(true);
    module.parentNode.replaceChild(clone, module);
  });

  // Re-select fresh nodes
  const freshModules = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  freshModules.forEach(module => {
    module.addEventListener("click", () => {
      const isActive = module.classList.contains("active");

      // Close all modules
      freshModules.forEach(m => m.classList.remove("active"));

      // Re-open clicked module
      if (!isActive) {
        module.classList.add("active");
      }
    });
  });
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

  updateDataSourceIndicator(raw);
  renderCurrentObservations(raw);

  const intelRaw = buildHumanActionIntel(raw);
  const today = mapToLegacyFields(intelRaw.today);
  const tomorrow = mapToLegacyFields(intelRaw.tomorrow);

  renderHumanAction(today, tomorrow);

  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly
  });

  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);
  const futureComfort = buildFutureComfort(hourlyNormalized, computeComfort);

  const comfortNowEl = document.getElementById("comfort-now-container");
  const futureComfortEl = document.getElementById("future-comfort-container");

  if (comfortNowEl) renderComfortNow(comfortNowEl, comfortNow);
  if (futureComfortEl) renderFutureComfort(futureComfortEl, futureComfort);

  // Initialize accordion AFTER rendering
  initializeAccordion();
}