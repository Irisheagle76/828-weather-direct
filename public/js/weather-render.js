// /js/weather-render.js
// ============================================================
// RENDERING ENGINE — UI OUTPUT FOR ALL MODULES
// ============================================================

// ------------------------------------------------------------
// RIGHT NOW COMFORT
// ------------------------------------------------------------
export function renderRightNowComfort(intel) {
  const emojiEl = document.getElementById("comfort-emoji");
  const textEl = document.getElementById("comfort-text");

  if (!intel.comfort) {
    emojiEl.textContent = "–";
    textEl.textContent = "Comfort unavailable";
    return;
  }

  emojiEl.textContent = intel.comfort.emoji;
  textEl.textContent = intel.comfort.summary;
}

// ------------------------------------------------------------
// TODAY HUMAN‑ACTION OUTLOOK (NEW STRUCTURE)
// ------------------------------------------------------------
export function renderTodayOutlook(intel) {
  const headlineEl = document.getElementById("today-headline");
  const textEl = document.getElementById("today-text");
  const bulletsEl = document.getElementById("today-bullets");

  const out = intel.today?.actionOutlook;
  if (!out) {
    headlineEl.textContent = "No outlook available.";
    textEl.textContent = "";
    bulletsEl.innerHTML = "";
    return;
  }

  headlineEl.textContent = out.headline;
  textEl.textContent = out.context;

  bulletsEl.innerHTML = out.bullets
    .map(b => `<li>${b}</li>`)
    .join("");
}

// ------------------------------------------------------------
// TOMORROW HUMAN‑ACTION OUTLOOK (NEW STRUCTURE)
// ------------------------------------------------------------
export function renderTomorrowOutlook(intel) {
  const headlineEl = document.getElementById("tomorrow-headline");
  const textEl = document.getElementById("tomorrow-text");
  const bulletsEl = document.getElementById("tomorrow-bullets");

  const out = intel.tomorrow?.actionOutlook;
  if (!out) {
    headlineEl.textContent = "No outlook available.";
    textEl.textContent = "";
    bulletsEl.innerHTML = "";
    return;
  }

  headlineEl.textContent = out.headline;
  textEl.textContent = out.context;

  bulletsEl.innerHTML = out.bullets
    .map(b => `<li>${b}</li>`)
    .join("");
}

// ------------------------------------------------------------
// UV INDEX
// ------------------------------------------------------------
export function renderUV(intel) {
  const el = document.getElementById("wu-uv");
  const uv = intel.today?.stats?.uv ?? null;

  if (uv == null) {
    el.textContent = "--";
    return;
  }

  el.textContent = uv;

  el.classList.remove("uv-low", "uv-moderate", "uv-high", "uv-very-high", "uv-extreme");

  if (uv <= 2) el.classList.add("uv-low");
  else if (uv <= 5) el.classList.add("uv-moderate");
  else if (uv <= 7) el.classList.add("uv-high");
  else if (uv <= 10) el.classList.add("uv-very-high");
  else el.classList.add("uv-extreme");
}

// ------------------------------------------------------------
// TODAY DETAIL PANEL
// ------------------------------------------------------------
export function renderTodayDetail(intel) {
  const panel = document.getElementById("expanded-today");
  if (!panel) return;

  panel.innerHTML = `
    <div class="fx-section">
      <div class="fx-label">High Temperature</div>
      <div class="fx-value">${intel.today?.stats?.maxTemp ?? "--"}°</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Wind</div>
      <div class="fx-value">${intel.wu.windSpeed ?? "--"} mph</div>
    </div>
  `;
}

// ------------------------------------------------------------
// TOMORROW DETAIL PANEL
// ------------------------------------------------------------
export function renderTomorrowDetail(intel) {
  const panel = document.getElementById("expanded-tomorrow");
  if (!panel) return;

  panel.innerHTML = `
    <div class="fx-section">
      <div class="fx-label">High Temperature</div>
      <div class="fx-value">${intel.tomorrow?.stats?.maxTemp ?? "--"}°</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Wind</div>
      <div class="fx-value">${intel.tomorrow?.windSpeed ?? "--"} mph</div>
    </div>
  `;
}

// ------------------------------------------------------------
// CURRENT OBSERVATIONS
// ------------------------------------------------------------
export function renderCurrentObservations(intel) {
  document.getElementById("wu-temp").textContent = `${intel.wu.temp}°`;
  document.getElementById("wu-feels").textContent = `Feels like ${intel.wu.feelsLike}°`;

  document.getElementById("wu-dew").textContent = `${intel.wu.dew}°`;
  document.getElementById("wu-humidity").textContent = `Humidity ${intel.wu.humidity}%`;

  document.getElementById("wu-wind").textContent = `${intel.wu.windSpeed} mph`;
  document.getElementById("wu-wind-gust").textContent = `Gusts ${intel.wu.windGust} mph`;
}
