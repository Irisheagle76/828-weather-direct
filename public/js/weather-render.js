// /js/weather-render.js
// ============================================================
// Convert mm to in
// ============================================================
function formatPrecip(mm) {
  const inches = mm / 25.4;

  if (inches < 0.01) return "Dry";
  return inches.toFixed(2) + " in";
}
// ============================================================
// Rain conversion to adjectives
// ============================================================
function describePrecip(mm) {
  const inches = mm / 25.4;

  if (inches < 0.01) return "Dry";
  if (inches < 0.03) return "A few sprinkles";
  if (inches < 0.10) return "Light rain";
  if (inches < 0.25) return "Steady light rain";
  if (inches < 0.50) return "Moderate rain";
  if (inches < 1.00) return "Steady rain";
  return "Heavy rain";
}
// ============================================================
// Snow conversion to adjectives
// ============================================================
function describeSnow(mm) {
  const inches = mm / 25.4;

  if (inches < 0.01) return "No accumulation";
  if (inches < 0.10) return "Flurries";
  if (inches < 0.50) return "A light coating";
  if (inches < 1.5) return "Light accumulation";
  if (inches < 3) return "Accumulating snow";
  if (inches < 6) return "Moderate accumulation";
  return "Heavy snow";
}
// ============================================================
// WEATHER RENDERER — Today, Tomorrow, Comfort, UV, Details
// ============================================================

import { generateFutureComfortPhrase } from "./intel/comfort.js?v=1.0.0";
import { generateHumanAction } from "./modules/human-action-2/human-action-2.js?v=1.0.0";
import { buildTomorrowCurrent } from "./modules/human-action-2/tomorrow-builder.js?v=1.0.0";

window.generateHumanAction = generateHumanAction;
window.buildTomorrowCurrent = buildTomorrowCurrent;

// ------------------------------------------------------------
// PRECIPITATION RANGE HELPERS
// ------------------------------------------------------------
function formatRainAmount(amount) {
  if (amount === 0) return "Dry";
  if (amount < 0.05) return "A few sprinkles — Low confidence";
  if (amount < 0.25) return "Light rain — Moderate confidence";
  if (amount < 0.5) return "A decent rainfall — Moderate confidence";
  if (amount < 1) return "A soaking rain — Fairly likely";
  if (amount < 2) return "Heavy rain — Fairly likely";
  return "Very heavy rain. Localized flooding possible. — High confidence";
}

function formatSnowAmount(amount) {
  if (amount === 0) return "No accumulation expected";
  if (amount < 0.1) return "Trace — Low confidence";
  if (amount < 0.5) return "A coating — Low confidence";
  if (amount < 1) return "Upwards of an inch possible — Moderate confidence";
  if (amount < 2) return "1–2 inches possible — Moderate confidence";
  if (amount < 4) return "A few inches possible — Fairly likely";
  if (amount < 6) return "Several inches possible — Fairly likely";
  if (amount < 10) return "Half a foot or more — High confidence";
  return "Significant accumulation possible — High confidence";
}

// ------------------------------------------------------------
// HEADLINE AUTO‑SHRINK HELPER
// ------------------------------------------------------------
function fitHeadlineToWidth(el, maxSize = 1.25, minSize = 0.95) {
  if (!el) return;

  el.style.fontSize = `${maxSize}rem`;

  while (el.scrollWidth > el.clientWidth && maxSize > minSize) {
    maxSize -= 0.05;
    el.style.fontSize = `${maxSize}rem`;
  }
}

