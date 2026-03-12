// /js/weather-render.js

/**
 * Update the WU connection status badge + text.
 */
export function setWUStatus(state, label, text) {
  const dot = document.getElementById("wu-status-dot");
  const lbl = document.getElementById("wu-status-label");
  const desc = document.getElementById("wu-status-text");

  lbl.textContent = label;
  desc.textContent = text;

  dot.classList.remove("ok", "error");
  if (state === "ok") dot.classList.add("ok");
  if (state === "error") dot.classList.add("error");
}

/**
 * Show a visible error message under the modules.
 */
export function showWUError(msg) {
  const el = document.getElementById("wu-error");
  el.textContent = msg;
  el.style.display = "block";
}

/**
 * Render clickable alert icons + detail box.
 */
export function renderForecastIcons(alerts) {
  const container = document.getElementById("forecast-icons");
  const detailBox = document.getElementById("forecast-detail");

  container.innerHTML = "";
  detailBox.innerHTML = "";
  detailBox.style.display = "none";
  detailBox.dataset.open = "";

  alerts.forEach(alert => {
    const iconEl = document.createElement("span");
    iconEl.className = "forecast-icon";
    iconEl.textContent = alert.icon;
    iconEl.dataset.alertId = alert.id;

    iconEl.addEventListener("click", () => {
      if (detailBox.dataset.open === alert.id) {
        detailBox.style.display = "none";
        detailBox.dataset.open = "";
        return;
      }

      detailBox.innerHTML = `
        <div class="detail-title">${alert.icon} ${alert.title}</div>
        <div class="detail-text">${alert.detail}</div>
      `;
      detailBox.style.display = "block";
      detailBox.dataset.open = alert.id;
    });

    container.appendChild(iconEl);
  });
}

/**
 * Update the top metrics row (temp, dew, wind, UV, etc.)
 */
export function updateMetrics(wu, reliableUV) {
  document.getElementById("wu-temp").textContent =
    wu.temp != null ? `${wu.temp.toFixed(0)}°F` : "--";

  document.getElementById("wu-feels").textContent =
    wu.temp != null ? `Feels like ${wu.temp.toFixed(0)}°F` : "Feels like --";

  document.getElementById("wu-dew").textContent =
    wu.dewPoint != null ? `${wu.dewPoint.toFixed(0)}°F` : "--";

  document.getElementById("wu-humidity").textContent =
    wu.humidity != null ? `Humidity ${wu.humidity}%` : "Humidity --";

  document.getElementById("wu-wind").textContent =
    wu.windSpeed != null ? `${wu.windSpeed.toFixed(0)} mph` : "--";

  document.getElementById("wu-wind-gust").textContent =
    wu.windGust != null ? `Gusts ${wu.windGust.toFixed(0)} mph` : "Gusts --";

  document.getElementById("wu-solar").textContent =
    wu.solarRadiation != null ? `${wu.solarRadiation.toFixed(0)} W/m²` : "Solar --";

  document.getElementById("wu-uv").textContent =
    reliableUV != null ? `UV ${reliableUV.toFixed(1)}` : "--";
}

/**
 * Update the comfort module.
 */
export function updateComfort(comfort) {
  document.getElementById("comfort-text").textContent = comfort.text;
  document.getElementById("comfort-emoji").textContent = comfort.emoji;
}

/**
 * Update today's human‑action outlook.
 */
export function updateToday(today) {
  document.getElementById("today-emoji").textContent = today.emoji;
  document.getElementById("today-headline").textContent = today.headline;
  document.getElementById("today-text").textContent = today.text;
  }

/**
 * Update tomorrow's human‑action outlook.
 */
export function updateTomorrow(outlook) {
  document.getElementById("action-badge").textContent = outlook.badge.text;
  document.getElementById("action-badge").className =
    "action-badge " + outlook.badge.class;

  document.getElementById("action-emoji").textContent = outlook.emoji;
  document.getElementById("action-headline").textContent = outlook.headline;
  document.getElementById("action-text").textContent = outlook.text;
}

/**
 * Update the footer station ID.
 */
export function updateStationFooter(stationId) {
  document.getElementById("wu-station-footer").textContent =
    `Live data from Weather Underground Station ${stationId}`;
}

/**
 * High‑level UI update entry point.
 * This will be used once forecast-intel-plus.js is integrated.
 */
export function updateUI(intel) {
  updateMetrics(intel.wu, intel.uv);
  updateComfort(intel.comfort);
  updateToday(intel.today);
  updateTomorrow(intel.tomorrow);
  renderForecastIcons(intel.alerts);
  updateStationFooter(intel.wu.stationId);
  document.getElementById("micro-advice").textContent = intel.microAdvice;
}
