// /js/weather-render.js
// ============================================================
// FINAL RENDERER — MODERNIZED + DIAGNOSTIC LOGS
// ============================================================

import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort as comfortBuildFuture } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer.js";
import { normalizeOpenMeteo } from "./intel/normalize-hourly.js";

// ============================================================
// HELPERS
// ============================================================

const cToF = c => (c != null ? (c * 9) / 5 + 32 : null);

function formatHourLabel(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}${ampm}`;
}

// ============================================================
// CURRENT OBSERVATIONS
// ============================================================

function renderCurrentObservations(raw) {
  console.log("🌡️ RENDER CURRENT OBS — RAW:", raw);

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

  document.getElementById("wu-temp").textContent =
    temp != null ? `${Math.round(temp)}°` : "--";

  document.getElementById("wu-feels").textContent =
    feels != null ? `Feels like ${Math.round(feels)}°` : "Feels like --";

  document.getElementById("wu-dew").textContent =
    dew != null ? `${Math.round(dew)}°` : "--";

  document.getElementById("wu-humidity").textContent =
    humidity != null ? `Humidity ${Math.round(humidity)}%` : "Humidity --";

  document.getElementById("wu-wind").textContent =
    wind != null ? `${Math.round(wind)} mph` : "--";

  document.getElementById("wu-wind-gust").textContent =
    gust != null ? `Gusts ${Math.round(gust)} mph` : "Gusts --";

  document.getElementById("wu-uv").textContent =
    uv != null ? `${Math.round(uv)}` : "--";
}

// ============================================================
// DATA SOURCE INDICATOR
// ============================================================

function updateDataSourceIndicator(raw) {
  console.log("📡 DATA SOURCE INDICATOR RAW:", raw);

  const label = document.getElementById("wu-status-label");
  const text = document.getElementById("wu-status-text");
  const dot = document.getElementById("wu-status-dot");

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
// MAP ENGINE → UI
// ============================================================

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

// ============================================================
// HUMAN-ACTION RENDERING
// ============================================================

function renderHumanAction(today, tomorrow) {
  console.log("🔵 HUMAN-ACTION TODAY (legacy-mapped):", today);
  console.log("🔵 HUMAN-ACTION TOMORROW (legacy-mapped):", tomorrow);

  const todayEmoji = document.getElementById("today-emoji");
  const todayHeadline = document.getElementById("today-headline");
  const todayText = document.getElementById("today-text");
  const todayBullets = document.getElementById("today-bullets");

  const tomorrowEmoji = document.getElementById("tomorrow-emoji");
  const tomorrowHeadline = document.getElementById("tomorrow-headline");
  const tomorrowText = document.getElementById("tomorrow-text");
  const tomorrowBullets = document.getElementById("tomorrow-bullets");

  if (today) {
    todayEmoji.textContent = today.emoji;
    todayHeadline.textContent = today.title;
    todayText.textContent = today.notes;

    todayBullets.innerHTML = today.secondaryFactors
      .map(b => `<li>${b}</li>`)
      .join("");
  }

  if (tomorrow) {
    tomorrowEmoji.textContent = tomorrow.emoji;
    tomorrowHeadline.textContent = tomorrow.title;
    tomorrowText.textContent = tomorrow.notes;

    tomorrowBullets.innerHTML = tomorrow.secondaryFactors
      .map(b => `<li>${b}</li>`)
      .join("");
  }
}

function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  console.log("🔵 HUMAN-ACTION EXPANDED INTEL:", {
    todayIntel,
    tomorrowIntel
  });

  const todayPanel = document.getElementById("expanded-today");
  const tomorrowPanel = document.getElementById("expanded-tomorrow");

  if (todayIntel && todayPanel) {
    todayPanel.innerHTML = `
      <div class="fx-section">
        <div class="fx-label">Today’s Forecast</div>
        <div class="fx-grid">
          <div class="fx-tile">
            <div class="fx-top">
              ${todayIntel.high != null && todayIntel.low != null
                ? `${Math.round(todayIntel.high)}° / ${Math.round(todayIntel.low)}°`
                : "--"}
            </div>
            <div class="fx-sub">High / Low</div>
            <div class="fx-label">Temperature</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${todayIntel.dewPoint != null ? `${Math.round(todayIntel.dewPoint)}°` : "--"}
            </div>
            <div class="fx-sub">Dew Point</div>
            <div class="fx-label">Moisture</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${todayIntel.windSpeed != null ? `${Math.round(todayIntel.windSpeed)} mph` : "--"}
            </div>
            <div class="fx-sub">
              ${todayIntel.windGust != null ? `Gusts ${Math.round(todayIntel.windGust)} mph` : ""}
            </div>
            <div class="fx-label">Wind</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${todayIntel.precipChance != null ? `${todayIntel.precipChance}%` : "--"}
            </div>
            <div class="fx-sub">
              ${todayIntel.precipType ?? ""}
            </div>
            <div class="fx-label">Precipitation</div>
          </div>
        </div>
      </div>
    `;
  }

  if (tomorrowIntel && tomorrowPanel) {
    tomorrowPanel.innerHTML = `
      <div class="fx-section">
        <div class="fx-label">Tomorrow’s Forecast</div>
        <div class="fx-grid">
          <div class="fx-tile">
            <div class="fx-top">
              ${tomorrowIntel.high != null && tomorrowIntel.low != null
                ? `${Math.round(tomorrowIntel.high)}° / ${Math.round(tomorrowIntel.low)}°`
                : "--"}
            </div>
            <div class="fx-sub">High / Low</div>
            <div class="fx-label">Temperature</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${tomorrowIntel.dewPoint != null ? `${Math.round(tomorrowIntel.dewPoint)}°` : "--"}
            </div>
            <div class="fx-sub">Dew Point</div>
            <div class="fx-label">Moisture</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${tomorrowIntel.windSpeed != null ? `${Math.round(tomorrowIntel.windSpeed)} mph` : "--"}
            </div>
            <div class="fx-sub">
              ${tomorrowIntel.windGust != null ? `Gusts ${Math.round(tomorrowIntel.windGust)} mph` : ""}
            </div>
            <div class="fx-label">Wind</div>
          </div>
          <div class="fx-tile">
            <div class="fx-top">
              ${tomorrowIntel.precipChance != null ? `${tomorrowIntel.precipChance}%` : "--"}
            </div>
            <div class="fx-sub">
              ${tomorrowIntel.precipType ?? ""}
            </div>
            <div class="fx-label">Precipitation</div>
          </div>
        </div>
      </div>
    `;
  }
}

// ============================================================
// COMFORT MODULE RENDERING
// ============================================================

function renderComfortNow(container, comfort, bestWindow) {
  console.log("🟠 COMFORT NOW INPUT:", comfort);
  console.log("🟠 COMFORT BEST WINDOW:", bestWindow);

  container.innerHTML = `
    <div class="comfort-module fade-in">
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>
          <div class="comfort-text">${comfort.label}</div>
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

