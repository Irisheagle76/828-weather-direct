// /js/weather-render.js
// ============================================================
// FINAL RENDERER — MODERNIZED, CLEAN, AND FULLY FUNCTIONAL
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);

function formatHourLabel(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

function $(id) {
  return document.getElementById(id);
}

// ------------------------------------------------------------
// CURRENT OBSERVATIONS (now wrapped in a module card)
// ------------------------------------------------------------

function renderCurrentObservations(raw) {
  const wrap = $("current-obs-wrapper");
  if (wrap) wrap.classList.add("module-card");

  const t = raw?.tempest;
  const wu = raw?.wu;
  const h = raw?.hourly;

  const temp =
    (t?.air_temperature != null ? cToF(t.air_temperature) : null) ??
    wu?.imperial?.temp ??
    h?.temperature_2m?.[0];

  const feels =
    (t?.feels_like != null ? cToF(t.feels_like) : null) ??
    wu?.imperial?.heatIndex ??
    wu?.imperial?.windChill ??
    h?.apparent_temperature?.[0];

  const dew =
    (t?.dew_point != null ? cToF(t.dew_point) : null) ??
    wu?.imperial?.dewpt ??
    h?.dewpoint_2m?.[0];

  const humidity =
    t?.relative_humidity ??
    wu?.humidity ??
    h?.relativehumidity_2m?.[0];

  const wind =
    t?.wind_avg ??
    wu?.imperial?.windSpeed ??
    h?.wind_speed_10m?.[0];

  const gust =
    t?.wind_gust ??
    wu?.imperial?.windGust ??
    h?.wind_gusts_10m?.[0];

  const uv =
    wu?.uv ??
    h?.uv_index?.[0] ??
    0;

  $("wu-temp").textContent = temp != null ? `${Math.round(temp)}°` : "--";
  $("wu-feels").textContent = feels != null ? `Feels like ${Math.round(feels)}°` : "Feels like --";
  $("wu-dew").textContent = dew != null ? `${Math.round(dew)}°` : "--";
  $("wu-humidity").textContent = humidity != null ? `Humidity ${Math.round(humidity)}%` : "Humidity --";
  $("wu-wind").textContent = wind != null ? `${Math.round(wind)} mph` : "--";
  $("wu-wind-gust").textContent = gust != null ? `Gusts ${Math.round(gust)} mph` : "Gusts --";
  $("wu-uv").textContent = uv != null ? `${Math.round(uv)}` : "--";
}

// ------------------------------------------------------------
// DATA SOURCE INDICATOR
// ------------------------------------------------------------

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

// ------------------------------------------------------------
// MAP HUMAN-ACTION TO LEGACY UI
// ------------------------------------------------------------

function mapToLegacyFields(period) {
  if (!period) return null;

  const narrative = generateNarrative(period);

  return {
    ...period,
    emoji: narrative?.emoji ?? "🌤️",
    title: narrative?.title ?? "Outlook",
    notes: narrative?.main ?? "",
    secondaryFactors: narrative?.bullets ?? []
  };
}

// ------------------------------------------------------------
// HUMAN-ACTION RENDERING (with headers + collapsed by default)
// ------------------------------------------------------------

function renderHumanAction(today, tomorrow) {
  // TODAY
  $("today-header").textContent = "Today’s Outlook";
  $("today-emoji").textContent = today.emoji;
  $("today-headline").textContent = today.title;
  $("today-text").textContent = today.notes;
  $("today-bullets").innerHTML = today.secondaryFactors.map(b => `<li>${b}</li>`).join("");

  // TOMORROW
  $("tomorrow-header").textContent = "Tomorrow’s Outlook";
  $("tomorrow-emoji").textContent = tomorrow.emoji;
  $("tomorrow-headline").textContent = tomorrow.title;
  $("tomorrow-text").textContent = tomorrow.notes;
  $("tomorrow-bullets").innerHTML = tomorrow.secondaryFactors.map(b => `<li>${b}</li>`).join("");
}

// ------------------------------------------------------------
// HUMAN-ACTION EXPANDED (REAL DATA FROM SNAPSHOT)
// ------------------------------------------------------------

function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  const build = (intel) => {
    if (!intel || !intel.snapshot) return "";

    const s = intel.snapshot;

    const high = intel.high ?? s.temp ?? null;
    const low = intel.low ?? null;
    const dew = s.dewpoint ?? null;
    const wind = s.windSpeed ?? null;
    const gust = s.windGust ?? null;
    const precipType = s.precipType ?? intel.precipType ?? "";
    const precipChance = intel.precipChance ?? null;

    return `
      <div class="fx-grid">
        <div class="fx-tile">
          <div class="fx-top">${high != null ? `${Math.round(high)}°${low != null ? " / " + Math.round(low) + "°" : ""}` : "--"}</div>
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

  $("expanded-today").innerHTML = build(todayIntel);
  $("expanded-tomorrow").innerHTML = build(tomorrowIntel);
}
// ------------------------------------------------------------
// COMFORT NOW — RICHER NARRATIVE
// ------------------------------------------------------------

function renderComfortNow(container, comfort, bestWindow) {
  const hour = new Date().getHours();
  let periodLabel = "Today";
  if (hour >= 15) periodLabel = "Tonight";
  if (hour >= 18) periodLabel = "This Evening";
  if (hour < 6) periodLabel = "Early Morning";

  const mainLine = comfort.line1 || comfort.summary || comfort.label;
  const subLine = comfort.line2 || "";

  container.innerHTML = `
    <div class="comfort-module module-card">
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">${periodLabel} Comfort</div>
          <div class="comfort-text">${mainLine}</div>
          <div class="comfort-sub">${comfort.comfortScore} / 100</div>
        </div>
      </div>

      <div class="comfort-expand">
        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Feels Like</span>
          <span class="comfort-expand-value">${Math.round(comfort.feelsLike)}°</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Humidity</span>
          <span class="comfort-expand-value">${comfort.humidity ?? "--"}%</span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Wind</span>
          <span class="comfort-expand-value">${comfort.wind ?? "--"} mph</span>
        </div>

        ${subLine ? `<div class="comfort-extra-line">${subLine}</div>` : ""}

        ${
          bestWindow
            ? `
        <div class="comfort-expand-row" style="margin-top:0.6rem;">
          <span class="comfort-expand-label">Best window (next ${bestWindow.hours.length} hrs)</span>
          <span class="comfort-expand-value">
            ${bestWindow.hours[0].hourLabel}–${bestWindow.hours[bestWindow.hours.length - 1].hourLabel}
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
                <span class="fc-hour-temp">${Math.round(h.temp)}°</span>
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
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// FUTURE COMFORT — REAL TIMESTAMPS
// ------------------------------------------------------------

function renderFutureComfort(container, items) {
  container.innerHTML = `
    <div class="next6-module module-card">
      <div class="next6-header">
        <div class="next6-label">Next 6 Hours</div>
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

// ------------------------------------------------------------
// ACCORDION — CLEAN, ONE OPEN AT A TIME
// ------------------------------------------------------------

function initializeAccordion() {
  const modules = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  modules.forEach(module => {
    const clone = module.cloneNode(true);
    module.parentNode.replaceChild(clone, module);
  });

  const fresh = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  fresh.forEach(module => {
    module.classList.remove("active");

    module.addEventListener("click", () => {
      const isActive = module.classList.contains("active");
      fresh.forEach(m => m.classList.remove("active"));
      if (!isActive) module.classList.add("active");
    });
  });
}

// ------------------------------------------------------------
// BEST COMFORT WINDOW
// ------------------------------------------------------------

function findBestComfortWindow(hourlyNormalized, computeComfortFn, windowSize = 3) {
  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length < windowSize) {
    return null;
  }

  const windows = [];

  for (let start = 0; start <= hourlyNormalized.length - windowSize; start++) {
    let sum = 0;
    const hours = [];

    for (let i = 0; i < windowSize; i++) {
      const h = hourlyNormalized[start + i];

      const tempF = h.temperature != null ? cToF(h.temperature) : null;
      const dewF = h.dewpoint != null ? cToF(h.dewpoint) : null;

      const intelForHour = {
        tempest: null,
        wu: {
          temp: tempF,
          dewPoint: dewF,
          windSpeed: h.wind_speed ?? 0,
          windDir: h.windDir ?? "",
          obsTimeLocal: h.timestamp
        },
        hourly: hourlyNormalized
      };

      const c = computeComfortFn(intelForHour);
      sum += c.comfortScore;

      hours.push({
        time: h.timestamp,
        hourLabel: formatHourLabel(h.timestamp),
        comfortScore: c.comfortScore,
        emoji: c.emoji,
        temp: tempF,
        label: c.label
      });
    }

    windows.push({
      startIndex: start,
      avgScore: sum / windowSize,
      hours
    });
  }

  windows.sort((a, b) => b.avgScore - a.avgScore);
  return windows[0] ?? null;
}
// ------------------------------------------------------------
// MAIN ENTRY
// ------------------------------------------------------------

export async function renderWeather({
  lat,
  lon,
  tempestDeviceId,
  tempestToken
}) {
  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  updateDataSourceIndicator(raw);
  renderCurrentObservations(raw);

  // HUMAN ACTION
  const intelRaw = buildHumanActionIntel(raw);
  const today = mapToLegacyFields(intelRaw.today);
  const tomorrow = mapToLegacyFields(intelRaw.tomorrow);

  renderHumanAction(today, tomorrow);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);

  // COMFORT NOW
  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly
  });

  comfortNow.humidity =
    raw.tempest?.relative_humidity ??
    raw.wu?.humidity ??
    raw.hourly?.relativehumidity_2m?.[0] ??
    null;

  comfortNow.wind =
    raw.tempest?.wind_avg ??
    raw.wu?.imperial?.windSpeed ??
    raw.hourly?.wind_speed_10m?.[0] ??
    null;

  // NORMALIZED HOURLY
  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);

  // FUTURE COMFORT
  const futureComfort = buildFutureComfort(hourlyNormalized, computeComfort);

  // BEST WINDOW
  const bestWindow = findBestComfortWindow(hourlyNormalized, computeComfort);

  // RENDER MODULES
  renderComfortNow($("comfort-now-container"), comfortNow, bestWindow);
  renderFutureComfort($("future-comfort-container"), futureComfort);

  // ACCORDION
  initializeAccordion();
}