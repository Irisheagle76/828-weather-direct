// /js/weather-render.js

// ============================================================
// IMPORTS
// ============================================================
import { renderComfortNow } from "./modules/renderComfortNow.js";
import { renderFutureComfort } from "./modules/renderFutureComfort.js";
import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort as computeComfortLegacy, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer/index.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";

// ============================================================
// HELPERS
// ============================================================
const $ = id => document.getElementById(id);

function safeSet(id, prop, value) {
  const el = $(id);
  if (el && value != null) el[prop] = value;
}

function safeHTML(id, html) {
  const el = $(id);
  if (el) el.innerHTML = html;
}

function formatHourLabel(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

function getTodayLabelFromLocalTime() {
  const h = new Date().getHours();
  if (h < 12) return "This Morning’s Outlook";
  if (h < 17) return "This Afternoon’s Outlook";
  if (h < 21) return "This Evening’s Outlook";
  return "Tonight’s Outlook";
}

// ============================================================
// CANONICAL CURRENT CONDITIONS — TEMPEST FIRST
// ============================================================
function resolveCurrentConditions(raw, hourly) {
  const now = Date.now();

  if (!Array.isArray(hourly) || hourly.length === 0) {
    return null; // or safe default object
  }

  // Normalize timestamps if needed (seconds → ms)
  const getTs = h =>
    h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp;

  // Find first future datapoint
  let idx = hourly.findIndex(h => getTs(h) >= now);

  let fallback;

  if (idx !== -1) {
    fallback = hourly[idx];
  } else {
    // Use most recent past (last item)
    fallback = hourly[hourly.length - 1];
  }

  const temp =
    raw.tempest?.air_temperature ??
    fallback?.temperatureF ??
    null;

  const dewPoint =
    raw.tempest?.dew_point ??
    fallback?.dewpointF ??
    null;

  const humidity =
    raw.tempest?.relative_humidity ??
    fallback?.relative_humidity ??
    null;

  const windSpeed =
    raw.tempest?.wind_avg != null
      ? raw.tempest.wind_avg * 2.23694
      : fallback?.wind_speed ?? null;

  const windGust =
    raw.tempest?.wind_gust != null
      ? raw.tempest.wind_gust * 2.23694
      : fallback?.wind_gust ?? null;

  const windDir =
    raw.tempest?.wind_direction ??
    fallback?.wind_dir ??
    "";

  const uv =
    raw.tempest?.uv ??
    fallback?.uv_index ??
    0;

  const obsTimeLocal =
    raw.tempest?.timestamp ??
    fallback?.timestamp ??
    Date.now();

  return {
    temp,
    dewPoint,
    humidity,
    windSpeed,
    windGust,
    windDir,
    uv,
    obsTimeLocal
  };
}

// ============================================================
// COMFORT WRAPPER — STABLE + SAFE
// ============================================================
function computeComfortWrapped(input) {
  if (!input) return null;

  const temp = input.temp ?? null;

  // Ensure dew point ALWAYS exists (prevents null comfortScore)
  let dewPoint = input.dewPoint;

  if (dewPoint == null && temp != null) {
    // fallback approximation (simple + stable)
    dewPoint = temp - 20;
  }

  return computeComfortLegacy({
    wu: {
      temp,
      dewPoint,
      windSpeed: input.windSpeed ?? 0,
      windDir: input.windDir ?? "",
      humidity: input.humidity ?? null,
      uv: input.uv ?? null,
      obsTimeLocal: input.obsTimeLocal ?? Date.now()
    }
  });
}

// ============================================================
// CURRENT OBSERVATIONS — EMOJI-RICH, ASHEVILLE-WARM
// ============================================================
function renderCurrentObservations(current) {
  const wrap = $("current-obs-wrapper");
  if (wrap) wrap.classList.add("module-card");

  const container = $("current-obs-inline");
  if (!container) return;

  container.innerHTML = `
    <div class="obs-line">
      <span class="obs-item">🌡️ <strong>${current.tempF != null ? Math.round(current.tempF) + "°" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">💧 Dew <strong>${current.dewF != null ? Math.round(current.dewF) + "°" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">💦 <strong>${current.humidity != null ? Math.round(current.humidity) + "%" : "--"}</strong></span>
    </div>

    <div class="obs-line">
      <span class="obs-item">🌬️ <strong>${current.wind != null ? Math.round(current.wind) + " mph" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">💨 Gusts <strong>${current.gust != null ? Math.round(current.gust) + " mph" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">🔆 UV <strong>${current.uv}</strong></span>
    </div>
  `;
}

// ============================================================
// DATA SOURCE INDICATOR
// ============================================================
function updateDataSourceIndicator(raw) {
  const label = $("wu-status-label");
  const text = $("wu-status-text");
  const dot = $("wu-status-dot");

  if (!label || !text || !dot) return;

  if (raw.tempest) {
    label.textContent = "Tempest Live";
    text.textContent = "Real-time station data";
    dot.classList.add("ok");
    dot.classList.remove("error");
    return;
  }

  if (raw.wu) {
    label.textContent = "Nearby Station";
    text.textContent = "Using local weather station";
    dot.classList.add("ok");
    dot.classList.remove("error");
    return;
  }

  label.textContent = "Model Data";
  text.textContent = "Using forecast model";
  dot.classList.add("error");
  dot.classList.remove("ok");
}

// ============================================================
// HUMAN ACTION (TODAY + TOMORROW)
// ============================================================
function renderHumanAction(today, tomorrow) {
  safeSet("ha-today-header", "textContent", getTodayLabelFromLocalTime());
  safeSet("ha-today-emoji", "textContent", today.emoji);
  safeSet("ha-today-title", "textContent", today.headline);
  safeSet("ha-today-body", "textContent", today.narrative);
  safeHTML("ha-today-bullets", (today.bullets || []).map(b => `<li>${b}</li>`).join(""));

  const todayGold = $("ha-today-goldilocks");
  if (todayGold) todayGold.style.display = today.goldilocks ? "inline-block" : "none";

  safeSet("ha-tomorrow-header", "textContent", "Tomorrow’s Outlook");
  safeSet("ha-tomorrow-emoji", "textContent", tomorrow.emoji);
  safeSet("ha-tomorrow-title", "textContent", tomorrow.headline);
  safeSet("ha-tomorrow-body", "textContent", tomorrow.narrative);
  safeHTML("ha-tomorrow-bullets", (tomorrow.bullets || []).map(b => `<li>${b}</li>`).join(""));

  const tomorrowGold = $("ha-tomorrow-goldilocks");
  if (tomorrowGold) tomorrowGold.style.display = tomorrow.goldilocks ? "inline-block" : "none";

}

// ============================================================
// HUMAN ACTION EXPANDED (STATS)
// ============================================================
function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  const build = intel => {
    if (!intel || !intel.snapshot) return "";

    const s = intel.snapshot;

    const high = intel.stats?.tempMax ?? s.temp ?? null;
    const low = intel.stats?.tempMin ?? s.temp ?? null;
    const dew = s.dewPoint ?? null;
    const wind = s.windSpeed ?? null;
    const gust = s.windGust ?? null;
    const precipType = s.precipType ?? intel.precipType ?? "";
    const precipChance = intel.precipChance ?? null;

    return `
      <div class="fx-grid">
        <div class="fx-tile">
          <div class="fx-top">
            ${high != null ? `${Math.round(high)}° / ${Math.round(low)}°` : "--"}
          </div>
          <div class="fx-sub">High / Low</div>
          <div class="fx-label">Temperature</div>
        </div>

        <div class="fx-tile">
          <div class="fx-top">${dew != null ? `${Math.round(dew)}°` : "--"}</div>
          <div class="fx-sub">Dew Point</div>
          <div class="fx-label">Moisture</div>
        </div>

        <div class="fx-tile">
          <div class="fx-top">${wind != null ? `${Math.round(wind)} mph` : "--"}</div>
          <div class="fx-sub">${gust != null ? `Gusts ${Math.round(gust)} mph` : ""}</div>
          <div class="fx-label">Wind</div>
        </div>

        <div class="fx-tile">
          <div class="fx-top">${precipChance != null ? `${precipChance}%` : "--"}</div>
          <div class="fx-sub">${precipType}</div>
          <div class="fx-label">Precipitation</div>
        </div>
      </div>
    `;
  };

  safeHTML("ha-today-expanded", build(todayIntel));
  safeHTML("ha-tomorrow-expanded", build(tomorrowIntel));
}


