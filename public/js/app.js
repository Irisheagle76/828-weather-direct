// /js/app.js
// ============================================================
// APP ENTRY — STABLE, REFRESHING, DEBUGGABLE
// ============================================================

// 🔥 VERSION MARKER
console.log("APP.JS LOADED — STABLE BUILD v2");

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { renderWeather } from "./weather-render.js";

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const CONFIG = {
  FORCE_LOCATION: true,

  // Asheville fallback
  DEFAULT_LAT: 35.5951,
  DEFAULT_LON: -82.5515,

  // Tempest
  TEMPEST_STATION_ID: "315255",
  TEMPEST_TOKEN: "838ff386-d14b-4d45-897a-18903e6970a9",

  // Refresh interval (ms)
  REFRESH_INTERVAL: 5 * 60 * 1000 // 5 min
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
// READY STATE (NEW)
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

    // ✅ NEW: update UI status
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
// LOCATION HANDLING
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
      pos => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
      },
      () => reject("Location access denied.")
    );

  });
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  console.log("INIT START");

  // ------------------------------------------------------------
  // 🔥 ACCORDION HANDLER (persistent across re-renders)
  // ------------------------------------------------------------
  document.addEventListener('click', function (e) {

    // 🚫 Ignore clicks on info buttons (so they don't toggle accordion)
    if (e.target.closest('.comfort-info-btn')) return;

    const header = e.target.closest('.comfort-main');
    if (!header) return;

    const module = header.closest('.comfort-module');
    if (!module) return;

    const isOpen = module.classList.contains('open');

    // Close all (remove this block if you want multi-open)
    document.querySelectorAll('.comfort-module.open').forEach(el => {
      el.classList.remove('open');
    });

    // Open clicked one
    if (!isOpen) {
      module.classList.add('open');
    }
  });

  // ------------------------------------------------------------

  setLoadingState();

  try {
    const loc = await resolveLocation();
    currentLocation = loc;

    console.log("LOCATION RESOLVED:", loc);

    // Initial render
    await runRender();

    // Start refresh loop
    startAutoRefresh();

  } catch (err) {
    console.error("INIT FAILED:", err);
    showError(err || "Failed to initialize app.");
  }
}