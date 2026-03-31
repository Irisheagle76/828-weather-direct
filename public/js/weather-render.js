// /js/weather-render.js
// ============================================================
// WEATHER RENDERER — CLEAN REWRITE (Render 6.1, Synthesizer-integrated)
// ============================================================
import { fetchAllIntel } from "./weather-fetch.js";
import { buildHumanActionIntel } from "./intel/human-action-intel-builder.js?v=5";
import { computeComfort, buildFutureComfort } from "./intel/comfort.js";
import { generateNarrative } from "./intel/synthesizer/index.js";
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

function getTodayLabelFromLocalTime() {
  const now = new Date();
  const hour = now.getHours();

  if (hour < 12) return "This Morning’s Outlook";
  if (hour < 17) return "This Afternoon’s Outlook";
  if (hour < 21) return "This Evening’s Outlook";
  return "Tonight’s Outlook";
}

// ------------------------------------------------------------
// CURRENT OBSERVATIONS (unchanged from 6.0)
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

  const container = $("current-obs-grid");
  if (container) {
    container.innerHTML = `
      <div class="obs-row">
        <div class="obs-cell">
          <span class="obs-label">Temperature:</span>
          <span class="obs-value">${temp != null ? `${Math.round(temp)}°` : "--"}</span>
        </div>
        <div class="obs-cell">
          <span class="obs-label">Feels like:</span>
          <span class="obs-value">${feels != null ? `${Math.round(feels)}°` : "--"}</span>
        </div>
      </div>

      <div class="obs-row">
        <div class="obs-cell">
          <span class="obs-label">Wind:</span>
          <span class="obs-value">${wind != null ? `${Math.round(wind)} mph` : "--"}</span>
        </div>
        <div class="obs-cell">
          <span class="obs-label">Gusts:</span>
          <span class="obs-value">${gust != null ? `${Math.round(gust)} mph` : "--"}</span>
        </div>
      </div>

      <div class="obs-row">
        <div class="obs-cell">
          <span class="obs-label">Dew Point:</span>
          <span class="obs-value">${dew != null ? `${Math.round(dew)}°` : "--"}</span>
        </div>
        <div class="obs-cell">
          <span class="obs-label">Humidity:</span>
          <span class="obs-value">${humidity != null ? `${Math.round(humidity)}%` : "--"}</span>
        </div>
      </div>

      <div class="obs-row">
        <div class="obs-cell">
          <span class="obs-label">UV Index:</span>
          <span class="obs-value">${uv != null ? `${Math.round(uv)}` : "--"}</span>
        </div>
      </div>
    `;
}

// ------------------------------------------------------------
// Narrative Debug
// ------------------------------------------------------------
function renderNarrativeDebug(todayIntel, tomorrowIntel, todayNarr, tomorrowNarr) {
  const panel = $("narrative-debug");
  const content = $("debug-content");
  if (!panel || !content) return;

  const debugObj = {
    todayIntel,
    tomorrowIntel,
    todayNarr,
    tomorrowNarr
  };

  content.textContent = JSON.stringify(debugObj, null, 2);
  panel.style.display = "block";
}

// ------------------------------------------------------------
// DATA SOURCE INDICATOR (unchanged)
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
// HUMAN-ACTION RENDERING (wired to NEW synthesizer)
// ------------------------------------------------------------

function renderHumanAction(todayNarr, tomorrowNarr) {
  $("today-header").textContent = getTodayLabelFromLocalTime();
  $("today-emoji").textContent = todayNarr.emoji;
  $("today-headline").textContent = todayNarr.title;
  $("today-text").textContent = todayNarr.narrative;
  $("today-bullets").innerHTML = todayNarr.bullets
    .map(b => `<li>${b}</li>`)
    .join("");

  $("tomorrow-header").textContent = "Tomorrow’s Outlook";
  $("tomorrow-emoji").textContent = tomorrowNarr.emoji;
  $("tomorrow-headline").textContent = tomorrowNarr.title;
  $("tomorrow-text").textContent = tomorrowNarr.narrative;
  $("tomorrow-bullets").innerHTML = tomorrowNarr.bullets
    .map(b => `<li>${b}</li>`)
    .join("");

    $("today-goldilocks").style.display = todayNarr.isGoldilocks ? "inline-block" : "none";
$("tomorrow-goldilocks").style.display = tomorrowNarr.isGoldilocks ? "inline-block" : "none";

}

