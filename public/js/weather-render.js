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
// HEADLINE AUTO-SHRINK HELPER
// ------------------------------------------------------------
function fitHeadlineToWidth(el, maxSize = 1.25, minSize = 0.95) {
  if (!el) return;

  let size = maxSize;
  el.style.fontSize = `${size}rem`;

  let safety = 20;
  while (el.scrollWidth > el.clientWidth && size > minSize && safety--) {
    size -= 0.05;
    el.style.fontSize = `${size}rem`;
  }
}

// ------------------------------------------------------------
// RENDER CURRENT OBSERVATIONS
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

    tempEl.classList.remove(
      "temp-freezing","temp-cold","temp-cool","temp-mild","temp-warm","temp-hot"
    );

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

    dewEl.classList.remove(
      "dew-dry","dew-comfort","dew-humid","dew-tropical"
    );

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
    uvEl.textContent = uv.toFixed(1);

    uvEl.classList.remove(
      "uv-low","uv-moderate","uv-high","uv-very-high","uv-extreme"
    );
    uvEl.classList.add(getUVClass(uv));
  }
}

// ------------------------------------------------------------
// HOURLY TEMPS
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
    if (new Date(times[i]) > now) {
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
// COMPASS
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
// UV CLASS
// ------------------------------------------------------------
export function getUVClass(uv) {
  if (uv <= 2) return "uv-low";
  if (uv <= 5) return "uv-moderate";
  if (uv <= 7) return "uv-high";
  if (uv <= 10) return "uv-very-high";
  return "uv-extreme";
}

// ------------------------------------------------------------
// COMFORT RENDERERS
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
// ⭐ FIXED TOGGLE (uses CSS class, not display)
// ------------------------------------------------------------
export function setupComfortToggle() {
  const hourly = document.getElementById("hourlyTemps");

  document.addEventListener("click", (e) => {
    const module = e.target.closest("#comfort-now-container .comfort-module");
    if (!module || !hourly) return;

    hourly.classList.toggle("active");
  });
}

// ------------------------------------------------------------
// EXPANSION PANEL TOGGLER
// ------------------------------------------------------------
export function toggleForecastExpanded(which) {
  const panelToday = document.getElementById("expanded-today");
  const panelTomorrow = document.getElementById("expanded-tomorrow");

  if (which === "today") {
    panelToday.style.display =
      panelToday.style.display === "block" ? "none" : "block";
    panelTomorrow.style.display = "none";
  }

  if (which === "tomorrow") {
    panelTomorrow.style.display =
      panelTomorrow.style.display === "block" ? "none" : "block";
    panelToday.style.display = "none";
  }
}