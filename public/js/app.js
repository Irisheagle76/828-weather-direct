// /js/app.js
// ============================================================
// APP ENTRY — Fetch Data → Build Intel → Render UI
// ============================================================

import {
  getNearestWUStation,
  getWUCurrentConditions,
  getShortTermForecast,
  getMRMSPixel,
  getTempestDeviceObs
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
        const wuCurrentRaw = await getWUCurrentConditions(nearest.stationId);

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");

        // ⭐ Normalize Weather Underground current conditions
        const obs = wuCurrentRaw?.observations?.[0] ?? {};
        const imp = obs.imperial ?? {};

        const wuCurrent = {
          stationId: nearest.stationId,
          temp: imp.temp ?? null,
          feelsLike:
            (imp.heatIndex !== null && imp.heatIndex !== undefined)
              ? imp.heatIndex
              : (imp.windChill !== null && imp.windChill !== undefined)
                ? imp.windChill
                : imp.temp ?? null,
          dew: imp.dewpt ?? null,
          humidity: obs.humidity ?? null,
          windSpeed: obs.windSpeed ?? null,
          windGust: obs.windGust ?? null,
          windDir: obs.winddir ?? null
        };

        // ⭐ 2. Tempest Device Observations
        const TEMPEST_DEVICE_ID = "315255";
        const TEMPEST_TOKEN = "838ff386-d14b-4d45-897a-18903e6970a9";

        const tempest = await getTempestDeviceObs(TEMPEST_DEVICE_ID, TEMPEST_TOKEN);
        const tempestHigh = tempest?.tempHighToday ?? null;

// ⭐ 3. Hourly Forecast (Open-Meteo format)
const hourly = await getShortTermForecast(lat, lon);
console.log("Open-Meteo URL:", url);
// Debug raw payload
console.log("Open-Meteo raw:", hourly);

// Validate structure
if (!hourly || typeof hourly !== "object") {
  throw new Error("Open-Meteo returned no data");
}

if (!Array.isArray(hourly.time)) {
  throw new Error("Open-Meteo hourly data missing or malformed");
}

// ⭐ Convert Open-Meteo column format → array of hourly objects
const hours = hourly.time.map((t, i) => ({
  time: t,
  temp: hourly.temperature_2m?.[i] ?? null,
  dewpoint: hourly.dewpoint_2m?.[i] ?? null,
  rain: hourly.rain?.[i] ?? null,
  snow: hourly.snowfall?.[i] ?? null,
  windSpeed: hourly.wind_speed_10m?.[i] ?? null,
  windGust: hourly.wind_gusts_10m?.[i] ?? null,
  uv: hourly.uv_index?.[i] ?? null,
  cloud: hourly.cloudcover?.[i] ?? null
}));

        window._hourly = hours;

        // ⭐ 4. MRMS Radar Pixel
        const mrmsPixel = await getMRMSPixel(lat, lon);

        // ⭐ 5. Build Unified Intelligence
        const intel = buildWeatherIntel(hours);

        // Attach WU + MRMS + Tempest
        intel.wu = wuCurrent;
        intel.mrms = mrmsPixel;
        intel.tempest = tempest;

        // ⭐ Merge Tempest wind into WU wind (Tempest = primary)
        intel.wu.windSpeed = tempest?.windSpeed ?? intel.wu.windSpeed;
        intel.wu.windGust  = tempest?.windGust  ?? intel.wu.windGust;
        intel.wu.windDir   = tempest?.windDir   ?? intel.wu.windDir;

        // ⭐ Attach Tempest high into today's stats
        intel.today = intel.today || {};
        intel.today.stats = intel.today.stats || {};
        intel.today.stats.maxTemp = tempestHigh;

        // ⭐ Compute comfort now that Tempest high + wind are attached
        intel.comfort = computeComfort(intel);

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
});
