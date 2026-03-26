// ============================================================
// APP ENTRY — Fetch Data → Build Intel → Render UI
// Optimized + Safe for Human‑Action 2.0
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

  container.innerHTML = isVideo
    ? `
      <video autoplay loop muted playsinline class="pulse-video">
        <source src="${url}" type="video/mp4">
      </video>
    `
    : `<img src="${url}" class="pulse-video" />`;
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
        // ------------------------------------------------------------
        // WU STATION + CURRENT CONDITIONS
        // ------------------------------------------------------------
        const nearest = await getNearestWUStation(lat, lon);
        const wuCurrent = await getWUCurrentConditions(nearest.stationId);

        setWUStatus("ok", "WU Connected", "Weather Underground data loaded.");

        // ------------------------------------------------------------
        // TEMPEST DEVICE OBS
        // ------------------------------------------------------------
        const TEMPEST_DEVICE_ID = "315255";
        const TEMPEST_TOKEN = "838ff386-d14b-4d45-897a-18903e6970a9";

        const tempest = await getTempestDeviceObs(TEMPEST_DEVICE_ID, TEMPEST_TOKEN);
        const tempestHigh = tempest?.tempHighToday ?? null;

        // ------------------------------------------------------------
        // OPEN-METEO HOURLY FORECAST
        // ------------------------------------------------------------
        const hourly = await getShortTermForecast(lat, lon);
        window._hourly = hourly;

        // ------------------------------------------------------------
        // MRMS PRECIP PIXEL
        // ------------------------------------------------------------
        const mrmsPixel = await getMRMSPixel(lat, lon);

        // ------------------------------------------------------------
        // BUILD BASE INTEL
        // ------------------------------------------------------------
        const intel = buildWeatherIntel(hourly);

        intel.wu = wuCurrent;
        intel.tempest = tempest;
        intel.hourly = hourly;
        intel.mrms = mrmsPixel;

        // Cloud cover fallback from OM
        if (hourly?.cloudcover?.length > 0) {
          intel.wu.cloudCover = hourly.cloudcover[0];
        }

        // ------------------------------------------------------------
        // ⭐ UNIFIED SKY INTELLIGENCE
        // ------------------------------------------------------------
        intel.sky = {
          cloud:
            intel.wu.cloudCover ??
            (intel.tempest?.illuminance != null
              ? Math.max(
                  0,
                  Math.min(100, 100 - (intel.tempest.illuminance / 120000) * 100)
                )
              : null) ??
            hourly.cloudcover?.[0] ??
            null,

          uv:
            intel.tempest?.uv ??
            intel.wu?.uv ??
            hourly.uv_index?.[0] ??
            null,

          solar:
            intel.tempest?.solarRadiation ??
            intel.wu?.solarRadiation ??
            null
        };

        // ------------------------------------------------------------
        // ⭐ UNIFIED CURRENT CONDITIONS (Human‑Action 2.0 Ready)
        // ------------------------------------------------------------
        intel.current = {
          temp:
            intel.tempest?.temp ??
            intel.wu?.temp ??
            null,

          feelsLike:
            intel.tempest?.temp ??
            intel.wu?.temp ??
            null,

          dewpoint:
            intel.wu?.dewPoint ??
            null,

          humidity:
            intel.tempest?.humidity ??
            intel.wu?.humidity ??
            null,

          windSpeed:
            intel.tempest?.windSpeed ??
            intel.wu?.windSpeed ??
            null,

          windGust:
            intel.tempest?.windGust ??
            intel.wu?.windGust ??
            null,

          windDir:
            intel.tempest?.windDir ??
            intel.wu?.windDir ??
            null,

          precipType:
            intel.tempest?.precipType ??
            intel.wu?.precipType ??
            null,

          precipIntensity:
            intel.wu?.precipRate ??
            0,

          cloudCover:
            intel.sky.cloud != null ? intel.sky.cloud / 100 : null,

          uvIndex:
            intel.sky.uv ?? null,

          visibility:
            intel.wu?.visibility ?? 10,

          smokeIndex:
            intel.wu?.smokeIndex ?? 0,

          frostRisk:
            (intel.wu?.dewPoint <= 36 && intel.wu?.temp <= 37) ? 0.7 :
            (intel.wu?.temp <= 34) ? 1 :
            0,

          freezeRisk:
            intel.wu?.temp <= 32 ? 1 :
            intel.wu?.temp <= 34 ? 0.5 :
            0,

          inversionRisk:
            (intel.wu?.temp <= 40 && (intel.tempest?.windSpeed ?? 0) < 3) ? 0.6 : 0,

          blackIceRisk:
            (intel.wu?.temp <= 32 && (intel.wu?.precipRate ?? 0) > 0) ? 1 :
            (intel.wu?.temp <= 33 && intel.today?.stats?.tempMin <= 30) ? 0.5 :
            0,

          valleyFogRisk:
            (intel.wu?.humidity >= 90 &&
             intel.wu?.temp <= 50 &&
             (intel.tempest?.windSpeed ?? 0) < 3)
              ? 0.7 : 0,

          ridgeFogRisk:
            (intel.wu?.humidity >= 95 &&
             intel.sky.cloud >= 80 &&
             (intel.tempest?.windSpeed ?? 0) < 4)
              ? 0.6 : 0,

          timestamp:
            intel.tempest?.timestamp ??
            intel.wu?.obsTimeLocal ??
            Date.now()
        };

        // ------------------------------------------------------------
        // TODAY STATS (Tempest high)
        // ------------------------------------------------------------
        intel.today = intel.today || {};
        intel.today.stats = intel.today.stats || {};
        intel.today.stats.maxTemp = tempestHigh;

        // ------------------------------------------------------------
        // COMFORT ENGINE
        // ------------------------------------------------------------
        intel.comfort = computeComfort(intel);

        // UV block
        intel.uv = getReliableUV(intel);

        // ------------------------------------------------------------
        // FUTURE COMFORT (next 6 hours)
        // ------------------------------------------------------------
        intel.futureComfort = buildFutureComfort(intel.hourly, computeComfort);

        // ------------------------------------------------------------
        // DEBUG HANDLE
        // ------------------------------------------------------------
        window._intel = intel;
        window.intel = intel; // ⭐ Expose for debugging + HA2.0 validation

        // ------------------------------------------------------------
        // UPDATE UI
        // ------------------------------------------------------------
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
// CLICK LISTENERS — Expansion, Notifications, Comfort Toggle
// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------------------------------------
  // Enable Notifications Button
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Today / Tomorrow Expansion Panels
  // ------------------------------------------------------------
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

  // ------------------------------------------------------------
  // Comfort → Hourly Temps Toggle
  // ------------------------------------------------------------
  const comfortNowRoot = document.getElementById("comfort-now-container");

  if (comfortNowRoot) {
    comfortNowRoot.addEventListener("click", () => {
      const hourlyEl = document.getElementById("hourlyTemps");
      if (!hourlyEl) return;
      hourlyEl.classList.toggle("active");
    });
  }

  // ------------------------------------------------------------
  // Service Worker Debug Messages
  // ------------------------------------------------------------
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", e => {
      alert("SW MSG: " + JSON.stringify(e.data));
    });
  }
});