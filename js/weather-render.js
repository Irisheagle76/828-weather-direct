// /js/weather-render.js
// ============================================================
// WEATHER RENDERER — Today, Tomorrow, Comfort, UV, Details
// ============================================================

// ------------------------------------------------------------
// Compass helper (used by intel-plus)
// ------------------------------------------------------------
export function degToCompass(deg) {
  if (deg == null) return "";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE",
                "S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

// ------------------------------------------------------------
// UV class helper (used by intel-plus)
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
// HYBRID BULLET RENDERER
// ------------------------------------------------------------
function renderBullets(ul, bullets) {
  ul.innerHTML = "";

  bullets.forEach(b => {
    const li = document.createElement("li");

    // If bullet starts with an emoji → use it as-is
    if (/^[\p{Emoji}]/u.test(b)) {
      li.textContent = b;
    } else {
      // Otherwise prefix with a dot
      li.textContent = "• " + b;
    }

    ul.appendChild(li);
  });
}

// ------------------------------------------------------------
// RENDER RIGHT NOW COMFORT
// ------------------------------------------------------------
export function renderRightNowComfort(intel) {
  const el = document.getElementById("right-now-comfort");
  if (!el) return;

  const { category, summary, emoji } = intel.rightNowComfort;

  el.querySelector(".emoji").textContent = emoji;
  el.querySelector(".category").textContent = category;
  el.querySelector(".summary").textContent = summary;
}

// ------------------------------------------------------------
// RENDER TODAY OUTLOOK
// ------------------------------------------------------------
export function renderTodayOutlook(intel) {
  const el = document.getElementById("today-outlook");
  if (!el) return;

  const { badge, emoji, headline, text, bullets } = intel.today;

  el.querySelector(".badge").textContent = badge.text;
  el.querySelector(".badge").className = `badge ${badge.class}`;
  el.querySelector(".emoji").textContent = emoji;
  el.querySelector(".headline").textContent = headline;
  el.querySelector(".reason").textContent = text;

  const ul = el.querySelector(".bullets");
  renderBullets(ul, bullets);
}

// ------------------------------------------------------------
// RENDER TOMORROW OUTLOOK
// ------------------------------------------------------------
export function renderTomorrowOutlook(intel) {
  const el = document.getElementById("tomorrow-outlook");
  if (!el) return;

  const { badge, emoji, headline, text, bullets } = intel.tomorrow;

  el.querySelector(".badge").textContent = badge.text;
  el.querySelector(".badge").className = `badge ${badge.class}`;
  el.querySelector(".emoji").textContent = emoji;
  el.querySelector(".headline").textContent = headline;
  el.querySelector(".reason").textContent = text;

  const ul = el.querySelector(".bullets");
  renderBullets(ul, bullets);
}

// ------------------------------------------------------------
// RENDER UV INDEX (optional)
// ------------------------------------------------------------
export function renderUV(intel) {
  const el = document.getElementById("uv-box");
  if (!el) return;

  const uv = intel.uv ?? 0;
  el.querySelector(".uv-value").textContent = uv.toFixed(1);
  el.className = `uv-box ${getUVClass(uv)}`;
}

// ------------------------------------------------------------
// RENDER TODAY DETAIL (hourly, precip window, etc.)
// ------------------------------------------------------------
export function renderTodayDetail(intel) {
  const el = document.getElementById("today-detail");
  if (!el) return;

  const d = intel.todayDetail;

  el.querySelector(".high").textContent = d.high;
  el.querySelector(".low").textContent = d.low;
  el.querySelector(".precip-window").textContent = d.precipWindow;
  el.querySelector(".wind-shifts").textContent = d.windShifts;
  el.querySelector(".confidence").textContent = d.confidence;
  el.querySelector(".reasoning").textContent = d.reasoning;

  const hourlyEl = el.querySelector(".hourly");
  hourlyEl.innerHTML = "";

  d.hourly.forEach(h => {
    const div = document.createElement("div");
    div.className = "hour-block";
    div.innerHTML = `
      <div class="time">${new Date(h.time).toLocaleTimeString([], { hour: "numeric" })}</div>
      <div class="temp">${h.temp}°</div>
      <div class="wind">${h.wind}</div>
      <div class="precip">${h.precip}%</div>
    `;
    hourlyEl.appendChild(div);
  });
}

// ------------------------------------------------------------
// RENDER TOMORROW DETAIL
// ------------------------------------------------------------
export function renderTomorrowDetail(intel) {
  const el = document.getElementById("tomorrow-detail");
  if (!el) return;

  const d = intel.tomorrowDetail;

  el.querySelector(".high").textContent = d.high;
  el.querySelector(".low").textContent = d.low;
  el.querySelector(".precip-window").textContent = d.precipWindow;
  el.querySelector(".confidence").textContent = d.confidence;
  el.querySelector(".reasoning").textContent = d.reasoning;

  const peak = d.peakUV;
  const uvEl = el.querySelector(".peak-uv");

  if (peak.max <= 2) {
    uvEl.textContent = `Peak UV: ${peak.max} (low)`;
  } else {
    uvEl.textContent = `Peak UV: ${peak.max} at ${peak.hours.map(h => {
      const hr = h % 12 || 12;
      const suffix = h >= 12 ? "PM" : "AM";
      return `${hr} ${suffix}`;
    }).join(", ")}`;
  }
  // ------------------------------------------------------------
// EXPANSION PANEL TOGGLER (Today / Tomorrow)
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
}
