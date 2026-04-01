// /js/app.js
// ============================================================
// APP ENTRY — Clean + Stable
// ============================================================

// 🔥 DIAGNOSTIC MARKER — CONFIRM LOAD
console.log("APP.JS LOADED — VERSION TEST MARKER A — v7");

// ------------------------------------------------------------
// IMPORTS
// ------------------------------------------------------------
import { renderWeather } from "./weather-render.js";

// ------------------------------------------------------------
// ERROR HANDLING
// ------------------------------------------------------------
function showError(msg) {
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

  if (label) label.textContent = "Detecting location…";
  if (text) text.textContent = "Waiting for browser location permission.";
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  console.log("INITAPP FIRED — VERSION TEST MARKER B");

  if (!navigator.geolocation) {
    showError("Geolocation is not supported by this browser.");
    return;
  }

  setLoadingState();

  navigator.geolocation.getCurrentPosition(
    async pos => {
      console.log("GEOLOCATION SUCCESS — VERSION TEST MARKER C", pos);

      // ⭐ TEMPORARY OVERRIDE WHILE TRAVELING ⭐
      const FORCE_ASHEVILLE = true;

      const lat = FORCE_ASHEVILLE ? 35.5951 : pos.coords.latitude;
      const lon = FORCE_ASHEVILLE ? -82.5515 : pos.coords.longitude;

      try {
        await renderWeather({
          lat,
          lon,
          tempestDeviceId: "315255",
          tempestToken: "838ff386-d14b-4d45-897a-18903e6970a9"
        });

      } catch (err) {
        console.error("Render failed:", err);
        showError("Unable to load weather data. Please try again.");
      }
    },

    err => {
      console.error("Geolocation error:", err);

      showError(
        "We couldn’t access your location. Please enable location services and reload."
      );
    }
  );
}