// ============================================================
// BEST COMFORT WINDOW — 3-HOUR SLIDING WINDOW (FIXED)
// ============================================================
function findBestComfortWindow(hourlyNormalized, windowSize = 3) {
  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length < windowSize) {
    return null;
  }

  const now = Date.now();

  // Normalize timestamps (handles seconds vs ms)
  const getTs = h =>
    h.timestamp < 1e12 ? h.timestamp * 1000 : h.timestamp;

  // Find first hour at/after now
  let startIndex = hourlyNormalized.findIndex(h => getTs(h) >= now);

  // If all data is in the past → start at last valid window
  if (startIndex === -1) {
    startIndex = hourlyNormalized.length - windowSize;
  }

  const windows = [];

  for (let start = startIndex; start <= hourlyNormalized.length - windowSize; start++) {
    let sum = 0;
    const hours = [];

    for (let i = 0; i < windowSize; i++) {
      const h = hourlyNormalized[start + i];
      const ts = getTs(h);

      const comfort = computeComfortWrapped({
        temp: h.temperatureF ?? null,
        dewPoint: h.dewpointF ?? null,
        humidity: h.relative_humidity ?? null,
        uv: h.uv_index ?? null,
        windSpeed: h.wind_speed ?? 0,
        windDir: h.wind_dir ?? "",
        obsTimeLocal: ts
      });

      const score = comfort?.comfortScore ?? 0;

      hours.push({
        hourLabel: formatHourLabel(ts),
        temp: h.temperatureF,
        dew: h.dewpointF,
        comfortScore: score,
        emoji: comfort?.emoji ?? "—",
        label: comfort?.category ?? ""
      });

      sum += score;
    }

    windows.push({
      startIndex: start,
      avgScore: sum / windowSize,
      hours
    });
  }

  // Highest comfort window first
  windows.sort((a, b) => b.avgScore - a.avgScore);

  return windows[0] ?? null;
}

