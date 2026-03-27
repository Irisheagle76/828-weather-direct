// /js/app.js
// ============================================================
// APP ENTRY — Clean, Modular, Human‑Action 2.0 Ready
// ============================================================

import { buildIntel } from "./intel/intel-builder.js?v=1.0.0";
import { renderPulse } from "./pulse-render.js?v=1.0.0";

import {
  renderRightNowComfort,
  renderFutureComfort,
  renderTodayOutlook,
  renderTomorrowOutlook,
  renderUV,
  renderTodayDetail,
  renderTomorrowDetail,
  renderCurrentObservations,
  renderHourlyTemps,
  toggleForecastExpanded
} from "./weather-render.js?v=1.0.0";

import { subscribeUserToPush } from "./notifications/subscribeClient.js?v=1.0.0";

window.toggleForecastExpanded = toggleForecastExpanded;

// SERVICE WORKER
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// STATUS + ERROR HELPERS
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

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

// ============================================================
// UI UPDATE
// ============================================================
function updateUI(intel) {
  if (!intel) return;

  const comfortNowContainer = document.getElementById("comfort-now-container");
  if (comfortNowContainer) {
    comfortNowContainer.innerHTML = renderRightNowComfort(intel);
  }

  if (intel.hourly) renderHourlyTemps(intel.hourly);

  const futureComfortContainer = document.getElementById("future-comfort-container");
  if (futureComfortContainer) {
    futureComfortContainer.innerHTML = renderFutureComfort(intel);
  }

  renderTodayOutlook(intel);
  renderTomorrowOutlook(intel);
  renderUV(intel);
  renderTodayDetail(intel);
  renderTomorrowDetail(intel);
  renderCurrentObservations(intel);

  const footer = document.getElementById("wu-station-footer");
  if (footer && intel.wu?.stationId) {
    footer.textContent = `Live data from Weather Underground Station ${intel.wu.stationId}`;
  }

  // ⭐ Unified Pulse Renderer
  renderPulse(intel.pulse);

  // ⭐ DEBUG OVERLAY
  const debugEl = document.getElementById("intel-debug");
  if (debugEl) {
    debugEl.textContent = JSON.stringify(intel, null, 2);
  }
}

// ============================================================
// INIT APP
// ============================================================
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  if (!navigator.geolocation) {
    showWUError("Geolocation is not supported by this browser.");
    return;
  }

  setWUStatus("pending", "Requesting Location", "Waiting for permission…");

  navigator.geolocation.getCurrentPosition(
    async pos => {
      try {
        const intel = await buildIntel(pos.coords.latitude, pos.coords.longitude);
        window._intel = intel;
        updateUI(intel);
        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");
      } catch {
        setWUStatus("error", "Data Error", "Unable to load weather data.");
        showWUError("Unable to load weather data. Please try again later.");
      }
    },
    () => {
      setWUStatus("error", "Location Error", "Location permission denied.");
      showWUError("We couldn’t access your location. Please enable location services and reload.");
    }
  );
}

// ============================================================
// EVENT LISTENERS
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const notifBtn = document.getElementById("enable-notifications-btn");
  if (notifBtn) {
    notifBtn.addEventListener("click", async () => {
      const result = await subscribeUserToPush();
      if (result.ok) {
        notifBtn.textContent = "Notifications Enabled";
        notifBtn.disabled = true;
        notifBtn.classList.add("enabled");
      } else {
        alert("Unable to enable notifications.");
      }
    });
  }

  const todayModule = document.getElementById("today-module");
  if (todayModule) {
    todayModule.addEventListener("click", () => {
      if (window._intel) toggleForecastExpanded("today", window._intel);
    });
  }

  const tomorrowModule = document.getElementById("tomorrow-module");
  if (tomorrowModule) {
    tomorrowModule.addEventListener("click", () => {
      if (window._intel) toggleForecastExpanded("tomorrow", window._intel);
    });
  }

  const comfortNowRoot = document.getElementById("comfort-now-container");
  if (comfortNowRoot) {
    comfortNowRoot.addEventListener("click", () => {
      const hourlyEl = document.getElementById("hourlyTemps");
      if (hourlyEl) hourlyEl.classList.toggle("active");
    });
  }
});