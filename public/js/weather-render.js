// ============================================================
// WEATHER RENDERER — Today, Tomorrow, Comfort, UV, Details
// ============================================================

import { generateFutureComfortPhrase } from "./intel/comfort.js?v=1.0.0";
import { synthesizeOutlook } from "./intel/synthesizer.js?v=1.0.0";

// ❌ Removed legacy imports:
// import { generateHumanAction } from "./modules/human-action-2/human-action-2.js?v=1.0.0";
// import { buildTomorrowCurrent } from "./modules/human-action-2/tomorrow-builder.js?v=1.0.0";

// ❌ Removed legacy global exposure:
// window.generateHumanAction = generateHumanAction;
// window.buildTomorrowCurrent = buildTomorrowCurrent;
// ------------------------------------------------------------
// ⭐ FULL HUMAN‑ACTION 2.0 — TODAY OUTLOOK (Updated for new intel)
// ------------------------------------------------------------
export function renderTodayOutlook(intel) {
  const emojiEl = document.getElementById("today-emoji");
  const headlineEl = document.getElementById("today-headline");
  const textEl = document.getElementById("today-text");
  const bulletsEl = document.getElementById("today-bullets");
  const remainderLabel = document.getElementById("today-remainder-label");
  const labelEl = document.querySelector("#today-module .action-label");

  if (!headlineEl || !textEl || !bulletsEl) return;

  const hour = new Date().getHours();

  // NEW — pull from Human‑Action intel
  const todayHA = intel.humanAction?.today;
  const tonightHA = intel.humanAction?.tonight;

  if (!todayHA || !tonightHA) return;

  let action;

  // 🌙 DAY → NIGHT SWITCH (after 3pm)
  if (hour >= 15) {
    action = tonightHA;
    if (labelEl) labelEl.textContent = "Tonight’s Human‑Action Outlook";
  } else {
    action = todayHA;
    if (labelEl) labelEl.textContent = "Today’s Human‑Action Outlook";
  }

  // ⭐ SYNTHESIZER LAYER (Option A1 — using new stats)
  try {
    const synth = synthesizeOutlook(
      intel.humanAction.today?.stats || {},
      intel.eventsToday || {},
      intel.hourly?.time || []
    );

    // Merge synthesizer voice with Human‑Action output
    action = mergeOutlook(action, {
      today: intel.humanAction.today,
      hourly: intel.hourly
    });
  } catch (e) {
    console.warn("Synthesizer merge failed:", e);
  }

  // 🌙 FADE EFFECT after 3pm
  const todayModule = document.getElementById("today-module");
  if (todayModule) {
    if (hour >= 15) todayModule.classList.add("fade");
    else todayModule.classList.remove("fade");
  }

  // 🧠 REMAINDER LABEL
  if (remainderLabel) {
    remainderLabel.style.display = hour >= 15 ? "block" : "none";
  }

  // 🎯 RENDER
  if (emojiEl) emojiEl.textContent = action.emoji;
  headlineEl.textContent = action.headline;
  textEl.textContent = "";
  renderBullets(bulletsEl, action.bullets);

  fitHeadlineToWidth(headlineEl);
}
// ------------------------------------------------------------
// ⭐ FULL HUMAN‑ACTION 2.0 — TOMORROW OUTLOOK (Updated for new intel)
// ------------------------------------------------------------
export function renderTomorrowOutlook(intel) {
  const emojiEl = document.getElementById("tomorrow-emoji");
  const badgeEl = document.getElementById("tomorrow-badge");
  const badgeContainer = document.getElementById("tomorrow-badge-container");
  const headlineEl = document.getElementById("tomorrow-headline");
  const textEl = document.getElementById("tomorrow-text");
  const bulletsEl = document.getElementById("tomorrow-bullets");

  if (!headlineEl || !textEl || !bulletsEl) return;

  // NEW — pull from Human‑Action intel
  const tomorrowHA = intel.humanAction?.tomorrow;

  if (!tomorrowHA) {
    headlineEl.textContent = "No data available";
    textEl.textContent = "";
    bulletsEl.innerHTML = "";
    if (badgeContainer) badgeContainer.style.display = "none";
    if (emojiEl) emojiEl.textContent = "";
    return;
  }

  // ⭐ SYNTHESIZER LAYER (Option A1 — using new stats)
  let action = tomorrowHA;
  try {
    const synth = synthesizeOutlook(
      intel.humanAction.today?.stats || {},
      intel.eventsToday || {},
      intel.hourly?.time || []
    );

    action = mergeOutlook(action, {
      today: intel.humanAction.today,
      hourly: intel.hourly
    });
  } catch (e) {
    console.warn("Synthesizer merge failed:", e);
  }

  // 🎯 Render
  if (emojiEl) emojiEl.textContent = action.emoji;
  headlineEl.textContent = action.headline;
  textEl.textContent = "";
  renderBullets(bulletsEl, action.bullets);

  fitHeadlineToWidth(headlineEl);

  // ⭐ Modernized Human‑Action 2.0 badge map
  const dominant = action.dominantFactor;
  const badgeMap = {
    cold:        { text: "Cold Start",      class: "badge-cold" },
    frost:       { text: "Frost Early",     class: "badge-cold" },
    freeze:      { text: "Hard Freeze",     class: "badge-cold" },
    blackIce:    { text: "Black Ice Risk",  class: "badge-cold" },
    freezingFog: { text: "Freezing Fog",    class: "badge-cold" },
    snow:        { text: "Snow Impact",     class: "badge-snow" },

    heat:        { text: "Heat Caution",    class: "badge-heat" },
    humidity:    { text: "Humid & Heavy",   class: "badge-humid" },
    muggy:       { text: "Muggy Air",       class: "badge-humid" },

    wind:        { text: "Wind Alert",      class: "badge-wind" },
    mountainWind:{ text: "Ridgetop Winds",  class: "badge-wind" },

    rain:        { text: "Rain Gear",       class: "badge-rain" },
    coldRain:    { text: "Cold Rain",       class: "badge-rain" },
    warmRain:    { text: "Warm Rain",       class: "badge-rain" },
    storms:      { text: "Storm Risk",      class: "badge-storm" },

    fog:         { text: "Low Visibility",  class: "badge-fog" },
    valleyFog:   { text: "Valley Fog",      class: "badge-fog" },
    ridgeFog:    { text: "Ridge Fog",       class: "badge-fog" },

    sun:         { text: "Bright Day",      class: "badge-goldilocks" },
    clouds:      { text: "Cloudy & Mild",   class: "badge-goldilocks" },
    goldilocks:  { text: "Just Right",      class: "badge-goldilocks" }
  };

  const badge = badgeMap[dominant];

  if (!badge) {
    if (badgeContainer) badgeContainer.style.display = "none";
  } else {
    if (badgeContainer) badgeContainer.style.display = "block";
    if (badgeEl) {
      badgeEl.textContent = badge.text;
      badgeEl.className = `badge ${badge.class}`;
    }
  }

  // 🌅 Fade early-morning tomorrow module
  const tomorrowModule = document.getElementById("tomorrow-module");
  if (tomorrowModule) {
    const morningTemp = tomorrowHA.snapshots?.morning?.temp;
    if (morningTemp != null && morningTemp < 40) {
      tomorrowModule.classList.add("fade");
    } else {
      tomorrowModule.classList.remove("fade");
    }
  }
}
// ------------------------------------------------------------
// RENDER TODAY DETAIL (Updated for new intel)
// ------------------------------------------------------------
export function renderTodayDetail(intel) {
  const panel = document.getElementById("expanded-today");
  if (!panel) return;

  const hourly = intel.hourly;
  if (!hourly) return;

  const temps = hourly.temperature_2m || [];
  const dew = hourly.dewpoint_2m || [];
  const winds = hourly.windspeed_10m || [];
  const gusts = hourly.windgusts_10m || [];
  const rain = hourly.rain || [];
  const snow = hourly.snowfall || [];
  const clouds = hourly.cloudcover || [];

  // Midday today (approx 12–3pm)
  const idx = 12;

  const safe = (arr, i) =>
    typeof arr[i] === "number" && !isNaN(arr[i]) ? arr[i] : 0;

  const temp = safe(temps, idx);
  const dewpt = safe(dew, idx);
  const wind = safe(winds, idx);
  const gust = safe(gusts, idx);
  const cloud = safe(clouds, idx);
  const rainVal = safe(rain, idx);
  const snowVal = safe(snow, idx);

  panel.innerHTML = `
    <div class="fx-grid">

      <div class="fx-tile">
        <div class="fx-top">🌡 ${Math.round(temp)}°</div>
        <div class="fx-label">Temp</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">💧 ${Math.round(dewpt)}°</div>
        <div class="fx-label">Dew</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">🌬 ${Math.round(wind)} mph</div>
        <div class="fx-sub">Gusts ${Math.round(gust)}</div>
        <div class="fx-label">Wind</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">☁ ${Math.round(cloud)}%</div>
        <div class="fx-label">Cloud</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">🌧 ${describePrecip(rainVal)}</div>
        <div class="fx-label">Rain</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">❄ ${describeSnow(snowVal)}</div>
        <div class="fx-label">Snow</div>
      </div>

    </div>
  `;
}
// ------------------------------------------------------------
// RENDER TOMORROW DETAIL (Updated for new intel)
// ------------------------------------------------------------
export function renderTomorrowDetail(intel) {
  const panel = document.getElementById("expanded-tomorrow");
  if (!panel) return;

  const hourly = intel.hourly;
  if (!hourly) return;

  const temps = hourly.temperature_2m || [];
  const dew = hourly.dewpoint_2m || [];
  const winds = hourly.windspeed_10m || [];
  const gusts = hourly.windgusts_10m || [];
  const rain = hourly.rain || [];
  const snow = hourly.snowfall || [];
  const clouds = hourly.cloudcover || [];

  // Tomorrow midday (~18–21 = 12–3pm depending on alignment)
  const idx = 30;

  const safe = (arr, i) =>
    typeof arr[i] === "number" && !isNaN(arr[i]) ? arr[i] : 0;

  const temp = safe(temps, idx);
  const dewpt = safe(dew, idx);
  const wind = safe(winds, idx);
  const gust = safe(gusts, idx);
  const cloud = safe(clouds, idx);
  const rainVal = safe(rain, idx);
  const snowVal = safe(snow, idx);

  panel.innerHTML = `
    <div class="fx-grid">

      <div class="fx-tile">
        <div class="fx-top">🌡 ${Math.round(temp)}°</div>
        <div class="fx-label">Temp</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">💧 ${Math.round(dewpt)}°</div>
        <div class="fx-label">Dew</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">🌬 ${Math.round(wind)} mph</div>
        <div class="fx-sub">Gusts ${Math.round(gust)}</div>
        <div class="fx-label">Wind</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">☁ ${Math.round(cloud)}%</div>
        <div class="fx-label">Cloud</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">🌧 ${describePrecip(rainVal)}</div>
        <div class="fx-label">Rain</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">❄ ${describeSnow(snowVal)}</div>
        <div class="fx-label">Snow</div>
      </div>

    </div>
  `;
}
