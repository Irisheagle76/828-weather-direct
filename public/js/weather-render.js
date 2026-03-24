// /js/weather-render.js
// ============================================================
// WEATHER RENDERER — Today, Tomorrow, Comfort, UV, Details
// ============================================================

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
// 🧠 INTELLIGENCE LAYER
// ------------------------------------------------------------
function getSkyCondition(stats) {
  if (!stats) return "unknown";

  if (stats.cloudAvg < 25) return "sunny";
  if (stats.cloudAvg < 55) return "partly";
  if (stats.cloudAvg < 80) return "mostly-cloudy";
  return "cloudy";
}

function getDominantDriver(stats, fallback) {
  if (!stats) return fallback ?? "easy";

  if (stats.snowTotal > 0.5) return "snow";
  if (stats.rainTotal > 0.25) return "rain";
  if (stats.windGustMax > 30) return "wind";
  if (stats.tempMax >= 90) return "hot";
  if (stats.tempMin <= 35) return "cold";

  if (
    stats.cloudAvg < 40 &&
    stats.rainTotal < 0.05 &&
    stats.tempMax >= 70 &&
    stats.tempMax <= 85
  ) {
    return "goldilocks";
  }

  return fallback ?? "easy";
}

function generateHumanHeadline(stats, fallback) {
  if (!stats) return fallback ?? "";

  const sky = getSkyCondition(stats);

  if (sky === "sunny" && stats.tempMax >= 75 && stats.tempMax <= 85) {
    return "Beautiful day ahead";
  }

  if (sky === "partly") return "A mix of sun and clouds";
  if (sky === "mostly-cloudy") return "More clouds than sun";
  if (sky === "cloudy") return "Gray and overcast conditions";

  return fallback ?? "";
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
  bullets = dedupeBullets(bullets);
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
    </div>
  `;
}

// ------------------------------------------------------------
// ⭐ UPDATED — Future Comfort (matches Comfort Now card)
// ------------------------------------------------------------
export function renderFutureComfort(intel) {
  const fc = intel.futureComfort;
  if (!fc || fc.length === 0) return "";

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

          <!-- ⭐ FIXED: use label instead of shortPhrase -->
          <div class="comfort-text">${fc[0].label}</div>

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
// RENDER TODAY OUTLOOK
// ------------------------------------------------------------
export function renderTodayOutlook(intel) {
  const emojiEl = document.getElementById("today-emoji");
  const headlineEl = document.getElementById("today-headline");
  const textEl = document.getElementById("today-text");
  const bulletsEl = document.getElementById("today-bullets");
  const remainderLabel = document.getElementById("today-remainder-label");

  const today = intel.today;
  const remainder = intel.remainderToday;

  if ((!today || !today.available) && (!remainder || !remainder.available)) {
    headlineEl.textContent = "No data available";
    textEl.textContent = "";
    bulletsEl.innerHTML = "";
    if (remainderLabel) remainderLabel.style.display = "none";
    return;
  }

  const active = (remainder && remainder.available) ? remainder : today;

  if (remainderLabel) {
    if (active === remainder) remainderLabel.style.display = "block";
    else remainderLabel.style.display = "none";
  }

  emojiEl.textContent = "";
  headlineEl.textContent = active.headline;
  fitHeadlineToWidth(headlineEl);

  textEl.textContent = active.narrative;
  renderBullets(bulletsEl, active.bullets);

  const todayModule = document.getElementById("today-module");
  if (todayModule && today) {
    if (today.isEndOfDay) todayModule.classList.add("fade");
    else todayModule.classList.remove("fade");
  }
}

// ------------------------------------------------------------
// RENDER TOMORROW OUTLOOK
// ------------------------------------------------------------
export function renderTomorrowOutlook(intel) {

  const emojiEl = document.getElementById("tomorrow-emoji");
  const badgeEl = document.getElementById("tomorrow-badge");
  const badgeContainer = document.getElementById("tomorrow-badge-container");
  const headlineEl = document.getElementById("tomorrow-headline");
  const textEl = document.getElementById("tomorrow-text");
  const bulletsEl = document.getElementById("tomorrow-bullets");

  const tomorrow = intel.tomorrow;

  if (!tomorrow || !tomorrow.available) {
    headlineEl.textContent = "No data available";
    textEl.textContent = "";
    bulletsEl.innerHTML = "";
    return;
  }

  console.log("RAW TOMORROW DATA:", tomorrow);
  console.log("STATS:", tomorrow.stats);

  emojiEl.textContent = "";

  const dominant = getDominantDriver(
    tomorrow.stats,
    tomorrow.events?.driver
  );

  const badgeMap = {
    rain:  { text: "Rain Gear",     class: "badge-rain" },
    wind:  { text: "Wind Alert",    class: "badge-wind" },
    snow:  { text: "Snow Impact",   class: "badge-snow" },
    hot:   { text: "Heat Caution",  class: "badge-heat" },
    cold:  { text: "Cold Start",    class: "badge-cold" },
    goldilocks: { text: "Perfect Day", class: "badge-goldilocks" }
  };

  const badge = badgeMap[dominant];

  if (!badge) {
    if (badgeContainer) badgeContainer.style.display = "none";
  } else {
    if (badgeContainer) badgeContainer.style.display = "block";
    badgeEl.textContent = badge.text;
    badgeEl.className = `badge ${badge.class}`;
  }

  headlineEl.textContent = generateHumanHeadline(
    tomorrow.stats,
    tomorrow.headline
  );
  fitHeadlineToWidth(headlineEl);

  textEl.textContent = tomorrow.narrative;
  renderBullets(bulletsEl, tomorrow.bullets);

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

  const stats = intel.today?.stats;
  if (!stats) {
    panel.innerHTML = "";
    return;
  }

  panel.innerHTML = `
    <div class="fx-section"><div class="fx-label">High</div><div class="fx-value">${Math.round(stats.tempMax)}°</div></div>
    <div class="fx-section"><div class="fx-label">Low</div><div class="fx-value">${Math.round(stats.tempMin)}°</div></div>
    <div class="fx-section"><div class="fx-label">Wind</div><div class="fx-value">${Math.round(stats.windAvg)} mph (gusts ${Math.round(stats.windGustMax)} mph)</div></div>
    <div class="fx-section"><div class="fx-label">Rain</div><div class="fx-value">${formatRainAmount(stats.rainTotal)}</div></div>
    <div class="fx-section"><div class="fx-label">Snow</div><div class="fx-value">${formatSnowAmount(stats.snowTotal)}</div></div>
    <div class="fx-section"><div class="fx-label">Cloud Cover</div><div class="fx-value">${Math.round(stats.cloudAvg)}%</div></div>
  `;
}

// ------------------------------------------------------------
// RENDER TOMORROW DETAIL
// ------------------------------------------------------------
export function renderTomorrowDetail(intel) {
  const panel = document.getElementById("expanded-tomorrow");
  if (!panel) return;

  const stats = intel.tomorrow?.stats;
  if (!stats) {
    panel.innerHTML = "";
    return;
  }

  panel.innerHTML = `
    <div class="fx-section"><div class="fx-label">High</div><div class="fx-value">${Math.round(stats.tempMax)}°</div></div>
    <div class="fx-section"><div class="fx-label">Low</div><div class="fx-value">${Math.round(stats.tempMin)}°</div></div>
    <div class="fx-section"><div class="fx-label">Wind</div><div class="fx-value">${Math.round(stats.windAvg)} mph (gusts ${Math.round(stats.windGustMax)} mph)</div></div>
    <div class="fx-section"><div class="fx-label">Rain</div><div class="fx-value">${formatRainAmount(stats.rainTotal)}</div></div>
    <div class="fx-section"><div class="fx-label">Snow</div><div class="fx-value">${formatSnowAmount(stats.snowTotal)}</div></div>
    <div class="fx-section"><div class="fx-label">Cloud Cover</div><div class="fx-value">${Math.round(stats.cloudAvg)}%</div></div>
  `;
}
function setupComfortToggle() {
  const comfortModule = document.querySelector("#comfort-now-container .comfort-module");
  const hourly = document.getElementById("hourlyTemps");

  if (!comfortModule || !hourly) return;

  comfortModule.addEventListener("click", () => {
    const isOpen = hourly.style.display === "flex";
    hourly.style.display = isOpen ? "none" : "flex";
  });
}
// ------------------------------------------------------------
// EXPANSION PANEL TOGGLER
// ------------------------------------------------------------
export function toggleForecastExpanded(which, intel) {
  const panelToday = document.getElementById("expanded-today");
  const panelTomorrow = document.getElementById("expanded-tomorrow");

  if (which === "today") {
    const isOpen = panelToday.style.display === "block";
    panelToday.style.display = isOpen ? "none" : "block";
    panelTomorrow.style.display = "none";
    return;
  }

  if (which === "tomorrow") {
    const isOpen = panelTomorrow.style.display === "block";
    panelTomorrow.style.display = isOpen ? "none" : "block";
    panelToday.style.display = "none";
    return;
  }
}