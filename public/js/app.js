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

import { subscribeUserToPush } from "./notifications/subscribeClient.js?v=1.0.0";
import { buildWeatherIntel } from "./intel/forecast-intel.js?v=1.0.0";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js?v=1.0.0";
import { getReliableUV } from "./intel/uv.js?v=1.0.0";

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
// SERVICE WORKER REGISTRATION
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

// ============================================================
// ⭐ HYBRID PULSE PREVIEW BUILDER (PLAIN TEXT ONLY)
// ============================================================
function buildPulsePreview(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || div.innerText || "";

  const sentences = text.split(/(?<=[.!?])\s+/);
  let preview = sentences[0] || "";

  if (preview.length < 120 && sentences.length > 1) {
    preview += " " + sentences[1];
  }

  if (preview.length > 200) {
    preview = preview.slice(0, 200).trim() + "…";
  }

  return preview;
}

// ============================================================
// ⭐ TIMESTAMP FORMATTER
// ============================================================
function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "Updated just now";
  if (diff < 3600) return `Updated ${Math.floor(diff / 60)} min ago`;
  const hrs = Math.floor(diff / 3600);
  return `Updated ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}

// ============================================================
// MASTER UI UPDATE FUNCTION
// ============================================================
function updateUI(intel) {
  if (!intel) return;

  // Comfort Now
  const comfortNowContainer = document.getElementById("comfort-now-container");
  if (comfortNowContainer) {
    comfortNowContainer.innerHTML = renderRightNowComfort(intel);
  }

  // Hourly temps
  if (intel.hourly) {
    renderHourlyTemps(intel.hourly);
  }

  // Future Comfort
  const futureComfortContainer = document.getElementById("future-comfort-container");
  if (futureComfortContainer) {
    futureComfortContainer.innerHTML = renderFutureComfort(intel);
  }

  // Human‑Action 2.0
  renderTodayOutlook(intel);
  renderTomorrowOutlook(intel);

  // UV Index
  renderUV(intel);

  // Expanded Panels
  renderTodayDetail(intel);
  renderTomorrowDetail(intel);

  // Current Observations
  renderCurrentObservations(intel);

  // Station Footer
  const footer = document.getElementById("wu-station-footer");
  if (footer && intel.wu?.stationId) {
    footer.textContent = `Live data from Weather Underground Station ${intel.wu.stationId}`;
  }
    // ------------------------------------------------------------
  // ⭐ PULSE MEDIA + TEXT
  // ------------------------------------------------------------
  if (intel.pulse?.mediaUrl) {
    renderPulseMedia(intel.pulse.mediaUrl);
  }

  // PREVIEW (plain text intro)
  const preview = document.getElementById("pulse-preview");
  if (preview && intel.pulse?.text) {
    preview.innerText = buildPulsePreview(intel.pulse.text);
  }

  // FULL TEXT (HTML allowed)
  const fullText = document.getElementById("pulse-full-text");
  if (fullText && intel.pulse?.text) {
    fullText.innerHTML = intel.pulse.text;
  }

  // TIMESTAMP
  const ts = document.getElementById("pulse-timestamp");
  if (ts && intel.pulse?.timestamp) {
    ts.textContent = formatTimeAgo(intel.pulse.timestamp);
  }
}
// ============================================================
// ENTRY POINT — INIT APP
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
console.log("RAW HOURLY:", hourly);   // ⭐ Add this
console.log("TYPE OF RAW HOURLY:", typeof hourly, Array.isArray(hourly));
console.log("RAW HOURLY KEYS:", Object.keys(hourly));
window._hourly = hourly;

        const mrmsPixel = await getMRMSPixel(lat, lon);

        const intel = buildWeatherIntel(hourly);

        intel.wu = wuCurrent;
        intel.tempest = tempest;
        intel.hourly = hourly;
        intel.mrms = mrmsPixel;

        if (hourly?.cloudcover?.length > 0) {
          intel.wu.cloudCover = hourly.cloudcover[0];
        }

        // SKY INTEL
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

        // CURRENT CONDITIONS
        intel.current = {
          temp: intel.tempest?.temp ?? intel.wu?.temp ?? null,
          feelsLike: intel.tempest?.temp ?? intel.wu?.temp ?? null,
          dewpoint: intel.wu?.dewPoint ?? null,
          humidity: intel.tempest?.humidity ?? intel.wu?.humidity ?? null,
          windSpeed: intel.tempest?.windSpeed ?? intel.wu?.windSpeed ?? null,
          windGust: intel.tempest?.windGust ?? intel.wu?.windGust ?? null,
          windDir: intel.tempest?.windDir ?? intel.wu?.windDir ?? null,
          precipType: intel.tempest?.precipType ?? intel.wu?.precipType ?? null,
          precipIntensity: intel.wu?.precipRate ?? 0,
          cloudCover: intel.sky.cloud != null ? intel.sky.cloud / 100 : null,
          uvIndex: intel.sky.uv ?? null,
          visibility: intel.wu?.visibility ?? 10,
          smokeIndex: intel.wu?.smokeIndex ?? 0,
          frostRisk:
            (intel.wu?.dewPoint <= 36 && intel.wu?.temp <= 37) ? 0.7 :
            (intel.wu?.temp <= 34) ? 1 : 0,
          freezeRisk:
            intel.wu?.temp <= 32 ? 1 :
            intel.wu?.temp <= 34 ? 0.5 : 0,
          inversionRisk:
            (intel.wu?.temp <= 40 && (intel.tempest?.windSpeed ?? 0) < 3) ? 0.6 : 0,
          blackIceRisk:
            (intel.wu?.temp <= 32 && (intel.wu?.precipRate ?? 0) > 0) ? 1 :
            (intel.wu?.temp <= 33 && intel.today?.stats?.tempMin <= 30) ? 0.5 : 0,
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
                intel.today = intel.today || {};
        intel.today.stats = intel.today.stats || {};
        intel.today.stats.maxTemp = tempestHigh;

        intel.comfort = computeComfort(intel);
        intel.uv = getReliableUV(intel);
        intel.futureComfort = buildFutureComfort(intel.hourly, computeComfort);

        // ⭐ LOAD PULSE
        try {
          const pulseRes = await fetch("/api/tidbits/pulse-latest");
          intel.pulse = await pulseRes.json();
        } catch (err) {
          console.error("Pulse fetch error:", err);
          intel.pulse = null;
        }

        window._intel = intel;
        window.intel = intel;

        // ⭐ TEMPORARY: Print intel for debugging
try {
  const debugPanel = document.getElementById("intel-debug");
  if (debugPanel) {
    const debugData = {
      today: intel.today,
      tomorrow: intel.tomorrow,
      hourlySample: hourly?.slice?.(0, 12) || [],
      meta: {
        now: new Date().toISOString(),
        hourlyCount: hourly?.length || 0
      }
    };

    debugPanel.textContent = JSON.stringify(debugData, null, 2);
  }
} catch (err) {
  console.error("Debug panel error:", err);
}
 // ⭐ UPDATEUI SECTION

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
// ============================================================
// CLICK LISTENERS — Expansion, Notifications, Comfort Toggle
// ============================================================
document.addEventListener("DOMContentLoaded", () => {

  // Notifications
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

  // Today / Tomorrow Expansion
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

  // Comfort → Hourly Temps Toggle
  const comfortNowRoot = document.getElementById("comfort-now-container");
  if (comfortNowRoot) {
    comfortNowRoot.addEventListener("click", () => {
      const hourlyEl = document.getElementById("hourlyTemps");
      if (!hourlyEl) return;
      hourlyEl.classList.toggle("active");
    });
  }

  // ------------------------------------------------------------
  // ⭐ PULSE EXPAND / COLLAPSE (final, corrected)
  // ------------------------------------------------------------
  const pulseCard = document.getElementById("pulse-card");
  const pulseToggle = document.getElementById("pulse-toggle");
  const pulsePreview = document.getElementById("pulse-preview");
  const pulseFull = document.getElementById("pulse-full-text");

  if (pulseCard && pulseToggle) {
    pulseToggle.addEventListener("click", () => {
      const isExpanded = pulseCard.classList.toggle("pulse-expanded");

      pulseToggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      pulseToggle.textContent = isExpanded ? "Hide update" : "Read full update";

      if (!isExpanded) {
        if (pulsePreview) pulsePreview.style.display = "block";
        if (pulseFull) pulseFull.style.display = "none";
      }

      if (isExpanded) {
        if (pulsePreview) pulsePreview.style.display = "none";
        if (pulseFull) pulseFull.style.display = "block";
      }
    });
  }

  // Service Worker Debug
  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", e => {
      alert("SW MSG: " + JSON.stringify(e.data));
    });
  }
});