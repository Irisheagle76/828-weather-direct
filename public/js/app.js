// /js/app.js
// ============================================================
// APP ENTRY — Clean + Stable
// ============================================================

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
// LOADING STATE (lightweight only)
// ------------------------------------------------------------
function setLoadingState() {
  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");

  if (label) label.textContent = "Detecting location…";
  if (text) text.textContent = "Waiting for permission.";
}

// ------------------------------------------------------------
// INIT
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  if (!navigator.geolocation) {
    showError("Geolocation is not supported by this browser.");
    return;
  }

  setLoadingState();

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        await renderWeather({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          tempestDeviceId: "315255",
          tempestToken: "838ff386-d14b-4d45-897a-18903e6970a9"
        });

        // ✅ IMPORTANT:
        // Do NOT set status here anymore.
        // weather-render.js now controls the data source indicator.

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