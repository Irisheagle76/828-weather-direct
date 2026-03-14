// /js/app.js

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getShortTermForecast,
  getMRMSPixel
} from './weather-fetch.js';

import { buildWeatherIntel } from './forecast-intel-plus.js';

import {
  renderRightNowComfort,
  renderTodayOutlook,
  renderTomorrowOutlook,
  renderUV,
  renderTodayDetail,
  renderTomorrowDetail
} from './weather-render.js';

// ------------------------------------------------------------
// STATUS + ERROR HELPERS (moved here from old renderer)
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
  // Right Now Comfort
  renderRightNowComfort(intel);

  // Today + Tomorrow
  renderTodayOutlook(intel);
  renderTomorrowOutlook(intel);

  // UV
  renderUV(intel);

  // Expanded panels
  renderTodayDetail(intel);
  renderTomorrowDetail(intel);

  // Station footer
  const footer = document.getElementById("wu-station-footer");
  if (intel.wu?.stationId) {
    footer.textContent = `Live data from Weather Underground Station ${intel.wu.stationId}`;
  }
}

// ------------------------------------------------------------
// MAKE EXPANSION AVAILABLE TO HTML
// ------------------------------------------------------------
import { toggleForecastExpanded } from "./weather-render.js";
window.toggleForecastExpanded = toggleForecastExpanded;

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

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");

        // ⭐ 2. Hourly Forecast
        const hourly = await getShortTermForecast(lat, lon);

        // ⭐ 3. MRMS Radar Pixel
        const mrmsPixel = await getMRMSPixel(lat, lon);

        // ⭐ 4. Build Unified Intelligence
        const intel = buildWeatherIntel({
          wuCurrent,
          hourly,
          mrmsPixel
        });

        // Make intel globally accessible for expansion panels
        window._intel = intel;

        // ⭐ 5. Update UI
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