// ============================================================
// ACCORDION — ONE MODULE OPEN AT A TIME
// ============================================================
function initializeAccordion() {
  document.addEventListener("click", e => {
    const mod = e.target.closest("[data-accordion]");
    if (!mod) return;

    const group = mod.getAttribute("data-accordion");
    const all = document.querySelectorAll("[data-accordion]");
    const isActive = mod.classList.contains("active");

    all.forEach(m => {
      if (m.getAttribute("data-accordion") === group) {
        m.classList.remove("active");
      }
    });

    if (!isActive) {
      mod.classList.add("active");
    }
  });
}

// ============================================================
// MAIN ENTRY — FULL PIPELINE (STABLE)
// ============================================================
export async function renderWeather({ lat, lon, tempestStationId, tempestToken }) {
  const raw = await fetchAllIntel({ lat, lon, tempestStationId, tempestToken });

  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);

  // (Optional but recommended safety)
  hourlyNormalized.sort((a, b) => a.timestamp - b.timestamp);

  const current = resolveCurrentConditions(raw, hourlyNormalized);

  updateDataSourceIndicator(raw);

  // ------------------------------------------------------------
  // CURRENT OBS — FIX SHAPE MISMATCH + NULL GUARD
  // ------------------------------------------------------------
  if (current) {
    renderCurrentObservations({
      tempF: current.temp,
      dewF: current.dewPoint,
      humidity: current.humidity,
      wind: current.windSpeed,
      gust: current.windGust,
      uv: current.uv
    });
  }

  // ------------------------------------------------------------
  // HUMAN ACTION INTEL + SYNTH
  // ------------------------------------------------------------
  const intelRaw = buildHumanActionIntel(raw);
  const { today: todayNarr, tomorrow: tomorrowNarr } = generateNarrative(
    intelRaw.today,
    intelRaw.tomorrow
  );

  renderHumanAction(todayNarr, tomorrowNarr);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);

  // ------------------------------------------------------------
  // COMFORT NOW — SAFE GUARD
  // ------------------------------------------------------------
  let comfortNow = null;

  if (current) {
    comfortNow = computeComfortWrapped({
      temp: current.temp,
      dewPoint: current.dewPoint,
      windSpeed: current.windSpeed,
      windDir: current.windDir,
      humidity: current.humidity,
      uv: current.uv,
      obsTimeLocal: current.obsTimeLocal
    });
  }

  const comfortNowForRender = comfortNow
    ? {
        ...comfortNow,
        title: comfortNow.headline ?? "Comfort overview",
        bullets: [],
        longNarrative: comfortNow.narrative ?? ""
      }
    : null;

  // ------------------------------------------------------------
  // BEST COMFORT WINDOW
  // ------------------------------------------------------------
  const bestWindow = findBestComfortWindow(hourlyNormalized);

  // ------------------------------------------------------------
  // FUTURE COMFORT
  // ------------------------------------------------------------
  const futureComfort = buildFutureComfort(hourlyNormalized, computeComfortWrapped);

  // ------------------------------------------------------------
  // RENDER MODULES (GUARDED)
  // ------------------------------------------------------------
  if (comfortNowForRender) {
    renderComfortNow($("comfort-now-container"), comfortNowForRender, bestWindow);
  }

  renderFutureComfort($("future-comfort-container"), futureComfort);

  initializeAccordion();

  // ------------------------------------------------------------
  // DEBUG
  // ------------------------------------------------------------
  window._raw = raw;
  window._hourly = hourlyNormalized;
  window._current = current;
  window._comfortNow = comfortNow;
  window._comfortNowForRender = comfortNowForRender;
  window._todayNarr = todayNarr;
  window._tomorrowNarr = tomorrowNarr;
  window._haToday = intelRaw.today;
  window._haTomorrow = intelRaw.tomorrow;
}