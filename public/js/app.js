// /js/app.js
// ============================================================
// APP ENTRY — STABLE, REFRESHING, DEBUGGABLE (FIXED)
// ============================================================

console.log("APP.JS LOADED — STABLE BUILD v3");

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
// STATE
// ------------------------------------------------------------
let currentLocation = {
  lat: CONFIG.DEFAULT_LAT,
  lon: CONFIG.DEFAULT_LON
};

let refreshTimer = null;

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

// ------------------------------------------------------------
// LOADING STATE
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

// ------------------------------------------------------------
// READY STATE
// ------------------------------------------------------------
function setReadyState() {
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
// CORE RENDER
// ------------------------------------------------------------
async function runRender() {
  try {
    console.log("RENDER START", currentLocation);

    await renderWeather({
      lat: currentLocation.lat,
      lon: currentLocation.lon,
      tempestStationId: CONFIG.TEMPEST_STATION_ID,
      tempestToken: CONFIG.TEMPEST_TOKEN
    });

    setReadyState();

    console.log("RENDER COMPLETE");

  } catch (err) {
    console.error("RENDER FAILED:", err);
    showError("Unable to load weather data.");
  }
}

// ------------------------------------------------------------
// AUTO REFRESH
// ------------------------------------------------------------
function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    console.log("AUTO REFRESH TRIGGERED");
    runRender();
  }, CONFIG.REFRESH_INTERVAL);
}

// ------------------------------------------------------------
// LOCATION
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
// GLOBAL ACCORDION HANDLER
// ------------------------------------------------------------
function setupAccordion() {
  document.addEventListener("click", function (e) {

    // Ignore info buttons
    if (e.target.closest(".comfort-info-btn")) return;

    // ------------------------------------------------------------
    // HUMAN ACTION MODULES (FULL CARD CLICK)
    // ------------------------------------------------------------
    const actionModule = e.target.closest(".action-module");

    if (actionModule) {
      const isActive = actionModule.classList.contains("active");

      document.querySelectorAll(".action-module.active").forEach(el => {
        el.classList.remove("active");
      });

      if (!isActive) actionModule.classList.add("active");

      return; // ✅ now legal (inside function)
    }

    // ------------------------------------------------------------
    // COMFORT MODULES (keep if needed)
    // ------------------------------------------------------------
    const comfortHeader = e.target.closest(".comfort-main");

    if (comfortHeader) {
      const module = comfortHeader.closest(".comfort-module");
      if (!module) return;

      const isActive = module.classList.contains("active");

      document.querySelectorAll(".comfort-module.active").forEach(el => {
        el.classList.remove("active");
      });

      if (!isActive) module.classList.add("active");
    }

  });
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  console.log("INIT START");

  setupAccordion(); // 🔥 clean separation

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