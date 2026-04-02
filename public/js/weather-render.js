// /js/weather-render.js

// ============================================================
// IMPORTS
// ============================================================
import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort as computeComfortLegacy, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer/index.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";

// ============================================================
// HELPERS
// ============================================================
const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);
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
  const idx = hourly.findIndex(h => h.timestamp >= now);
  const fallback = idx !== -1 ? hourly[idx] : hourly[0];

  const tempF =
    (raw.tempest?.air_temperature != null
      ? cToF(raw.tempest.air_temperature)
      : null) ??
    fallback?.temperatureF ??
    null;

  const dewF =
    (raw.tempest?.dew_point != null
      ? cToF(raw.tempest.dew_point)
      : null) ??
    fallback?.dewpointF ??
    null;

  const humidity =
    raw.tempest?.relative_humidity ??
    fallback?.relative_humidity ??
    null;

  const wind =
    raw.tempest?.wind_avg != null
      ? raw.tempest.wind_avg * 2.23694
      : fallback?.wind_speed ?? null;

  const gust =
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

  const timestamp =
    raw.tempest?.timestamp ??
    fallback?.timestamp ??
    Date.now();

  return { tempF, dewF, wind, gust, humidity, uv, windDir, timestamp };
}

// ============================================================
// COMFORT WRAPPER
// ============================================================
function computeComfort(input) {
  return computeComfortLegacy({
    wu: {
      temp: input.tempF,
      dewPoint: input.dewF,
      windSpeed: input.wind ?? 0,
      windDir: input.windDir ?? "",
      obsTimeLocal: input.timestamp
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
// SYNTH HEALTH PANEL
// ============================================================
function renderSynthHealth(today, tomorrow) {
  const panel = $("synth-health");
  if (!panel) return;

  panel.innerHTML = `
    <div class="synth-health-card">
      <div><strong>Synth Version:</strong> ${today.version ?? "n/a"}</div>
      <div><strong>Today Category:</strong> ${today.category ?? "n/a"}</div>
      <div><strong>Tomorrow Category:</strong> ${tomorrow.category ?? "n/a"}</div>
      <div><strong>Today Bullets:</strong> ${Array.isArray(today.bullets) ? today.bullets.length : 0}</div>
      <div><strong>Tomorrow Bullets:</strong> ${Array.isArray(tomorrow.bullets) ? tomorrow.bullets.length : 0}</div>
      <div><strong>Goldilocks Today:</strong> ${today.goldilocks ? "Yes" : "No"}</div>
      <div><strong>Goldilocks Tomorrow:</strong> ${tomorrow.goldilocks ? "Yes" : "No"}</div>
    </div>
  `;
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

  renderSynthHealth(today, tomorrow);
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
// COMFORT NOW
// ============================================================
function renderComfortNow(container, comfort, bestWindow) {
  if (!container) return;

  const mainLine = comfort.title || comfort.label || "Comfort overview";
  const scoreLine =
    comfort.comfortScore != null
      ? `${Math.round(comfort.comfortScore)} / 100`
      : "-- / 100";

  const explainer =
    comfort.scoreExplainer ||
    "Comfort Score blends temperature, dew point, humidity, wind, and sun angle into a 0–100 scale.";

  container.innerHTML = `
    <div class="comfort-card module-card" data-accordion="comfort-now">
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji || "🌤️"}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>
          <div class="comfort-category">${comfort.category || ""}</div>
          <div class="comfort-text">${mainLine}</div>
          <div class="comfort-sub">${scoreLine}</div>
          <div class="comfort-explainer">${explainer}</div>
        </div>
      </div>

      <div class="comfort-expand">
        <ul class="comfort-bullets">
          ${(comfort.bullets || []).map(b => `<li>${b}</li>`).join("")}
        </ul>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Feels Like</span>
          <span class="comfort-expand-value">
            ${comfort.feelsLike != null ? `${Math.round(comfort.feelsLike)}°` : "--"}
          </span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Humidity</span>
          <span class="comfort-expand-value">
            ${comfort.humidity != null ? `${Math.round(comfort.humidity)}%` : "--"}
          </span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Wind</span>
          <span class="comfort-expand-value">
            ${comfort.wind != null ? `${Math.round(comfort.wind)} mph` : "--"}
          </span>
        </div>

        ${
          bestWindow
            ? `
        <div class="comfort-expand-row" style="margin-top:0.6rem;">
          <span class="comfort-expand-label">Best window (next ${bestWindow.hours.length} hrs)</span>
          <span class="comfort-expand-value">
            ${bestWindow.hours[0].hourLabel}–${bestWindow.hours.at(-1).hourLabel}
          </span>
        </div>

        <div class="fc-strip">
          ${bestWindow.hours
            .map(
              h => `
            <div class="fc-hour">
              <div class="fc-hour-label">${h.hourLabel}</div>
              <div class="fc-hour-main">
                <span class="fc-hour-emoji">${h.emoji}</span>
                <span class="fc-hour-temp">${h.temp != null ? `${Math.round(h.temp)}°` : "--"}</span>
              </div>
              <div class="fc-hour-extra">
                <span class="fc-hour-score">${Math.round(h.comfortScore)}/100</span>
                <span class="fc-hour-label-text">${h.label}</span>
              </div>
            </div>
          `
            )
            .join("")}
        </div>
        `
            : ""
        }

        ${comfort.longNarrative ? `<div class="comfort-long">${comfort.longNarrative}</div>` : ""}
      </div>
    </div>
  `;
}

// ============================================================
// FUTURE COMFORT — NEXT 6 HOURS
// ============================================================
function renderFutureComfort(container, items) {
  if (!container) return;

  container.innerHTML = `
    <div class="future-comfort-card module-card" data-accordion="future-comfort">
      <div class="next6-header">
        <div class="next6-label">Future Comfort</div>
      </div>

      <div class="next6-strip">
        ${items
          .map(h => {
            const temp = h.temp != null && !isNaN(h.temp) ? Math.round(h.temp) : "--";
            return `
              <div class="next6-hour">
                <div class="next6-hour-label">${h.hourLabel}</div>
                <div class="next6-hour-emoji">${h.emoji}</div>
                <div class="next6-hour-temp">${temp}°</div>
                <div class="next6-hour-factor">${h.label}</div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

// ============================================================
// BEST COMFORT WINDOW — 3-HOUR SLIDING WINDOW
// ============================================================
function findBestComfortWindow(hourlyNormalized, windowSize = 3) {
  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length < windowSize) {
    return null;
  }

  const now = Date.now();
  let startIndex = hourlyNormalized.findIndex(h => h.timestamp > now);
  if (startIndex === -1) startIndex = 0;

  const windows = [];

  for (let start = startIndex; start <= hourlyNormalized.length - windowSize; start++) {
    let sum = 0;
    const hours = [];

    for (let i = 0; i < windowSize; i++) {
      const h = hourlyNormalized[start + i];

      const comfort = computeComfort({
        tempF: h.temperatureF,
        dewF: h.dewpointF,
        wind: h.wind_speed,
        windDir: h.wind_dir,
        timestamp: h.timestamp
      });

      hours.push({
        hourLabel: formatHourLabel(h.timestamp),
        temp: h.temperatureF,
        dew: h.dewpointF,
        comfortScore: comfort.comfortScore,
        emoji: comfort.emoji,
        label: comfort.label
      });

      sum += comfort.comfortScore;
    }

    windows.push({
      startIndex: start,
      avgScore: sum / windowSize,
      hours
    });
  }

  windows.sort((a, b) => b.avgScore - a.avgScore);
  return windows[0];
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
// MAIN ENTRY — FULL PIPELINE (CLEANED + DEBUG EXPORTS)
// ============================================================
export async function renderWeather({ lat, lon, tempestStationId, tempestToken }) {
  const raw = await fetchAllIntel({ lat, lon, tempestStationId, tempestToken });

  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);
  const current = resolveCurrentConditions(raw, hourlyNormalized);

  updateDataSourceIndicator(raw);
  renderCurrentObservations(current);

  // HUMAN ACTION INTEL + SYNTH
  const intelRaw = buildHumanActionIntel(raw);
  const { today: todayNarr, tomorrow: tomorrowNarr } = generateNarrative(
    intelRaw.today,
    intelRaw.tomorrow
  );

  renderHumanAction(todayNarr, tomorrowNarr);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);

  // COMFORT NOW
  const comfortNow = computeComfort(current);

  comfortNow.humidity = current.humidity;
  comfortNow.wind = current.wind;

  const score = comfortNow.comfortScore;

  comfortNow.category =
    score >= 80
      ? "Very Comfortable"
      : score >= 65
      ? "Comfortable"
      : score >= 50
      ? "Slightly Uncomfortable"
      : score >= 35
      ? "Uncomfortable"
      : "Harsh / Poor Comfort";

  const comfortNowForRender = {
    ...comfortNow,
    title: comfortNow.line1 ?? comfortNow.summary ?? "Comfort overview",
    bullets: Array.isArray(comfortNow.bullets) ? comfortNow.bullets : [],
    emoji: comfortNow.emoji ?? "🌤️",
    longNarrative: comfortNow.line2 ?? ""
  };

  const bestWindow = findBestComfortWindow(hourlyNormalized);

  // FUTURE COMFORT
  const futureComfort = buildFutureComfort(hourlyNormalized, computeComfortLegacy);

  // RENDER MODULES
  renderComfortNow($("comfort-now-container"), comfortNowForRender, bestWindow);
  renderFutureComfort($("future-comfort-container"), futureComfort);

  initializeAccordion();

  // DEBUG
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