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
   LOCAL TIME HELPERS
----------------------------------- */
function formatHourLocal(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], {
    hour: "numeric",
    minute: undefined
  });
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
      windText = "Calm";
    } else if (dir == null) {
      windText = `${speed.toFixed(0)} mph (variable)`;
    } else {
      windText = `${degToCompass(dir)} ${speed.toFixed(0)} mph`;
    }
  }

  document.getElementById("wu-wind").textContent = windText;

  document.getElementById("wu-wind-gust").textContent =
    wu.windGust != null ? `Gusts ${wu.windGust.toFixed(0)} mph` : "Gusts --";

  // ⭐ UV handling
  const uvEl = document.getElementById("wu-uv");

  uvEl.textContent = reliableUV != null ? reliableUV.toFixed(1) : "--";

  uvEl.classList.remove("uv-low", "uv-mod", "uv-high", "uv-very", "uv-extreme");

  const uvClass = getUVClass(reliableUV);
  if (uvClass) uvEl.classList.add(uvClass);
}

/**
 * Update the comfort module.
 */
export function updateComfort(comfort) {
  document.getElementById("comfort-text").textContent = comfort.text;
  document.getElementById("comfort-emoji").textContent = comfort.emoji;
}

function to12Hour(h) {
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = ((h + 11) % 12) + 1;
  return `${hour} ${suffix}`;
}

/**
 * Update today's human‑action outlook — now with hybrid bullet list.
 */
export function updateToday(today) {
  const now = new Date();
  const hour = now.getHours();
  const isAfter7pm = hour >= 19;

  const todayModule = document.querySelector(".today-module");

  // End-of-day fade
  if (today.isEndOfDay || isAfter7pm) {
    document.getElementById("today-emoji").textContent = "🌙";
    document.getElementById("today-headline").textContent =
      "The day is winding down.";
    document.getElementById("today-text").textContent =
      "Fresh forecast updates arrive tomorrow morning.";

    // Clear bullets at night
    const bulletBox = document.getElementById("today-bullets");
    if (bulletBox) bulletBox.innerHTML = "";

    todayModule.classList.add("fade-out");
    return;
  }

  // Normal daytime rendering
  document.getElementById("today-emoji").textContent = today.emoji;
  document.getElementById("today-headline").textContent = today.headline;
  document.getElementById("today-text").textContent = today.text;

  todayModule.classList.remove("fade-out");

  // ⭐ BULLET LIST RENDERING (Hybrid style)
  const bulletBox = document.getElementById("today-bullets");
  if (bulletBox) {
    bulletBox.innerHTML = today.bullets
      .map(b => {
        // If bullet already starts with an emoji → keep it
        const hasEmoji = /^[\p{Emoji}]/u.test(b);

        // Otherwise use a clean bullet dot
        const prefix = hasEmoji ? "" : "• ";

        return `<div class="today-bullet">${prefix}${b}</div>`;
      })
      .join("");
  }
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

  updateStationFooter(intel.wu.stationId, intel.updatedAt);

  const micro = document.getElementById("micro-advice");
  micro.textContent = intel.today.suppressMicroAdvice ? "" : intel.microAdvice;
}

// ===============================
// Expand / Collapse Forecast Panel
// ===============================

let expandedFor = null;

export function toggleForecastExpanded(which, intel) {
  const panel = document.getElementById(`expanded-${which}`);
  const isOpen = panel.classList.contains("open");

  // Close all panels
  document.querySelectorAll(".expanded-panel").forEach(p => {
    p.classList.remove("open");
    p.style.display = "none";
  });

  if (isOpen) {
    expandedFor = null;
    return;
  }

  expandedFor = which;

  const detail = which === "today" ? intel.todayDetail : intel.tomorrowDetail;

  panel.innerHTML = `
    <div class="fx-section">
      <div class="fx-label">High / Low</div>
      <div class="fx-value">${detail.high}° / ${detail.low}°</div>
    </div>

    ${which === "today" ? `
      <div class="fx-section">
        <div class="fx-label">Hour‑by‑Hour</div>
        <div class="fx-value fx-hourly">
          ${detail.hourly.map(h => `
            <div>${formatHourLocal(h.time)} — ${h.temp}°, ${h.wind}, ${h.precip}%</div>
          `).join("")}
        </div>
      </div>
    ` : ""}

    <div class="fx-section">
      <div class="fx-label">Precipitation Window</div>
      <div class="fx-value">${detail.precipWindow}</div>
    </div>

    ${which === "today" ? `
      <div class="fx-section">
        <div class="fx-label">Wind Shifts</div>
        <div class="fx-value">${detail.windShifts}</div>
      </div>

      <div class="fx-section">
        <div class="fx-label">UV Timeline</div>
        <div class="fx-value">
          ${detail.uvTimeline.map(u => `${u.time}: ${u.label} (${u.value})`).join(" • ")}
        </div>
      </div>
    ` : ""}

    ${which === "tomorrow" ? `
      <div class="fx-section">
        <div class="fx-label">Highest UV</div>
        <div class="fx-value">
          ${
            detail.peakUV.hours.length === 0
              ? `Low all day (max ${detail.peakUV.max})`
              : `${detail.peakUV.hours.map(h => to12Hour(h)).join(" • ")} (UV ${detail.peakUV.max})`
          }
        </div>
      </div>
    ` : ""}

    <div class="fx-section">
      <div class="fx-label">Forecast Confidence</div>
      <div class="fx-value">${detail.confidence}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Why This Forecast</div>
      <div class="fx-value">${detail.reasoning}</div>
    </div>
  `;

  panel.style.display = "block";
  panel.classList.add("open");
}
