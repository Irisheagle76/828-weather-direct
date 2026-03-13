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

/* -----------------------------------
   UV CLASSIFIER — top‑level export
----------------------------------- */
export function getUVClass(uv) {
  if (uv == null) return "";
  if (uv < 3) return "uv-low";
  if (uv < 6) return "uv-mod";
  if (uv < 8) return "uv-high";
  if (uv < 11) return "uv-very";
  return "uv-extreme";
}

/* -----------------------------------
   WIND + DIRECTION HELPERS
----------------------------------- */
export function degToCompass(deg) {
  if (deg == null) return "";
  const dirs = [
    "N","NNE","NE","ENE","E","ESE","SE","SSE",
    "S","SSW","SW","WSW","W","WNW","NW","NNW"
  ];
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

// ⭐ WIND HANDLING WITH CALM + VARIABLE
let windText = "--";

if (wu.windSpeed != null) {
  const speed = wu.windSpeed;
  const dir = wu.windDir;

  if (speed < 1) {
    // Calm conditions
    windText = "Calm";
  } else if (dir == null) {
    // Wind blowing but direction unavailable
    windText = `${speed.toFixed(0)} mph (variable)`;
  } else {
    // Normal case with direction
    windText = `${degToCompass(dir)} ${speed.toFixed(0)} mph`;
  }
}

document.getElementById("wu-wind").textContent = windText;

  document.getElementById("wu-wind-gust").textContent =
    wu.windGust != null ? `Gusts ${wu.windGust.toFixed(0)} mph` : "Gusts --";

 // ⭐ UV handling
const uvEl = document.getElementById("wu-uv");

uvEl.textContent = reliableUV != null ? reliableUV.toFixed(1) : "--";

// Remove old classes
uvEl.classList.remove("uv-low", "uv-mod", "uv-high", "uv-very", "uv-extreme");

// Add new class ONLY if valid
const uvClass = getUVClass(reliableUV);
if (uvClass) {
  uvEl.classList.add(uvClass);
}
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
  const isAfter7pm = hour >= 19;

  const todayModule = document.querySelector(".today-module");

  if (today.isEndOfDay || isAfter7pm) {
    document.getElementById("today-emoji").textContent = "🌙";
    document.getElementById("today-headline").textContent =
      "The day is winding down.";
    document.getElementById("today-text").textContent =
      "Fresh forecast updates arrive tomorrow morning.";

    todayModule.classList.add("fade-out");
    return;
  }

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
export function updateStationFooter(stationId, updatedAt) {
  const el = document.getElementById("wu-station-footer");
  el.textContent =
    `Live data from Weather Underground Station ${stationId} — ${formatUpdatedTime(updatedAt)}`;
}
// Format "Updated X seconds/minutes/hours ago"
function formatUpdatedTime(updatedAt) {
  if (!updatedAt) return "Updated recently";

  const now = Date.now();
  const ts = new Date(updatedAt).getTime();
  const diffMs = now - ts;

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);

  if (diffSec < 60) {
    return diffSec <= 1
      ? "Updated just now"
      : `Updated ${diffSec} seconds ago`;
  }

  if (diffMin < 60) {
    return diffMin === 1
      ? "Updated 1 minute ago"
      : `Updated ${diffMin} minutes ago`;
  }

  if (diffHr < 24) {
    return diffHr === 1
      ? "Updated 1 hour ago"
      : `Updated ${diffHr} hours ago`;
  }

  const updatedDate = new Date(updatedAt);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const isYesterday =
    updatedDate.getDate() === yesterday.getDate() &&
    updatedDate.getMonth() === yesterday.getMonth() &&
    updatedDate.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    const time = updatedDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    return `Updated yesterday at ${time}`;
  }

  const dateStr = updatedDate.toLocaleDateString([], {
    month: "short",
    day: "numeric"
  });
  const timeStr = updatedDate.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });

  return `Updated ${dateStr} at ${timeStr}`;
}
/** 
 * High‑level UI update entry point.
 */
export function updateUI(intel) {
  console.log("WU object:", intel.wu);
  updateMetrics(intel.wu, intel.uv);
  updateComfort(intel.comfort);
  updateToday(intel.today);
  updateTomorrow(intel.tomorrow);
  renderForecastIcons(intel.alerts);
 updateStationFooter(intel.wu.stationId, intel.updatedAt);

  const micro = document.getElementById("micro-advice");
  micro.textContent = intel.today.suppressMicroAdvice ? "" : intel.microAdvice;
}   // ← updateUI ends cleanly here



// ===============================
// Expand / Collapse Forecast Panel
// ===============================

let expandedOpen = false;   // tracks open/closed state
let expandedFor = null;     // "today" or "tomorrow"

export function toggleForecastExpanded(which, intel) {
  const panel = document.getElementById("forecast-expanded");

  // If clicking the same module → collapse it
  if (expandedOpen && expandedFor === which) {
    panel.style.display = "none";
    expandedOpen = false;
    expandedFor = null;
    return;
  }

  // Otherwise → open and populate
  expandedOpen = true;
  expandedFor = which;

  const detail = which === "today" ? intel.todayDetail : intel.tomorrowDetail;

  document.getElementById("fx-hilo").textContent =
    `${detail.high}° / ${detail.low}°`;

  document.getElementById("fx-hourly").innerHTML = detail.hourly
    .map(h => `<div>${h.time} — ${h.temp}°, ${h.wind}, ${h.precip}%</div>`)
    .join("");

  document.getElementById("fx-precip").textContent = detail.precipWindow;
  document.getElementById("fx-windshifts").textContent = detail.windShifts;

  document.getElementById("fx-uv").innerHTML = detail.uvTimeline
    .map(u => `${u.time}: ${u.label} (${u.value})`)
    .join(" • ");

  document.getElementById("fx-confidence").textContent = detail.confidence;
  document.getElementById("fx-reasoning").textContent = detail.reasoning;

  panel.style.display = "block";
}