// ------------------------------------------------------------
// RENDER CURRENT OBSERVATIONS (WU)
// ------------------------------------------------------------
export function renderCurrentObservations(intel) {
  const wu = intel.wu;
  if (!wu) return;

  const tempEl = document.getElementById("wu-temp");
  const dewEl = document.getElementById("wu-dew");
  const humEl = document.getElementById("wu-humidity");
  const windEl = document.getElementById("wu-wind");
  const gustEl = document.getElementById("wu-wind-gust");
  const uvEl = document.getElementById("wu-uv");

  if (tempEl) {
    tempEl.textContent = wu.temp != null ? `${wu.temp}°` : "--";
    tempEl.className = "metric-value";

    const t = wu.temp;
    if (t <= 32) tempEl.classList.add("temp-freezing");
    else if (t <= 45) tempEl.classList.add("temp-cold");
    else if (t <= 60) tempEl.classList.add("temp-cool");
    else if (t <= 75) tempEl.classList.add("temp-mild");
    else if (t <= 85) tempEl.classList.add("temp-warm");
    else tempEl.classList.add("temp-hot");
  }

  if (dewEl) {
    dewEl.textContent = wu.dewPoint != null ? `${wu.dewPoint}°` : "--";
    dewEl.className = "metric-value";

    const d = wu.dewPoint;
    if (d <= 40) dewEl.classList.add("dew-dry");
    else if (d <= 55) dewEl.classList.add("dew-comfort");
    else if (d <= 70) dewEl.classList.add("dew-humid");
    else dewEl.classList.add("dew-tropical");
  }

  if (humEl) {
    humEl.textContent = wu.humidity != null ? `Humidity ${wu.humidity}%` : "Humidity --";
  }

  if (windEl) {
    const dir = wu.windDir != null ? degToCompass(wu.windDir) : "";
    const spd = wu.windSpeed != null ? `${wu.windSpeed} mph` : "--";
    windEl.textContent = dir ? `${dir} ${spd}` : spd;
  }

  if (gustEl) {
    gustEl.textContent = wu.windGust != null ? `Gusts ${wu.windGust} mph` : "Gusts --";
  }

  if (uvEl) {
    const uv = intel.uv ?? wu.uv ?? 0;
    uvEl.textContent = uv != null ? uv.toFixed(1) : "--";
    uvEl.className = "metric-value " + getUVClass(uv ?? 0);
  }
}

// ------------------------------------------------------------
// HOURLY TEMPS IN COMFORT DROPDOWN
// ------------------------------------------------------------
export function renderHourlyTemps(hourlyData) {
  const container = document.getElementById("hourlyTemps");
  if (!container || !hourlyData) return;

  container.innerHTML = "";

  const times = hourlyData.time;
  const temps = hourlyData.temperature_2m;

  if (!times || !temps) return;

  const now = new Date();
  let startIndex = 0;

  for (let i = 0; i < times.length; i++) {
    const t = new Date(times[i]);
    if (t > now) {
      startIndex = i;
      break;
    }
  }

  const count = Math.min(6, times.length - startIndex);

  for (let i = 0; i < count; i++) {
    const idx = startIndex + i;

    const time = new Date(times[idx]);
    const hourLabel = time.toLocaleTimeString([], { hour: "numeric" });

    const temp = Math.round(temps[idx]);

    const item = document.createElement("div");
    item.className = "hour-item";

    item.innerHTML = `
      <div class="hour-time">${hourLabel}</div>
      <div class="hour-temp">${temp}°</div>
    `;

    container.appendChild(item);
  }
}

