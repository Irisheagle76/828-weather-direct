// /js/weather-render.js
console.log("RENDER v8 LOADED FROM:", import.meta.url);

// ============================================================
// IMPORTS
// ============================================================
import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort as computeComfortLegacy, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer/index.js?v=4";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";

// ============================================================
// HELPERS
// ============================================================
const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);
const $ = id => document.getElementById(id);

function safeSet(id, prop, value) {
  const el = $(id);
  if (el) el[prop] = value;
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
// CANONICAL CONDITIONS RESOLVER
// ============================================================
function resolveCurrentConditions(raw, hourly) {
  const fallback = hourly?.[0];

  const tempF =
    (raw.tempest?.air_temperature != null ? cToF(raw.tempest.air_temperature) : null) ??
    raw.wu?.imperial?.temp ??
    fallback?.temperatureF ??
    null;

  const dewF =
    (raw.tempest?.dew_point != null ? cToF(raw.tempest.dew_point) : null) ??
    raw.wu?.imperial?.dewpt ??
    fallback?.dewpointF ??
    null;

  const wind =
    raw.tempest?.wind_avg ??
    raw.wu?.imperial?.windSpeed ??
    fallback?.wind_speed ??
    null;

  const gust =
    raw.tempest?.wind_gust ??
    raw.wu?.imperial?.windGust ??
    fallback?.wind_gust ??
    null;

  const humidity =
    raw.tempest?.relative_humidity ??
    raw.wu?.humidity ??
    fallback?.relative_humidity ??
    null;

  const uv =
    raw.wu?.uv ??
    fallback?.uv_index ??
    0;

  const timestamp =
    raw.tempest?.timestamp ??
    raw.wu?.obsTimeLocal ??
    fallback?.timestamp ??
    Date.now();

  return { tempF, dewF, wind, gust, humidity, uv, timestamp };
}

// ============================================================
// MODERN COMFORT WRAPPER
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
// CURRENT OBSERVATIONS
// ============================================================
function renderCurrentObservations(c) {
  const wrap = $("current-obs-wrapper");
  if (wrap) wrap.classList.add("module-card");

  const container = $("current-obs-inline");
  if (!container) return;

  container.innerHTML = `
    <div class="obs-line">
      <span class="obs-item">Temp <strong>${c.tempF != null ? Math.round(c.tempF) + "°" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">Dew <strong>${c.dewF != null ? Math.round(c.dewF) + "°" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">Humidity <strong>${c.humidity != null ? Math.round(c.humidity) + "%" : "--"}</strong></span>
    </div>

    <div class="obs-line">
      <span class="obs-item">Wind <strong>${c.wind != null ? Math.round(c.wind) + " mph" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">Gusts <strong>${c.gust != null ? Math.round(c.gust) + " mph" : "--"}</strong></span>
      <span class="obs-dot">•</span>
      <span class="obs-item">UV <strong>${c.uv}</strong></span>
    </div>
  `;
}

// ============================================================
// SYNTHESIZER HEALTH PANEL
// ============================================================
function renderSynthHealth(today, tomorrow) {
  const panel = $("synth-health");
  if (!panel) return;

  panel.innerHTML = `
    <div class="synth-health-card">
      <div><strong>Synthesizer Version:</strong> ${today.version}</div>
      <div><strong>Today Category:</strong> ${today.category}</div>
      <div><strong>Tomorrow Category:</strong> ${tomorrow.category}</div>
      <div><strong>Today Bullets:</strong> ${today.bullets.length}</div>
      <div><strong>Tomorrow Bullets:</strong> ${tomorrow.bullets.length}</div>
      <div><strong>Goldilocks Today:</strong> ${today.isGoldilocks}</div>
      <div><strong>Goldilocks Tomorrow:</strong> ${tomorrow.isGoldilocks}</div>
    </div>
  `;

  console.log("ACTIVE SYNTH VERSION (TODAY):", today.version);
  console.log("ACTIVE SYNTH VERSION (TOMORROW):", tomorrow.version);
}

// ============================================================
// HUMAN ACTION
// ============================================================
function renderHumanAction(today, tomorrow) {
  safeSet("today-header", "textContent", getTodayLabelFromLocalTime());
  safeSet("today-emoji", "textContent", today.emoji);
  safeSet("today-headline", "textContent", today.title);
  safeSet("today-text", "textContent", today.narrative);
  safeHTML("today-bullets", today.bullets.map(b => `<li>${b}</li>`).join(""));

  safeSet("tomorrow-header", "textContent", "Tomorrow’s Outlook");
  safeSet("tomorrow-emoji", "textContent", tomorrow.emoji);
  safeSet("tomorrow-headline", "textContent", tomorrow.title);
  safeSet("tomorrow-text", "textContent", tomorrow.narrative);
  safeHTML("tomorrow-bullets", tomorrow.bullets.map(b => `<li>${b}</li>`).join(""));

  const tg = $("today-goldilocks");
  if (tg) tg.style.display = today.isGoldilocks ? "inline-block" : "none";

  const mg = $("tomorrow-goldilocks");
  if (mg) mg.style.display = tomorrow.isGoldilocks ? "inline-block" : "none";

  renderSynthHealth(today, tomorrow);
}

// ============================================================
// BEST WINDOW
// ============================================================
function findBestComfortWindow(hourly, windowSize = 3) {
  if (!hourly || hourly.length < windowSize) return null;

  let best = null;

  for (let i = 0; i <= hourly.length - windowSize; i++) {
    let sum = 0;
    const hours = [];

    for (let j = 0; j < windowSize; j++) {
      const h = hourly[i + j];

      const comfort = computeComfort({
        tempF: h.temperatureF,
        dewF: h.dewpointF,
        wind: h.wind_speed,
        timestamp: h.timestamp
      });

      sum += comfort.comfortScore;

      hours.push({
        hourLabel: formatHourLabel(h.timestamp),
        temp: h.temperatureF,
        emoji: comfort.emoji,
        label: comfort.label,
        score: comfort.comfortScore
      });
    }

    const avg = sum / windowSize;

    if (!best || avg > best.avg) {
      best = { avg, hours };
    }
  }

  return best;
}

// ============================================================
// ACCORDION
// ============================================================
function initializeAccordion() {
  document.addEventListener("click", e => {
    const mod = e.target.closest(".comfort-module, .next6-module, .action-module");
    if (!mod) return;

    const all = document.querySelectorAll(".comfort-module, .next6-module, .action-module");
    const active = mod.classList.contains("active");

    all.forEach(m => m.classList.remove("active"));
    if (!active) mod.classList.add("active");
  });
}

// ============================================================
// MAIN
// ============================================================
export async function renderWeather({ lat, lon, tempestDeviceId, tempestToken }) {
  const raw = await fetchAllIntel({ lat, lon, tempestDeviceId, tempestToken });

  const hourly = normalizeOpenMeteo(raw.hourly);
  const current = resolveCurrentConditions(raw, hourly);

  renderCurrentObservations(current);

  // HUMAN ACTION
  const intel = buildHumanActionIntel(raw);
  const { today, tomorrow } = generateNarrative(intel.today, intel.tomorrow);

  renderHumanAction(today, tomorrow);

  // COMFORT NOW
  const comfortNow = computeComfort(current);
  comfortNow.humidity = current.humidity;
  comfortNow.wind = current.wind;

  const score = comfortNow.comfortScore;

  comfortNow.category =
    score >= 80 ? "Very Comfortable" :
    score >= 65 ? "Comfortable" :
    score >= 50 ? "Slightly Uncomfortable" :
    score >= 35 ? "Uncomfortable" :
    "Harsh";

  const bestWindow = findBestComfortWindow(hourly);

  const container = $("comfort-now-container");
  if (container) {
    container.innerHTML = `
      <div class="comfort-module module-card">
        <div>${comfortNow.emoji}</div>
        <div>${comfortNow.category}</div>
        <div>${Math.round(score)} / 100</div>
      </div>
    `;
  }

  const future = buildFutureComfort(hourly, computeComfortLegacy);

  const fc = $("future-comfort-container");
  if (fc) {
    fc.innerHTML = future.map(h => `
      <div>${h.hourLabel} ${Math.round(h.temp)}°</div>
    `).join("");
  }

  initializeAccordion();

  // DEBUG
  window._raw = raw;
  window._current = current;
  window._hourly = hourly;
  window._todayNarr = today;
  window._tomorrowNarr = tomorrow;
}