// ------------------------------------------------------------
// HUMAN-ACTION EXPANDED (unchanged, uses raw intel)
// ------------------------------------------------------------

function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  const build = (intel) => {
    if (!intel || !intel.snapshot) return "";

    const s = intel.snapshot;

    let high = null;
    let low = null;

    if (intel.stats) {
      high = intel.stats.tempMax ?? s.temp ?? null;
      low  = intel.stats.tempMin ?? s.temp ?? null;
    } else {
      const nextHours = window._hourly?.slice(0, 12) ?? [];
      const temps = nextHours
        .map(h => h.temperatureF ?? h.temperature)
        .filter(t => t != null);

      high = temps.length ? Math.max(...temps) : s.temp;
      low  = temps.length ? Math.min(...temps) : s.temp;
    }

    const dew = s.dewPoint ?? s.dewpoint ?? null;
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

// ============================================================
// COMFORT NOW — MODULE RENDERER (no synthesizer dependency)
// ============================================================

function renderComfortNow(container, comfort, bestWindow) {
  const mainLine = comfort.title || comfort.label || "Comfort overview";
  const scoreLine =
    comfort.comfortScore != null
      ? `${Math.round(comfort.comfortScore)} / 100`
      : "-- / 100";

  const explainer =
    comfort.scoreExplainer ||
    "Comfort Score blends temperature, dew point, humidity, wind, and sun angle into a 0–100 scale (higher is better).";

  container.innerHTML = `
    <div class="comfort-module module-card">
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji || "🌤️"}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>
          <div class="comfort-category">${comfort.category || ""}</div>
          <div class="comfort-text">${mainLine}</div>
          <div class="comfort-sub">
            ${scoreLine}
          </div>
          <div class="comfort-explainer">
            ${explainer}
          </div>
        </div>
      </div>

      <div class="comfort-expand">

        <ul class="comfort-bullets">
          ${comfort.bullets.map(b => `<li>${b}</li>`).join("")}
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
          ${bestWindow.hours.map(h => `
            <div class="fc-hour">
              <div class="fc-hour-label">${h.hourLabel}</div>
              <div class="fc-hour-main">
                <span class="fc-hour-emoji">${h.emoji}</span>
                <span class="fc-hour-temp">
                  ${h.temp != null ? `${Math.round(h.temp)}°` : "--"}
                </span>
              </div>

              <div class="fc-hour-extra">
                <span class="fc-hour-score">${Math.round(h.comfortScore)}/100</span>
                <span class="fc-hour-label-text">${h.label}</span>
              </div>
            </div>
          `).join("")}
        </div>
        `
            : ""
        }

        ${
          comfort.longNarrative
            ? `<div class="comfort-long">${comfort.longNarrative}</div>`
            : ""
        }

      </div>
    </div>
  `;
}

// ============================================================
// FUTURE COMFORT — NEXT 6 HOURS
// ============================================================

function renderFutureComfort(container, items) {
  container.innerHTML = `
    <div class="next6-module module-card">
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
// ACCORDION — ONE MODULE OPEN AT A TIME
// ============================================================

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

// ============================================================
// BEST COMFORT WINDOW — 3-HOUR SLIDING WINDOW
// ============================================================

function findBestComfortWindow(hourlyNormalized, computeComfortFn, windowSize = 3) {
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

      const intelForHour = {
        wu: {
          temp: h.temperatureF,
          dewPoint: h.dewpointF,
          windSpeed: h.wind_speed ?? 0,
          windDir: h.wind_dir ?? "",
          obsTimeLocal: h.timestamp
        }
      };

      const comfort = computeComfortFn(intelForHour);

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
// MAIN ENTRY — FULL PIPELINE
// ============================================================

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

  // ------------------------------------------------------------
  // HUMAN‑ACTION INTEL (Today + Tomorrow)
  // ------------------------------------------------------------
  const intelRaw = buildHumanActionIntel(raw);

  // NEW SYNTHESIZER: generate Today/Tomorrow narratives
  const { today: todayNarr, tomorrow: tomorrowNarr } = generateNarrative(
    intelRaw.today,
    intelRaw.tomorrow
  );

  renderHumanAction(todayNarr, tomorrowNarr);
  renderHumanActionExpanded(intelRaw.today, intelRaw.tomorrow);

  // ------------------------------------------------------------
  // NORMALIZED HOURLY
  // ------------------------------------------------------------
  const hourlyNormalized = normalizeOpenMeteo(raw.hourly);

  // ------------------------------------------------------------
  // COMFORT NOW — CANONICAL TEMPERATURE SOURCE
  // ------------------------------------------------------------
  const fallback = hourlyNormalized?.[0];

  const tempF =
    (raw.tempest?.air_temperature != null
      ? cToF(raw.tempest.air_temperature)
      : null) ??
    raw.wu?.imperial?.temp ??
    fallback?.temperatureF ??
    null;

  const dewF =
    (raw.tempest?.dew_point != null
      ? cToF(raw.tempest.dew_point)
      : null) ??
    raw.wu?.imperial?.dewpt ??
    fallback?.dewpointF ??
    null;

  const wind =
    raw.tempest?.wind_avg ??
    raw.wu?.imperial?.windSpeed ??
    fallback?.wind_speed ??
    0;

  const windDir =
    raw.tempest?.wind_direction ??
    raw.wu?.wind_dir ??
    fallback?.wind_dir ??
    "";

  const timestamp =
    raw.tempest?.timestamp ??
    raw.wu?.obsTimeLocal ??
    fallback?.timestamp ??
    Date.now();

  const comfortNow = computeComfort({
    wu: {
      temp: tempF,
      dewPoint: dewF,
      windSpeed: wind,
      windDir,
      obsTimeLocal: timestamp
    }
  });

  comfortNow.humidity =
    raw.tempest?.relative_humidity ??
    raw.wu?.humidity ??
    hourlyNormalized?.[0]?.relative_humidity ??
    null;

  comfortNow.wind =
    raw.tempest?.wind_avg ??
    raw.wu?.imperial?.windSpeed ??
    hourlyNormalized?.[0]?.wind_speed ??
    null;

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

  // ------------------------------------------------------------
  // COMFORT NOW — SIMPLE NARRATIVE WRAPPER (no synthesizer)
  // ------------------------------------------------------------
  const comfortNowForRender = {
    ...comfortNow,
    title:
      comfortNow.line1 ??
      comfortNow.summary ??
      "Comfort overview",
    bullets: Array.isArray(comfortNow.bullets)
      ? comfortNow.bullets
      : [],
    emoji: comfortNow.emoji ?? "🌤️",
    longNarrative:
      comfortNow.line2 ??
      ""
  };

  // ------------------------------------------------------------
  // FUTURE COMFORT + BEST WINDOW
  // ------------------------------------------------------------
  const futureComfort = buildFutureComfort(
    hourlyNormalized,
    computeComfort
  );

  const bestWindow = findBestComfortWindow(
    hourlyNormalized,
    computeComfort
  );

  // ------------------------------------------------------------
  // RENDER MODULES
  // ------------------------------------------------------------
  renderComfortNow(
    $("comfort-now-container"),
    comfortNowForRender,
    bestWindow
  );

  renderFutureComfort(
    $("future-comfort-container"),
    futureComfort
  );

  initializeAccordion();

  // ------------------------------------------------------------
  // DEBUG HOOKS (optional)
  // ------------------------------------------------------------
  window._raw = raw;
  window._comfortNow = comfortNow;
  window._comfortNowForRender = comfortNowForRender;
  window._hourly = hourlyNormalized;
  window._todayNarr = todayNarr;
  window._tomorrowNarr = tomorrowNarr;
  window._haToday = intelRaw.today;
  window._haTomorrow = intelRaw.tomorrow;
}