// ------------------------------------------------------------
// Compass helper
// ------------------------------------------------------------
export function degToCompass(deg) {
  if (deg == null) return "";
  const dirs = [
    "N","NNE","NE","ENE","E","ESE","SE","SSE",
    "S","SSW","SW","WSW","W","WNW","NW","NNW"
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ------------------------------------------------------------
// UV class helper
// ------------------------------------------------------------
export function getUVClass(uv) {
  if (uv == null) return "uv-0";
  if (uv <= 2) return "uv-low";
  if (uv <= 5) return "uv-moderate";
  if (uv <= 7) return "uv-high";
  if (uv <= 10) return "uv-very-high";
  return "uv-extreme";
}

// ------------------------------------------------------------
// BULLET DE-DUPLICATOR
// ------------------------------------------------------------
function dedupeBullets(bullets) {
  const seen = new Set();
  const result = [];

  bullets.forEach(b => {
    let key = b.toLowerCase();
    key = key.replace(/[^a-z0-9 ]/g, " ");
    key = key
      .replace(/\bjacket\b/g, "coat")
      .replace(/\bchilly\b/g, "cold")
      .replace(/\bearly\b/g, "morning")
      .replace(/\bmorning air\b/g, "morning")
      .replace(/\bair\b/g, "")
      .replace(/\bcoat helps\b/g, "coat recommended")
      .replace(/\bcoat is helpful\b/g, "coat recommended")
      .replace(/\bcoat recommended\b/g, "coat recommended");
    key = key.replace(/\b(a|the|is|very|quite|bit|little)\b/g, "");
    key = key.replace(/\s+/g, " ").trim();
    key = key.split(" ").sort().join(" ");

    if (!seen.has(key)) {
      seen.add(key);
      result.push(b);
    }
  });

  return result;
}

// ------------------------------------------------------------
// HYBRID BULLET RENDERER
// ------------------------------------------------------------
function renderBullets(ul, bullets) {
  if (!ul) return;
  bullets = dedupeBullets(bullets || []);
  ul.innerHTML = "";

  bullets.forEach(b => {
    const li = document.createElement("li");
    if (/^[\p{Emoji}]/u.test(b)) li.textContent = b;
    else li.textContent = "• " + b;
    ul.appendChild(li);
  });
}
// ------------------------------------------------------------
// ⭐ UPDATED — RENDER RIGHT NOW COMFORT (returns HTML)
// ------------------------------------------------------------
export function renderRightNowComfort(intel) {
  const comfort = intel.comfort;
  if (!comfort) return "";

  return `
    <div class="comfort-module">
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Right Now Comfort</div>
          <div class="comfort-text">${comfort.summary}</div>
          <div class="comfort-sub">Based on current conditions</div>
        </div>
      </div>

      <div id="hourlyTemps"></div>
    </div>
  `;
}

// ------------------------------------------------------------
// ⭐ UPDATED — Future Comfort (matches Comfort Now card)
// ------------------------------------------------------------
export function renderFutureComfort(intel) {
  const fc = intel.futureComfort;
  if (!fc || fc.length === 0) return "";

  const phrase = generateFutureComfortPhrase(fc, intel.hourly);

  const items = fc.map(item => `
    <div class="fc-hour">
      <div class="fc-hour-label">${item.hourLabel}</div>
      <div class="fc-hour-emoji">${item.emoji}</div>
    </div>
  `).join("");

  return `
    <div class="comfort-module">
      <div class="comfort-main">
        <div class="comfort-emoji">${fc[0].emoji}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Next 6 Hours</div>
          <div class="comfort-text">${phrase}</div>
          <div class="comfort-sub">Comfort trend</div>
        </div>
      </div>

      <div class="fc-strip">
        ${items}
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// ⭐ FULL HUMAN‑ACTION 2.0 — TODAY OUTLOOK
// ------------------------------------------------------------
export function renderTodayOutlook(intel) {
  const emojiEl = document.getElementById("today-emoji");
  const headlineEl = document.getElementById("today-headline");
  const textEl = document.getElementById("today-text");
  const bulletsEl = document.getElementById("today-bullets");
  const remainderLabel = document.getElementById("today-remainder-label");

  if (!headlineEl || !textEl || !bulletsEl) return;

  const action = generateHumanAction(intel.current);

  const today = intel.today;
  const todayModule = document.getElementById("today-module");
  if (todayModule && today) {
    if (today.isEndOfDay) todayModule.classList.add("fade");
    else todayModule.classList.remove("fade");
  }

  const remainder = intel.remainderToday;
  if (remainderLabel) {
    remainderLabel.style.display =
      remainder && remainder.available ? "block" : "none";
  }

  if (emojiEl) emojiEl.textContent = action.emoji;
  headlineEl.textContent = action.headline;
  textEl.textContent = "";
  renderBullets(bulletsEl, action.bullets);

  fitHeadlineToWidth(headlineEl);
}

// ------------------------------------------------------------
// ⭐ FULL HUMAN‑ACTION 2.0 — TOMORROW OUTLOOK
// ------------------------------------------------------------
export function renderTomorrowOutlook(intel) {
  const emojiEl = document.getElementById("tomorrow-emoji");
  const badgeEl = document.getElementById("tomorrow-badge");
  const badgeContainer = document.getElementById("tomorrow-badge-container");
  const headlineEl = document.getElementById("tomorrow-headline");
  const textEl = document.getElementById("tomorrow-text");
  const bulletsEl = document.getElementById("tomorrow-bullets");

  if (!headlineEl || !textEl || !bulletsEl) return;

  const tomorrow = intel.tomorrow;

  if (!tomorrow || !tomorrow.available) {
    headlineEl.textContent = "No data available";
    textEl.textContent = "";
    bulletsEl.innerHTML = "";
    if (badgeContainer) badgeContainer.style.display = "none";
    if (emojiEl) emojiEl.textContent = "";
    return;
  }

  const tomorrowData = buildTomorrowCurrent(tomorrow.stats);
  const action = generateHumanAction(tomorrowData);

  if (emojiEl) emojiEl.textContent = action.emoji;
  headlineEl.textContent = action.headline;
  textEl.textContent = "";
  renderBullets(bulletsEl, action.bullets);

  fitHeadlineToWidth(headlineEl);

  // ⭐ Modernized Human‑Action 2.0 badge map
  const dominant = action.dominantFactor;
  const badgeMap = {
    // Cold family
    cold:        { text: "Cold Start",      class: "badge-cold" },
    frost:       { text: "Frost Early",     class: "badge-cold" },
    freeze:      { text: "Hard Freeze",     class: "badge-cold" },
    blackIce:    { text: "Black Ice Risk",  class: "badge-cold" },
    freezingFog: { text: "Freezing Fog",    class: "badge-cold" },
    snow:        { text: "Snow Impact",     class: "badge-snow" },

    // Heat / humidity
    heat:        { text: "Heat Caution",    class: "badge-heat" },
    humidity:    { text: "Humid & Heavy",   class: "badge-humid" },
    muggy:       { text: "Muggy Air",       class: "badge-humid" },

    // Wind
    wind:        { text: "Wind Alert",      class: "badge-wind" },
    mountainWind:{ text: "Ridgetop Winds",  class: "badge-wind" },

    // Rain / storms
    rain:        { text: "Rain Gear",       class: "badge-rain" },
    coldRain:    { text: "Cold Rain",       class: "badge-rain" },
    warmRain:    { text: "Warm Rain",       class: "badge-rain" },
    storms:      { text: "Storm Risk",      class: "badge-storm" },

    // Visibility
    fog:         { text: "Low Visibility",  class: "badge-fog" },
    valleyFog:   { text: "Valley Fog",      class: "badge-fog" },
    ridgeFog:    { text: "Ridge Fog",       class: "badge-fog" },

    // Goldilocks / neutral
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

  const tomorrowModule = document.getElementById("tomorrow-module");
  if (tomorrowModule) {
    if (tomorrow.isEarlyMorning) tomorrowModule.classList.add("fade");
    else tomorrowModule.classList.remove("fade");
  }
}

// ------------------------------------------------------------
// RENDER UV INDEX
// ------------------------------------------------------------
export function renderUV(intel) {
  const uvEl = document.getElementById("wu-uv");
  if (!uvEl) return;

  const uv = intel.uv ?? intel.wu?.uv ?? 0;
  uvEl.textContent = uv.toFixed(1);
  uvEl.className = "metric-value " + getUVClass(uv);
}

// ------------------------------------------------------------
// RENDER TODAY DETAIL
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

  // 👉 Today midday (~12–3pm)
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
// RENDER TOMORROW DETAIL
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

  // 👉 Tomorrow midday (~18–21 = 12–3pm depending on timezone alignment)
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

// ------------------------------------------------------------
// EXPANSION PANEL TOGGLER
// ------------------------------------------------------------
export function toggleForecastExpanded(which, intel) {
  const panelToday = document.getElementById("expanded-today");
  const panelTomorrow = document.getElementById("expanded-tomorrow");

  if (!panelToday || !panelTomorrow) return;

  const panels = {
    today: panelToday,
    tomorrow: panelTomorrow
  };

  const target = panels[which];
  const other = which === "today" ? panelTomorrow : panelToday;

  const isOpen = target.style.display === "block";

  // Close both
  panelToday.style.display = "none";
  panelTomorrow.style.display = "none";

  // If it was closed → open it
  if (!isOpen) {
    if (which === "today") renderTodayDetail(intel);
    if (which === "tomorrow") renderTomorrowDetail(intel);

    target.style.display = "block";   // ⭐ THIS WAS MISSING
  }
}