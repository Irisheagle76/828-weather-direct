// /js/weather-render.js
// ============================================================
// FINAL RENDERER — MODERNIZED, CACHED, AND COMPATIBLE
// Works with: HA 2.3, comfort.js rewrite, current app.js
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

// Simple DOM helper to avoid repeated lookups
function $(id) {
  return document.getElementById(id);
}

// ------------------------------------------------------------
// CURRENT OBSERVATIONS
// ------------------------------------------------------------

function renderCurrentObservations(raw) {
  console.log("🌡️ CURRENT OBS RAW:", raw);

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

  const tempEl = $("wu-temp");
  const feelsEl = $("wu-feels");
  const dewEl = $("wu-dew");
  const humEl = $("wu-humidity");
  const windEl = $("wu-wind");
  const gustEl = $("wu-wind-gust");
  const uvEl = $("wu-uv");

  if (tempEl) tempEl.textContent = temp != null ? `${Math.round(temp)}°` : "--";
  if (feelsEl) feelsEl.textContent = feels != null ? `Feels like ${Math.round(feels)}°` : "Feels like --";
  if (dewEl) dewEl.textContent = dew != null ? `${Math.round(dew)}°` : "--";
  if (humEl) humEl.textContent = humidity != null ? `Humidity ${Math.round(humidity)}%` : "Humidity --";
  if (windEl) windEl.textContent = wind != null ? `${Math.round(wind)} mph` : "--";
  if (gustEl) gustEl.textContent = gust != null ? `Gusts ${Math.round(gust)} mph` : "Gusts --";
  if (uvEl) uvEl.textContent = uv != null ? `${Math.round(uv)}` : "--";
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
  console.log("🧠 NARRATIVE FOR PERIOD:", { period, narrative });

  return {
    ...period,
    emoji: narrative?.emoji ?? "🌤️",
    title: narrative?.title ?? "Outlook",
    notes: narrative?.main ?? "",
    secondaryFactors: narrative?.bullets ?? []
  };
}

// ------------------------------------------------------------
// HUMAN-ACTION RENDERING
// ------------------------------------------------------------

function renderHumanAction(today, tomorrow) {
  console.log("🔵 HUMAN-ACTION TODAY (legacy-mapped):", today);
  console.log("🔵 HUMAN-ACTION TOMORROW (legacy-mapped):", tomorrow);

  const todayEmoji = $("today-emoji");
  const todayHeadline = $("today-headline");
  const todayText = $("today-text");
  const todayBullets = $("today-bullets");

  const tomorrowEmoji = $("tomorrow-emoji");
  const tomorrowHeadline = $("tomorrow-headline");
  const tomorrowText = $("tomorrow-text");
  const tomorrowBullets = $("tomorrow-bullets");

  if (today) {
    if (todayEmoji) todayEmoji.textContent = today.emoji;
    if (todayHeadline) todayHeadline.textContent = today.title;
    if (todayText) todayText.textContent = today.notes;
    if (todayBullets) {
      todayBullets.innerHTML = today.secondaryFactors
        .map(b => `<li>${b}</li>`)
        .join("");
    }
  }

  if (tomorrow) {
    if (tomorrowEmoji) tomorrowEmoji.textContent = tomorrow.emoji;
    if (tomorrowHeadline) tomorrowHeadline.textContent = tomorrow.title;
    if (tomorrowText) tomorrowText.textContent = tomorrow.notes;
    if (tomorrowBullets) {
      tomorrowBullets.innerHTML = tomorrow.secondaryFactors
        .map(b => `<li>${b}</li>`)
        .join("");
    }
  }
}

function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  console.log("🔵 HUMAN-ACTION EXPANDED INTEL:", {
    todayIntel,
    tomorrowIntel
  });

  const todayPanel = $("expanded-today");
  const tomorrowPanel = $("expanded-tomorrow");

  const buildBlock = (label, intel) => {
    if (!intel || !intel.snapshot) return "";

    const s = intel.snapshot;

    const high = intel.high ?? s.temp ?? null;
    const low  = intel.low  ?? null;

    const dewPoint   = s.dewpoint ?? null;
    const windSpeed  = s.windSpeed ?? null;
    const windGust   = s.windGust ?? null;
    const precipType = s.precipType ?? intel.precipType ?? "";
    const precipChance = intel.precipChance ?? null;

    return `
      <div class="fx-section">
        <div class="fx-label">${label}</div>
        <div class="fx-grid">
          <div class="fx-tile">
            <div class="fx-top">
              ${high != null
                ? `${Math.round(high)}°${low != null ? " / " + Math.round(low) + "°" : ""}`
                : "--"}
            </div>
            <div class="fx-sub">High / Low</div>
            <div class="fx-label">Temperature</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${dewPoint != null ? `${Math.round(dewPoint)}°` : "--"}
            </div>
            <div class="fx-sub">Dew Point</div>
            <div class="fx-label">Moisture</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${windSpeed != null ? `${Math.round(windSpeed)} mph` : "--"}
            </div>
            <div class="fx-sub">
              ${windGust != null ? `Gusts ${Math.round(windGust)} mph` : ""}
            </div>
            <div class="fx-label">Wind</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${precipChance != null ? `${precipChance}%` : "--"}
            </div>
            <div class="fx-sub">
              ${precipType}
            </div>
            <div class="fx-label">Precipitation</div>
          </div>
        </div>
      </div>
    `;
  };

  if (todayPanel) {
    todayPanel.innerHTML = buildBlock("Today’s Forecast", todayIntel);
  }

  if (tomorrowPanel) {
    tomorrowPanel.innerHTML = buildBlock("Tomorrow’s Forecast", tomorrowIntel);
  }
}

