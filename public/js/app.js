// /js/app.js
// ============================================================
// APP ENTRY — Human‑Action 2.x Pipeline
// ============================================================

import { renderWeather } from "./weather-render.js";

// ------------------------------------------------------------
// STATUS + ERROR HELPERS
// ------------------------------------------------------------
function setWUStatus(state, label, text) {
  const badge = document.getElementById("wu-status-badge");
  const dot = document.getElementById("wu-status-dot");
  const lbl = document.getElementById("wu-status-label");
  const txt = document.getElementById("wu-status-text");
  if (!badge || !dot || !lbl || !txt) return;

  lbl.textContent = label;
  txt.textContent = text;

  dot.classList.remove("ok", "error");
  if (state === "ok") dot.classList.add("ok");
  if (state === "error") dot.classList.add("error");
}

function showWUError(msg) {
  const el = document.getElementById("wu-error");
  if (!el) return;
  el.style.display = "block";
  el.textContent = msg;
}

// ------------------------------------------------------------
// INIT APP
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  if (!navigator.geolocation) {
    showWUError("Geolocation is not supported by this browser.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        await renderWeather({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          tempestDeviceId: "315255",
          tempestToken: "838ff386-d14b-4d45-897a-18903e6970a9"
        });

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");
      } catch {
        setWUStatus("error", "Data Error", "Unable to load weather data.");
        showWUError("Unable to load weather data. Please try again later.");
      }
    },
    () => {
      setWUStatus("error", "Location Error", "Location permission denied.");
      showWUError(
        "We couldn’t access your location. Please enable location services and reload."
      );
    }
  );
}