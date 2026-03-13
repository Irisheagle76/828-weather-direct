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
  export function getUVClass(uv) {
  if (uv == null) return "";
  if (uv < 3) return "uv-low";
  if (uv < 6) return "uv-mod";
  if (uv < 8) return "uv-high";
  if (uv < 11) return "uv-very";
  return "uv-extreme";
}
}
// -----------------------------
// WIND + DIRECTION HELPERS
// -----------------------------
export function degToCompass(deg) {
  if (deg == null) return "";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
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
  wu.windSpeed != null
    ? `${degToCompass(wu.windDir)} ${wu.windSpeed.toFixed(0)} mph`
    : "--";
  
  document.getElementById("wu-wind-gust").textContent =
    wu.windGust != null ? `Gusts ${wu.windGust.toFixed(0)} mph` : "Gusts --";

const uvEl = document.getElementById("wu-uv");

uvEl.textContent = wu.uv != null ? wu.uv.toFixed(1) : "--";

/* Remove old classes */
uvEl.classList.remove("uv-low", "uv-mod", "uv-high", "uv-very", "uv-extreme");

/* Add new color class */
uvEl.classList.add(getUVClass(wu.uv));
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
  const now = new Date();
  const hour = now.getHours();
  const isAfter7pm = hour >= 19; // 7 PM local time

  const todayModule = document.querySelector(".today-module");

  // If it's after 7 PM OR intel says the day is done,
  // override the content with the end-of-day message.
  if (today.isEndOfDay || isAfter7pm) {
    document.getElementById("today-emoji").textContent = "🌙";
    document.getElementById("today-headline").textContent = "The day is winding down.";
    document.getElementById("today-text").textContent = "Fresh forecast updates arrive tomorrow morning.";

    todayModule.classList.add("fade-out");
    return;
  }

  // Otherwise, show the normal intel-driven content
  document.getElementById("today-emoji").textContent = today.emoji;
  document.getElementById("today-headline").textContent = today.headline;
  document.getElementById("today-text").textContent = today.text;

  todayModule.classList.remove("fade-out");
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
const micro = document.getElementById("micro-advice");

if (intel.today.suppressMicroAdvice) {
  micro.textContent = "";
} else {
  micro.textContent = intel.microAdvice;
}
}
