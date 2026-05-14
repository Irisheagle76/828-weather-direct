// ============================================================
// APP ENTRY — v8 (CLEAN FLOW + RESILIENT STATE + PULSE SUPPORT)
// ============================================================

console.log("APP.JS LOADED — v8");

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { renderWeather } from "./weather-render.js";
import { fetchAllIntel } from "./weather-fetch.js";
import { renderPulse } from "./pulse-render.js";

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

let appState = {
  isLoading: true,
  data: null
};

// UI mode (downtown/trail/etc.)
window.APP_STATE = window.APP_STATE || {
  mode: "downtown"
};

// ------------------------------------------------------------
// STATUS UI
// ------------------------------------------------------------
function setStatus(labelText, subText) {
  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");

  if (label) label.textContent = labelText;
  if (text) text.textContent = subText;
}

// ------------------------------------------------------------
// PULSE LOADER — CINEMATIC MODULE
// ------------------------------------------------------------
async function loadPulse() {
  try {
    const res = await fetch("/api/router?route=tidbits/pulse-latest");
    const pulse = await res.json();
    renderPulse(pulse);
  } catch (err) {
    console.error("Pulse load failed:", err);
    // graceful fallback — renderer handles empty state
    renderPulse(null);
  }
}

// ------------------------------------------------------------
// CORE RENDER PIPELINE
// ------------------------------------------------------------
async function runRender() {
  console.log("RENDER START");

  // 1. LOADING STATE
  appState.isLoading = true;

  renderWeather({
    data: null,
    isLoading: true,
    mode: window.APP_STATE.mode
  });

  setStatus("Loading weather…", "Fetching latest conditions…");

  try {
    // 2. FETCH WEATHER + INTEL
    const data = await fetchAllIntel({
      lat: currentLocation.lat,
      lon: currentLocation.lon,
      tempestStationId: CONFIG.TEMPEST_STATION_ID,
      tempestToken: CONFIG.TEMPEST_TOKEN
    });

    // 3. UPDATE STATE
    appState = {
      isLoading: false,
      data
    };

    // 4. RENDER WEATHER
    renderWeather({
      data,
      isLoading: false,
      mode: window.APP_STATE.mode
    });

    // 5. UPDATE STATUS
    setStatus(
      "Live conditions",
      `Updated ${new Date().toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit"
      })}`
    );

    console.log("RENDER COMPLETE");

  } catch (err) {
    console.error("RENDER FAILED:", err);

    appState.isLoading = false;

    renderWeather({
      data: null,
      isLoading: false,
      mode: window.APP_STATE.mode
    });

    setStatus("Error", "Unable to load weather data.");
  }
}

// ------------------------------------------------------------
// FAST RE-RENDER (NO FETCH)
// ------------------------------------------------------------
let rerenderTimeout = null;

window.updateComfortModules = function () {
  clearTimeout(rerenderTimeout);

  rerenderTimeout = setTimeout(() => {
    if (!appState.data) {
      console.warn("No data → full fetch");
      runRender();
      return;
    }

    renderWeather({
      data: appState.data,
      isLoading: false,
      mode: window.APP_STATE.mode
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
    loadPulse(); // refresh Pulse too
  }, CONFIG.REFRESH_INTERVAL);
}

// ------------------------------------------------------------
// LOCATION
// ------------------------------------------------------------
function resolveLocation() {
  return new Promise((resolve, reject) => {
    if (CONFIG.FORCE_LOCATION) {
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
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        }),
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

  try {
    const loc = await resolveLocation();
    currentLocation = loc;

    // WEATHER FIRST
    await runRender();

    // THEN PULSE
    await loadPulse();

    // AUTO REFRESH BOTH
    startAutoRefresh();

  } catch (err) {
    console.error("INIT FAILED:", err);

    renderWeather({
      data: null,
      isLoading: false,
      mode: window.APP_STATE.mode
    });

    setStatus("Error", err || "Failed to initialize.");
  }
}
