// /js/weather-render.js
// ============================================================
// WEATHER RENDERER — Today, Tomorrow, Comfort, UV, Details
// FULL VERSION — PRESERVED + ENHANCED
// ============================================================


// ============================================================
// 🧠 REALITY ADJUSTMENT (ASHEVILLE TERRAIN TUNING)
// ============================================================
function adjustStatsForReality(stats) {
  if (!stats) return stats;

  const adjusted = { ...stats };

  // Asheville valley warm bias
  if (adjusted.tempMax != null) adjusted.tempMax += 3;

  // Reduce phantom rain
  if (adjusted.rainTotal != null && adjusted.rainTotal < 1) {
    adjusted.rainTotal *= 0.6;
  }

  // Reduce cloud bias slightly
  if (adjusted.cloudAvg != null) {
    adjusted.cloudAvg *= 0.9;
  }

  return adjusted;
}


// ============================================================
// PRECIP HELPERS
// ============================================================
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


// ============================================================
// HEADLINE FIT
// ============================================================
function fitHeadlineToWidth(el, maxSize = 1.25, minSize = 0.95) {
  if (!el) return;

  el.style.fontSize = `${maxSize}rem`;

  while (el.scrollWidth > el.clientWidth && maxSize > minSize) {
    maxSize -= 0.05;
    el.style.fontSize = `${maxSize}rem`;
  }
}


// ============================================================
// CURRENT OBS
// ============================================================
export function renderCurrentObservations(intel) {
  const wu = intel.wu;
  if (!wu) return;

  const tempEl = document.getElementById("wu-temp");
  const dewEl = document.getElementById("wu-dew");
  const humEl = document.getElementById("wu-humidity");
  const windEl = document.getElementById("wu-wind");
  const gustEl = document.getElementById("wu-wind-gust");
  const uvEl = document.getElementById("wu-uv");

  if (tempEl) tempEl.textContent = wu.temp != null ? `${wu.temp}°` : "--";
  if (dewEl) dewEl.textContent = wu.dewPoint != null ? `${wu.dewPoint}°` : "--";
  if (humEl) humEl.textContent = wu.humidity != null ? `Humidity ${wu.humidity}%` : "Humidity --";

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
    uvEl.className = "metric-value " + getUVClass(uv);
  }
}


// ============================================================
// COMPASS
// ============================================================
export function degToCompass(deg) {
  if (deg == null) return "";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}


// ============================================================
// INTELLIGENCE
// ============================================================
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
  if (stats.rainTotal > 0.4) return "rain";
  if (stats.windGustMax > 30) return "wind";
  if (stats.tempMax >= 90) return "hot";
  if (stats.tempMin <= 35) return "cold";

  if (
    stats.cloudAvg < 40 &&
    stats.rainTotal < 0.1 &&
    stats.tempMax >= 72 &&
    stats.tempMax <= 88
  ) return "goldilocks";

  return fallback ?? "easy";
}

function generateHumanHeadline(stats, fallback) {
  if (!stats) return fallback ?? "";

  const sky = getSkyCondition(stats);

  if (sky === "sunny" && stats.tempMax >= 75 && stats.tempMax <= 88)
    return "Beautiful day ahead";

  if (sky === "partly") return "A mix of sun and clouds";
  if (sky === "mostly-cloudy") return "More clouds than sun";
  if (sky === "cloudy") return "Gray and overcast conditions";

  return fallback ?? "";
}


// ============================================================
// UV CLASS
// ============================================================
export function getUVClass(uv) {
  if (uv <= 2) return "uv-low";
  if (uv <= 5) return "uv-moderate";
  if (uv <= 7) return "uv-high";
  if (uv <= 10) return "uv-very-high";
  return "uv-extreme";
}


// ============================================================
// BULLETS
// ============================================================
function dedupeBullets(bullets) {
  const seen = new Set();
  return bullets.filter(b => {
    const key = b.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderBullets(ul, bullets) {
  bullets = dedupeBullets(bullets);
  ul.innerHTML = "";
  bullets.forEach(b => {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  });
}


// ============================================================
// TODAY
// ============================================================
export function renderTodayOutlook(intel) {
  const today = intel.today;
  if (!today || !today.available) return;

  const headlineEl = document.getElementById("today-headline");
  const textEl = document.getElementById("today-text");
  const bulletsEl = document.getElementById("today-bullets");

  headlineEl.textContent = today.headline;
  fitHeadlineToWidth(headlineEl);

  textEl.textContent = today.narrative;
  renderBullets(bulletsEl, today.bullets);
}


// ============================================================
// TOMORROW (FIXED)
// ============================================================
export function renderTomorrowOutlook(intel) {
  const tomorrow = intel.tomorrow;
  if (!tomorrow || !tomorrow.available) return;

  const headlineEl = document.getElementById("tomorrow-headline");
  const textEl = document.getElementById("tomorrow-text");
  const bulletsEl = document.getElementById("tomorrow-bullets");
  const badgeEl = document.getElementById("tomorrow-badge");
  const badgeContainer = document.getElementById("tomorrow-badge-container");

  const stats = adjustStatsForReality(tomorrow.stats);

  const dominant = getDominantDriver(stats, tomorrow.events?.driver);

  const badgeMap = {
    rain: { text: "Rain Gear", class: "badge-rain" },
    wind: { text: "Wind Alert", class: "badge-wind" },
    snow: { text: "Snow Impact", class: "badge-snow" },
    hot: { text: "Heat Caution", class: "badge-heat" },
    cold: { text: "Cold Start", class: "badge-cold" },
    goldilocks: { text: "Perfect Day", class: "badge-goldilocks" }
  };

  const badge = badgeMap[dominant];

  if (badge) {
    badgeContainer.style.display = "block";
    badgeEl.textContent = badge.text;
    badgeEl.className = `badge ${badge.class}`;
  } else {
    badgeContainer.style.display = "none";
  }

  headlineEl.textContent = generateHumanHeadline(stats, tomorrow.headline);
  textEl.textContent = tomorrow.narrative;
  renderBullets(bulletsEl, tomorrow.bullets);
}


// ============================================================
// UV INDEX
// ============================================================
export function renderUV(intel) {
  const uvEl = document.getElementById("wu-uv");
  if (!uvEl) return;

  const uv = intel.uv ?? intel.wu?.uv ?? 0;
  uvEl.textContent = uv.toFixed(1);
  uvEl.className = "metric-value " + getUVClass(uv);
}


// ============================================================
// TODAY DETAIL
// ============================================================
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


// ============================================================
// TOMORROW DETAIL
// ============================================================
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


// ============================================================
// TOGGLE
// ============================================================
export function toggleForecastExpanded(which) {
  const panelToday = document.getElementById("expanded-today");
  const panelTomorrow = document.getElementById("expanded-tomorrow");

  if (which === "today") {
    const isOpen = panelToday.style.display === "block";
    panelToday.style.display = isOpen ? "none" : "block";
    panelTomorrow.style.display = "none";
  }

  if (which === "tomorrow") {
    const isOpen = panelTomorrow.style.display === "block";
    panelTomorrow.style.display = isOpen ? "none" : "block";
    panelToday.style.display = "none";
  }
}
