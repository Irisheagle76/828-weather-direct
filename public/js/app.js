// ============================================================
// APP ENTRY — v5 (STABLE + CONTRACT-CLEAN)
// Clear separation: fetch → cache → render
// ============================================================

console.log("APP.JS LOADED — v5 CLEAN");

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { renderWeather } from "./weather-render.js";

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const CONFIG = {
  FORCE_LOCATION: true,

  DEFAULT_LAT: 35.5951,
  DEFAULT_LON: -82.5515,

  TEMPEST_STATION_ID: "315255",
  TEMPEST_TOKEN: "838ff386-d14b-4d45-897a-18903e6970a9",

  REFRESH_INTERVAL: 5 * 60 * 1000
};

// ------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------
let currentLocation = {
  lat: CONFIG.DEFAULT_LAT,
  lon: CONFIG.DEFAULT_LON
};

let refreshTimer = null;

// 🔥 CACHE: always store FINAL PAYLOAD ONLY
let lastWeatherData = null;

// 🔥 GLOBAL MODE
window.APP_STATE = window.APP_STATE || {
  mode: "downtown"
};

// ------------------------------------------------------------
// ERROR HANDLING
// ------------------------------------------------------------
function showError(msg) {
  console.error("APP ERROR:", msg);

  const el = document.getElementById("wu-error");
  if (!el) return;

  el.style.display = "block";
  el.textContent = msg;
}

function clearError() {
  const el = document.getElementById("wu-error");
  if (el) el.style.display = "none";
}

// ------------------------------------------------------------
// LOADING / READY STATES
// ------------------------------------------------------------
function setLoadingState() {
  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");

  if (label) label.textContent = "Loading weather…";
  if (text) text.textContent = "Fetching latest conditions…";

  const comfort = document.getElementById("comfort-now-container");
  const future = document.getElementById("future-comfort-container");
  const obs = document.getElementById("current-obs-inline");

  if (comfort) comfort.innerHTML = "Loading comfort…";
  if (future) future.innerHTML = "Loading forecast…";
  if (obs) obs.innerHTML = "Loading observations…";
}

function setReadyState() {
  clearError();

  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");

  if (label) label.textContent = "Live conditions";

  if (text) {
    const now = new Date();
    text.textContent = `Updated ${now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    })}`;
  }
}

// ------------------------------------------------------------
// CORE: FETCH + RENDER
// ------------------------------------------------------------
async function runRender() {
  try {
    console.log("RENDER START", currentLocation, window.APP_STATE.mode);

    setLoadingState();

    const payload = await renderWeather({
      lat: currentLocation.lat,
      lon: currentLocation.lon,
      tempestStationId: CONFIG.TEMPEST_STATION_ID,
      tempestToken: CONFIG.TEMPEST_TOKEN,
      mode: window.APP_STATE.mode
    });

    // ✅ Store ONLY render-ready payload
    lastWeatherData = {
      payload,
      mode: window.APP_STATE.mode
    };

    setReadyState();

    console.log("RENDER COMPLETE");

  } catch (err) {
    console.error("RENDER FAILED:", err);
    showError("Unable to load weather data.");
  }
}

// ------------------------------------------------------------
// FAST RE-RENDER (NO FETCH)
// ------------------------------------------------------------
let rerenderTimeout = null;

window.updateComfortModules = function () {
  clearTimeout(rerenderTimeout);

  rerenderTimeout = setTimeout(() => {

    // No cache → full render
    if (!lastWeatherData?.payload) {
      console.warn("No cached data — full render fallback");
      runRender();
      return;
    }

    // Mode mismatch → full re-fetch
    if (lastWeatherData.mode !== window.APP_STATE.mode) {
      console.log("Mode changed → full render required");
      runRender();
      return;
    }

    console.log("FAST RE-RENDER");

    renderWeather({
      ...lastWeatherData.payload,
      mode: window.APP_STATE.mode,
      skipFetch: true
    });

  }, 50);
};

// ------------------------------------------------------------
// AUTO REFRESH
// ------------------------------------------------------------
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    console.log("AUTO REFRESH");
    runRender();
  }, CONFIG.REFRESH_INTERVAL);
}

// ------------------------------------------------------------
// LOCATION RESOLUTION
// ------------------------------------------------------------
function resolveLocation() {
  return new Promise((resolve, reject) => {

    if (CONFIG.FORCE_LOCATION) {
      console.log("USING FORCED LOCATION");
      resolve({
        lat: CONFIG.DEFAULT_LAT,
        lon: CONFIG.DEFAULT_LON
      });
      return;
    }

    if (!navigator.geolocation) {
      reject("Geolocation not supported.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude
      }),
      () => reject("Location access denied.")
    );

  });
}

// ------------------------------------------------------------
// ACCORDION SYSTEM
// ------------------------------------------------------------
function setupAccordion() {
  document.addEventListener("click", function (e) {

    if (e.target.closest(".comfort-info-btn")) return;

    const item = e.target.closest("[data-accordion-item]");
    if (!item) return;

    const group = item.closest("[data-accordion]");
    if (!group) return;

    const content = item.querySelector("[data-accordion-content]");
    if (!content) return;

    const isActive = item.classList.contains("active");

    group.querySelectorAll("[data-accordion-item].active").forEach(el => {
      el.classList.remove("active");

      const c = el.querySelector("[data-accordion-content]");
      if (c) c.style.height = "0px";
    });

    if (!isActive) {
      item.classList.add("active");
      content.style.height = content.scrollHeight + "px";
    }
  });
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  console.log("INIT START");

  setupAccordion();
  setLoadingState();

  try {
    const loc = await resolveLocation();
    currentLocation = loc;

    console.log("LOCATION RESOLVED:", loc);

    await runRender();
    startAutoRefresh();

  } catch (err) {
    console.error("INIT FAILED:", err);
    showError(err || "Failed to initialize app.");
  }
}