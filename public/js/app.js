// ============================================================
// APP ENTRY — Fetch Data → Build Intel → Render UI
// ============================================================

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getShortTermForecast,
  getMRMSPixel,
  getTempestDeviceObs
} from "./weather-fetch.js";

import { subscribeUserToPush } from "./notifications/subscribeClient.js";
import { buildWeatherIntel } from "./intel/forecast-intel.js";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { getReliableUV } from "./intel/uv.js";

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
} from "./weather-render.js";

window.toggleForecastExpanded = toggleForecastExpanded;

// ------------------------------------------------------------
// SERVICE WORKER REGISTRATION (for push notifications)
// ------------------------------------------------------------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(err => {
    console.error("Service worker registration failed:", err);
  });
}

// ============================================================
// 🔥 PULSE MEDIA HANDLER (VIDEO + IMAGE SUPPORT)
// ============================================================
function renderPulseMedia(url) {
  const container = document.getElementById("pulse-media");
  if (!container || !url) return;

  const isVideo =
    url.includes("/video/upload") ||
    url.endsWith(".mp4");

  if (isVideo) {
    container.innerHTML = `
      <video autoplay loop muted playsinline class="pulse-video">
        <source src="${url}" type="video/mp4">
      </video>
    `;
  } else {
    container.innerHTML = `<img src="${url}" class="pulse-video" />`;
  }
}

window.setPulseMedia = renderPulseMedia;

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

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

// ------------------------------------------------------------
// MASTER UI UPDATE FUNCTION
// ------------------------------------------------------------
function updateUI(intel) {
  // Comfort Now
  const comfortNowContainer = document.getElementById("comfort-now-container");
  if (comfortNowContainer) {
    comfortNowContainer.innerHTML = renderRightNowComfort(intel);
  }

  // Hourly temps (hidden initially via CSS)
  renderHourlyTemps(intel.hourly);

  // Future Comfort
  const futureComfortContainer = document.getElementById("future-comfort-container");
  if (futureComfortContainer) {
    futureComfortContainer.innerHTML = renderFutureComfort(intel);
  }

  // Today + Tomorrow
  renderTodayOutlook(intel);
  renderTomorrowOutlook(intel);

  // UV
  renderUV(intel);

  // Expanded panels
  renderTodayDetail(intel);
  renderTomorrowDetail(intel);

  // Current observations (WU block)
  renderCurrentObservations(intel);

  // Station footer
  const footer = document.getElementById("wu-station-footer");
  if (footer && intel.wu?.stationId) {
    footer.textContent = `Live data from Weather Underground Station ${intel.wu.stationId}`;
  }

  // Pulse media
  if (intel.pulse?.imageUrl) {
    renderPulseMedia(intel.pulse.imageUrl);
  }
}

// ------------------------------------------------------------
// ENTRY POINT
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", initApp);

async function initApp() {
  if (!navigator.geolocation) {
    showWUError("Geolocation is not supported by this browser.");
    return;
  }

  setWUStatus("pending", "Requesting Location", "Waiting for permission…");

  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      try {
        const nearest = await getNearestWUStation(lat, lon);
        const wuCurrent = await getWUCurrentConditions(nearest.stationId);

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");

        const TEMPEST_DEVICE_ID = "315255";
        const TEMPEST_TOKEN = "838ff386-d14b-4d45-897a-18903e6970a9";

        const tempest = await getTempestDeviceObs(TEMPEST_DEVICE_ID, TEMPEST_TOKEN);
        const tempestHigh = tempest?.tempHighToday ?? null;

        const hourly = await getShortTermForecast(lat, lon);
        window._hourly = hourly;

        const mrmsPixel = await getMRMSPixel(lat, lon);

        const intel = buildWeatherIntel(hourly);

        intel.wu = wuCurrent;
        intel.mrms = mrmsPixel;
        intel.tempest = tempest;
        intel.hourly = hourly;

        intel.today = intel.today || {};
        intel.today.stats = intel.today.stats || {};
        intel.today.stats.maxTemp = tempestHigh;

        intel.comfort = computeComfort(intel);
        intel.uv = getReliableUV(intel);

        // Future Comfort (next ~6 hours)
        intel.futureComfort = buildFutureComfort(intel.hourly, computeComfort);

        window._intel = intel;

        updateUI(intel);
      } catch (err) {
        console.error("Weather init error:", err);
        setWUStatus("error", "Data Error", "Unable to load weather data.");
        showWUError("Unable to load weather data. Please try again later.");
      }
    },
    err => {
      console.error("Geolocation error:", err);
      setWUStatus("error", "Location Error", "Location permission denied.");
      showWUError("We couldn’t access your location. Please enable location services and reload.");
    }
  );
}

// ------------------------------------------------------------
// CLICK LISTENERS FOR EXPANSION + NOTIFICATIONS + COMFORT TOGGLE
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  // Enable notifications button
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

  // Today / Tomorrow expansion
  const todayModule = document.getElementById("today-module");
  const tomorrowModule = document.getElementById("tomorrow-module");

  if (todayModule) {
    todayModule.addEventListener("click", () => {
      if (!window._intel) return;
      toggleForecastExpanded("today", window._intel);
    });
  }

  if (tomorrowModule) {
    tomorrowModule.addEventListener("click", () => {
      if (!window._intel) return;
      toggleForecastExpanded("tomorrow", window._intel);
    });
  }

  // Comfort → hourly temps toggle (class-based)
  const comfortNowRoot = document.getElementById("comfort-now-container");
  if (comfortNowRoot) {
    comfortNowRoot.addEventListener("click", () => {
      const hourlyEl = document.getElementById("hourlyTemps");
      if (!hourlyEl) return;
      hourlyEl.classList.toggle("hidden");
    });
  }

  // Debugging: SW messages
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", e => {
      alert("SW MSG: " + JSON.stringify(e.data));
    });
  }
});