function renderFutureComfort(container, items) {
  console.log("🟣 FUTURE COMFORT INPUT TO RENDERER:", items);

  container.innerHTML = `
    <div class="next6-module fade-in">
      <div class="next6-header">
        <div class="next6-label">Next 6 Hours</div>
      </div>

      <div class="next6-strip">
        ${items
          .map(
            h => `
          <div class="next6-hour">
            <div class="next6-hour-label">${h.hourLabel}</div>
            <div class="next6-hour-emoji">${h.emoji}</div>
            <div class="next6-hour-temp">${Math.round(h.temp)}°</div>
            <div class="next6-hour-factor">${h.label}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

// ============================================================
// ACCORDION — ONE MODULE OPEN AT A TIME (SAFE VERSION)
// ============================================================

function initializeAccordion() {
  console.log("🟡 INITIALIZING ACCORDION");

  const modules = document.querySelectorAll(
    ".comfort-module, .next6-module, .action-module"
  );

  console.log("🟡 ACCORDION MODULE COUNT:", modules.length);

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

// ============================================================
// COMFORT WINDOW HELPER (ARRAY-SHAPE AWARE)
// ============================================================

function findBestComfortWindow(hourlyNormalized, computeComfort, windowSize = 3) {
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

      const intelForHour = {
        tempest: null,
        wu: {
          temp: h.temp,
          dewPoint: h.dew ?? h.dewPoint ?? null,
          windSpeed: h.windSpeed,
          windDir: h.windDir ?? h.windDirection ?? "",
          obsTimeLocal: h.time
        },
        hourly: hourlyNormalized
      };

      const c = computeComfort(intelForHour);
      sum += c.comfortScore;

      hours.push({
        time: h.time,
        hourLabel: h.time ? formatHourLabel(h.time) : `+${i}h`,
        comfortScore: c.comfortScore,
        emoji: c.emoji,
        temp: h.temp,
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

// ============================================================
// FUTURE COMFORT BUILDER (ARRAY-SHAPE AWARE)
// ============================================================

export function buildFutureComfort(hourlyNormalized, computeComfortFn = computeComfort) {
  console.log("🟣 BUILD FUTURE COMFORT — RAW HOURLY NORMALIZED:", hourlyNormalized);

  if (!Array.isArray(hourlyNormalized) || hourlyNormalized.length === 0) return [];

  const now = Date.now();

  let startIndex = hourlyNormalized.findIndex(h => {
    if (!h.time) return false;
    return new Date(h.time).getTime() > now;
  });

  if (startIndex === -1) startIndex = 0;

  const items = [];

  for (let i = 0; i < 6; i++) {
    const idx = startIndex + i;
    if (idx >= hourlyNormalized.length) break;

    const h = hourlyNormalized[idx];

    const intelForHour = {
      tempest: null,
      wu: {
        temp: h.temp,
        dewPoint: h.dew ?? h.dewPoint ?? null,
        windSpeed: h.windSpeed,
        windDir: h.windDir ?? h.windDirection ?? "",
        obsTimeLocal: h.time
      },
      hourly: hourlyNormalized
    };

    const c = computeComfortFn(intelForHour);

    items.push({
      index: idx,
      time: h.time,
      hourLabel: h.time ? formatHourLabel(h.time) : `+${i}h`,
      comfortScore: c.comfortScore,
      color: c.color,
      label: c.label,
      emoji: c.emoji,
      temp: h.temp,
      dew: h.dew ?? h.dewPoint ?? null,
      wind: h.windSpeed
    });
  }

  console.log("🟣 FUTURE COMFORT OUTPUT:", items);
  return items;
}

// ============================================================
// MAIN ENTRY
// ============================================================

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

  const intelRaw = buildHumanActionIntel(raw);
  console.log("🔵 HUMAN-ACTION INTEL RAW:", intelRaw);

  const today = mapToLegacyFields(intelRaw.today);
  const tomorrow = mapToLegacyFields(intelRaw.tomorrow);

  renderHumanAction(today, tomorrow);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);

  const comfortNow = computeComfort({
    tempest: raw.tempest,
    wu: raw.wu,
    hourly: raw.hourly
  });

  console.log("🟠 COMFORT NOW (computed):", comfortNow);

  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);
  console.log("🟣 NORMALIZED HOURLY:", hourlyNormalized);

  const futureComfort = buildFutureComfort(hourlyNormalized, computeComfort);
  console.log("🟣 FUTURE COMFORT (computed):", futureComfort);

  const bestWindow = findBestComfortWindow(hourlyNormalized, computeComfort);

  const comfortNowEl = document.getElementById("comfort-now-container");
  const futureComfortEl = document.getElementById("future-comfort-container");

  if (comfortNowEl) renderComfortNow(comfortNowEl, comfortNow, bestWindow);
  if (futureComfortEl) renderFutureComfort(futureComfortEl, futureComfort);

  initializeAccordion();

  console.log("🌎 RENDER WEATHER COMPLETE");
}