// ------------------------------------------------------------
// COMFORT NOW RENDERING
// ------------------------------------------------------------

function renderComfortNow(container, comfort, bestWindow) {
  console.log("🟠 COMFORT NOW INPUT:", comfort);
  console.log("🟠 COMFORT BEST WINDOW:", bestWindow);

  const hour = new Date().getHours();
  let periodLabel = "Today";
  if (hour >= 15) periodLabel = "Tonight";
  if (hour >= 18) periodLabel = "This Evening";
  if (hour < 6)  periodLabel = "Early Morning";

  const mainLine = comfort.line1 || comfort.summary || comfort.label;
  const subLine  = comfort.line2 || "";

  container.innerHTML = `
    <div class="comfort-module fade-in">
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

        ${subLine
          ? `<div class="comfort-extra-line">${subLine}</div>`
          : ""}

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
// FUTURE COMFORT RENDERING
// ------------------------------------------------------------

function renderFutureComfort(container, items) {
  console.log("🟣 FUTURE COMFORT INPUT TO RENDERER:", items);

  container.innerHTML = `
    <div class="next6-module fade-in">
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
// ACCORDION — ONE MODULE OPEN AT A TIME
// ------------------------------------------------------------

function initializeAccordion() {
  console.log("🟡 INITIALIZING ACCORDION");

  const modules = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  console.log("🟡 ACCORDION MODULE COUNT:", modules.length);

  // Remove old listeners by cloning
  modules.forEach(module => {
    const clone = module.cloneNode(true);
    module.parentNode.replaceChild(clone, module);
  });

  const freshModules = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  freshModules.forEach(module => {
    module.addEventListener("click", () => {
      const isActive = module.classList.contains("active");

      freshModules.forEach(m => m.classList.remove("active"));

      if (!isActive) {
        module.classList.add("active");
      }
    });
  });
}

// ------------------------------------------------------------
// BEST COMFORT WINDOW (ARRAY-SHAPE AWARE)
// ------------------------------------------------------------

function findBestComfortWindow(hourlyNormalized, computeComfortFn, windowSize = 3) {
  console.log("🟠 FIND BEST COMFORT WINDOW — INPUT:", hourlyNormalized);

  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length < windowSize) {
    return null;
  }

  const windows = [];

  for (let start = 0; start <= hourlyNormalized.length - windowSize; start++) {
    let sum = 0;
    const hours = [];

    for (let i = 0; i < windowSize; i++) {
      const idx = start + i;
      const h = hourlyNormalized[idx];

      const tempF = h.temperature != null ? cToF(h.temperature) : null;
      const dewF  = h.dewpoint != null ? cToF(h.dewpoint) : null;

      const intelForHour = {
        tempest: null,
        wu: {
          temp: tempF,
          dewPoint: dewF,
          windSpeed: h.wind_speed ?? 0,
          windDir: h.windDir ?? h.windDirection ?? "",
          obsTimeLocal: h.timestamp
        },
        hourly: hourlyNormalized
      };

      const c = computeComfortFn(intelForHour);
      sum += c.comfortScore;

      hours.push({
        time: h.timestamp,
        hourLabel: h.timestamp ? formatHourLabel(h.timestamp) : `+${i}h`,
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
  const best = windows[0] ?? null;

  console.log("🟠 BEST COMFORT WINDOW:", best);
  return best;
}

// ------------------------------------------------------------
// MAIN ENTRY — EXPORT
// ------------------------------------------------------------

export async function renderWeather({
  lat,
  lon,
  tempestDeviceId,
  tempestToken
}) {
  console.log("🌎 RENDER WEATHER START", { lat, lon });

  const raw = await fetchAllIntel({
    lat,
    lon,
    tempestDeviceId,
    tempestToken
  });

  console.log("🌎 RAW FETCHED INTEL:", raw);

  updateDataSourceIndicator(raw);
  renderCurrentObservations(raw);

  // HUMAN ACTION INTEL
  const intelRaw = buildHumanActionIntel(raw);
  console.log("🔵 HUMAN-ACTION INTEL RAW:", intelRaw);

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

  console.log("🟠 COMFORT NOW (computed):", comfortNow);

  // Add humidity + wind for Comfort Now panel
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
  console.log("🟣 NORMALIZED HOURLY:", hourlyNormalized);

  // FUTURE COMFORT (next 6 hours)
  const futureComfort = buildFutureComfort(hourlyNormalized, computeComfort);
  console.log("🟣 FUTURE COMFORT (computed):", futureComfort);

  // BEST COMFORT WINDOW
  const bestWindow = findBestComfortWindow(hourlyNormalized, computeComfort);

  // RENDER MODULES
  const comfortNowEl = $("comfort-now-container");
  const futureComfortEl = $("future-comfort-container");

  if (comfortNowEl) renderComfortNow(comfortNowEl, comfortNow, bestWindow);
  if (futureComfortEl) renderFutureComfort(futureComfortEl, futureComfort);

  // ACCORDION
  initializeAccordion();

  console.log("🌎 RENDER WEATHER COMPLETE");
}
