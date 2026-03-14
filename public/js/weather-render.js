// /js/weather-render.js
// ============================================================
// WEATHER RENDERER — Today, Tomorrow, Comfort, UV, Details
// ============================================================

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

  // -----------------------------
  // Temperature
  // -----------------------------
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

  // -----------------------------
  // Dew Point + Humidity
  // -----------------------------
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

  // -----------------------------
  // Wind + Gusts
  // -----------------------------
  if (windEl) {
    const dir = wu.windDir != null ? degToCompass(wu.windDir) : "";
    const spd = wu.windSpeed != null ? `${wu.windSpeed} mph` : "--";
    windEl.textContent = dir ? `${dir} ${spd}` : spd;
  }

  if (gustEl) {
    gustEl.textContent = wu.windGust != null ? `Gusts ${wu.windGust} mph` : "Gusts --";
  }

  // -----------------------------
  // UV (color‑coded)
  // -----------------------------
  if (uvEl) {
    uvEl.textContent = wu.uv != null ? wu.uv : "--";
    uvEl.className = "metric-value " + getUVClass(wu.uv ?? 0);
  }
}

// ------------------------------------------------------------
// Compass helper (used by intel-plus)
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
// BULLET DE-DUPLICATOR (semantic-ish)
// ------------------------------------------------------------
function dedupeBullets(bullets) {
  const seen = new Set();
  const result = [];

  bullets.forEach(b => {
    let key = b.toLowerCase();

    // Remove punctuation
    key = key.replace(/[^a-z0-9 ]/g, " ");

    // Normalize synonyms and phrasing
    key = key
      .replace(/\bjacket\b/g, "coat")
      .replace(/\bchilly\b/g, "cold")
      .replace(/\bearly\b/g, "morning")
      .replace(/\bmorning air\b/g, "morning")
      .replace(/\bair\b/g, "")
      .replace(/\bcoat helps\b/g, "coat recommended")
      .replace(/\bcoat is helpful\b/g, "coat recommended")
      .replace(/\bcoat recommended\b/g, "coat recommended");

    // Remove filler words
    key = key.replace(/\b(a|the|is|very|quite|bit|little)\b/g, "");

    // Collapse whitespace
    key = key.replace(/\s+/g, " ").trim();

    // ⭐ NEW: Sort words alphabetically to unify phrasing
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
  // Remove semantic duplicates
  bullets = dedupeBullets(bullets);

  ul.innerHTML = "";

  bullets.forEach(b => {
    const li = document.createElement("li");

    if (/^[\p{Emoji}]/u.test(b)) {
      li.textContent = b;
    } else {
      li.textContent = "• " + b;
    }

    ul.appendChild(li);
  });
}

// ------------------------------------------------------------
// RENDER RIGHT NOW COMFORT
// ------------------------------------------------------------
export function renderRightNowComfort(intel) {
  const emojiEl = document.getElementById("comfort-emoji");
  const textEl = document.getElementById("comfort-text");

  if (!emojiEl || !textEl) return;

  const { emoji, summary } = intel.rightNowComfort;

  emojiEl.textContent = emoji;
  textEl.textContent = summary;
}

// ------------------------------------------------------------
// RENDER TODAY OUTLOOK
// ------------------------------------------------------------
export function renderTodayOutlook(intel) {
  const emojiEl = document.getElementById("today-emoji");
  const headlineEl = document.getElementById("today-headline");
  const textEl = document.getElementById("today-text");
  const bulletsEl = document.getElementById("today-bullets");

  const { emoji, headline, text, bullets } = intel.today;

  emojiEl.textContent = emoji;
  headlineEl.textContent = headline;
  textEl.textContent = text;

  renderBullets(bulletsEl, bullets);
}

// ------------------------------------------------------------
// RENDER TOMORROW OUTLOOK
// ------------------------------------------------------------
export function renderTomorrowOutlook(intel) {
  const emojiEl = document.getElementById("tomorrow-emoji");
  const badgeEl = document.getElementById("tomorrow-badge");
  const headlineEl = document.getElementById("tomorrow-headline");
  const textEl = document.getElementById("tomorrow-text");
  const bulletsEl = document.getElementById("tomorrow-bullets");

  const { badge, emoji, headline, text, bullets } = intel.tomorrow;

  emojiEl.textContent = emoji;
  badgeEl.textContent = badge.text;
  badgeEl.className = `badge ${badge.class}`;
  headlineEl.textContent = headline;
  textEl.textContent = text;

  renderBullets(bulletsEl, bullets);
}

// ------------------------------------------------------------
// RENDER UV INDEX (FORECAST)
// ------------------------------------------------------------
export function renderUV(intel) {
  const uvEl = document.getElementById("wu-uv");
  if (!uvEl) return;

  const uv = intel.uv ?? 0;
  uvEl.textContent = uv.toFixed(1);
  uvEl.className = getUVClass(uv);
}

// ------------------------------------------------------------
// RENDER TODAY DETAIL
// ------------------------------------------------------------
export function renderTodayDetail(intel) {
  const panel = document.getElementById("expanded-today");
  if (!panel) return;

  const d = intel.todayDetail;

  panel.innerHTML = `
    <div class="fx-section">
      <div class="fx-label">High</div>
      <div class="fx-value">${d.high}°</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Low</div>
      <div class="fx-value">${d.low}°</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Precip Window</div>
      <div class="fx-value">${d.precipWindow}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Wind Shifts</div>
      <div class="fx-value">${d.windShifts}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Confidence</div>
      <div class="fx-value">${d.confidence}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Reasoning</div>
      <div class="fx-value">${d.reasoning}</div>
    </div>
  `;
}

// ------------------------------------------------------------
// RENDER TOMORROW DETAIL
// ------------------------------------------------------------
export function renderTomorrowDetail(intel) {
  const panel = document.getElementById("expanded-tomorrow");
  if (!panel) return;

  const d = intel.tomorrowDetail;

  const peak = d.peakUV;
  const peakText =
    peak.max <= 2
      ? `Peak UV: ${peak.max} (low)`
      : `Peak UV: ${peak.max} at ${peak.hours
          .map(h => {
            const hr = h % 12 || 12;
            const suffix = h >= 12 ? "PM" : "AM";
            return `${hr} ${suffix}`;
          })
          .join(", ")}`;

  panel.innerHTML = `
    <div class="fx-section">
      <div class="fx-label">High</div>
      <div class="fx-value">${d.high}°</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Low</div>
      <div class="fx-value">${d.low}°</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Precip Window</div>
      <div class="fx-value">${d.precipWindow}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Peak UV</div>
      <div class="fx-value">${peakText}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Confidence</div>
      <div class="fx-value">${d.confidence}</div>
    </div>

    <div class="fx-section">
      <div class="fx-label">Reasoning</div>
      <div class="fx-value">${d.reasoning}</div>
    </div>
  `;
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
