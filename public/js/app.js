// /js/app.js
// ============================================================
// APP ENTRY — Fetch Data → Build Intel → Render UI
// ============================================================

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getWUHistory,
  getShortTermForecast,
  getMRMSPixel,
  getTempestStationObs   // ⭐ NEW
} from './weather-fetch.js';

import { buildWeatherIntel } from './intel/forecast-intel.js';
import { computeComfort } from './intel/comfort.js';

import {
  renderRightNowComfort,
  renderTodayOutlook,
  renderTomorrowOutlook,
  renderUV,
  renderTodayDetail,
  renderTomorrowDetail,
  renderCurrentObservations
} from './weather-render.js';

import { toggleForecastExpanded } from "./weather-render.js";
window.toggleForecastExpanded = toggleForecastExpanded;

// ------------------------------------------------------------
// STATUS + ERROR HELPERS
// ------------------------------------------------------------
function setWUStatus(state, label, text) {
  const badge = document.getElementById("wu-status-badge");
  const dot = document.getElementById("wu-status-dot");
  const lbl = document.getElementById("wu-status-label");
  const txt = document.getElementById("wu-status-text");

  lbl.textContent = label;
  txt.textContent = text;

  dot.classList.remove("ok", "error");

  if (state === "ok") dot.classList.add("ok");
  if (state === "error") dot.classList.add("error");
}

function showWUError(msg) {
  const el = document.getElementById("wu-error");
  el.style.display = "block";
  el.textContent = msg;
}

// ------------------------------------------------------------
// MASTER UI UPDATE FUNCTION
// ------------------------------------------------------------
function updateUI(intel) {
  renderRightNowComfort(intel);
  renderTodayOutlook(intel);
  renderTomorrowOutlook(intel);
  renderUV(intel);
  renderTodayDetail(intel);
  renderTomorrowDetail(intel);
  renderCurrentObservations(intel);

  const footer = document.getElementById("wu-station-footer");
  if (intel.wu?.stationId) {
    footer.textContent = `Live data from Weather Underground Station ${intel.wu.stationId}`;
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
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      try {
        // ⭐ 1. WU Station + Current Conditions
        const nearest = await getNearestWUStation(lat, lon);
        const wuCurrent = await getWUCurrentConditions(nearest.stationId);
        const wuHistory = await getWUHistory(nearest.stationId);
        wuCurrent.history = wuHistory;

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");

        // ⭐ 2. Tempest Station Observations (today's high comes from here)
        const TEMPEST_STATION_ID = "127602";
        const TEMPEST_TOKEN = "838ff386-d14b-4d45-897a-18903e6970a9";

        const tempest = await getTempestStationObs(TEMPEST_STATION_ID, TEMPEST_TOKEN);

        // ⭐ Attach Tempest high/low into intel.today.stats
        // (This replaces ANY WU-based high logic)
        const tempestHigh = tempest?.tempHighToday ?? null;

        // ⭐ 3. Hourly Forecast
        const hourly = await getShortTermForecast(lat, lon);

        // Debug
        window._hourly = hourly;

        // ⭐ 4. MRMS Radar Pixel
        const mrmsPixel = await getMRMSPixel(lat, lon);

        // ⭐ 5. Build Unified Intelligence
        const intel = buildWeatherIntel(hourly);

        // Attach WU + MRMS + Tempest
        intel.wu = wuCurrent;
        intel.mrms = mrmsPixel;
        intel.tempest = tempest;

        // Attach Tempest high into today's stats
        intel.today = intel.today || {};
        intel.today.stats = intel.today.stats || {};
        intel.today.stats.maxTemp = tempestHigh;

        // ⭐ Compute comfort now that Tempest high is attached
        intel.comfort = computeComfort(intel);

        // Expose for debugging
        window._intel = intel;

        // ⭐ 6. Update UI
        updateUI(intel);

      } catch (err) {
        console.error("Weather init error:", err);
        setWUStatus("error", "Data Error", "Unable to load weather data.");
        showWUError("Unable to load weather data. Please try again later.");
      }
    },

    (err) => {
      console.error("Geolocation error:", err);
      setWUStatus("error", "Location Error", "Location permission denied.");
      showWUError("We couldn’t access your location. Please enable location services and reload.");
    }
  );
}

// ------------------------------------------------------------
// CLICK LISTENERS FOR EXPANSION
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const todayModule = document.getElementById("today-module");
  const tomorrowModule = document.getElementById("tomorrow-module");

  if (todayModule) {
    todayModule.addEventListener("click", () => {
      toggleForecastExpanded("today", window._intel);
    });
  }

  if (tomorrowModule) {
    tomorrowModule.addEventListener("click", () => {
      toggleForecastExpanded("tomorrow", window._intel);
    });
  }
});

