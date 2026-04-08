// ============================================================
// HUMAN ACTION RENDER (STABLE + ACCORDION FIXED)
// ============================================================

// 🔒 prevent duplicate listeners
let haAccordionInitialized = false;

// ============================================================
// MAIN BLOCK RENDER
// ============================================================

export function renderHumanAction(today, tomorrow) {
  setBlock("today", today);
  setBlock("tomorrow", tomorrow);
}

function setBlock(type, data) {
  if (!data) return;

  const prefix = `ha-${type}`;

  setText(`${prefix}-emoji`, data.emoji);
  setText(`${prefix}-title`, data.headline);
  setText(`${prefix}-body`, data.narrative);

  setHTML(
    `${prefix}-bullets`,
    (data.bullets || []).map(b => `<li>${b}</li>`).join("")
  );

  const gold = document.getElementById(`${prefix}-goldilocks`);
  if (gold) {
    gold.style.display = data.goldilocks ? "inline-block" : "none";
  }
}

// ============================================================
// EXPANDED PANEL
// ============================================================

export function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  setExpanded("today", todayIntel);
  setExpanded("tomorrow", tomorrowIntel);

  setupAccordionGroup(); // 🔥 initialize once
}

function setExpanded(type, intel) {
  const el = document.getElementById(`ha-${type}-expanded`);
  if (!el || !intel) return;

  const s = intel.snapshot || {};

  const high = intel.stats?.tempMax ?? s.temp ?? null;
  const low = intel.stats?.tempMin ?? s.temp ?? null;
  const dew = s.dewPoint ?? null;
  const wind = s.windSpeed ?? null;
  const gust = s.windGust ?? null;
  const precipChance = intel.precipChance ?? null;
  const precipType = s.precipType ?? "";

  el.innerHTML = `
  <div class="fx-grid">

  <!-- 🌡️ DAILY RANGE (PRIMARY) -->
  <div 
  class="fx-tile primary"
  style="background:${getTempTone(high)};"
>
    <div class="fx-icon">🌡️</div>
    <div class="fx-top">
      ${high != null ? `${Math.round(high)}° / ${Math.round(low)}°` : "--"}
    </div>
    <div class="fx-sub">Daily Range</div>
  </div>

  <!-- 💧 HUMIDITY FEEL -->
  <div class="fx-tile">
    <div class="fx-icon">💧</div>
    <div class="fx-top">
      ${dew != null ? Math.round(dew) + "°" : "--"}
    </div>
    <div class="fx-sub">Humidity Feel</div>
  </div>

  <!-- 🌬️ WIND -->
  <div class="fx-tile">
    <div class="fx-icon">🌬️</div>
    <div class="fx-top">
      ${wind != null ? Math.round(wind) + " mph" : "--"}
    </div>
    <div class="fx-sub">
      ${gust != null ? `Gusts ${Math.round(gust)}` : "Wind"}
    </div>
  </div>

  <!-- 🌧️ PRECIP -->
  <div class="fx-tile">
    <div class="fx-icon">🌧️</div>
    <div class="fx-top">
      ${precipChance != null ? precipChance + "%" : "Dry"}
    </div>
    <div class="fx-sub">
      ${precipChance ? "Rain chance" : "No precipitation"}
    </div>
  </div>

</div>

  <div class="fx-highlight good">
  <div class="fx-highlight-label">Best Time</div>
  <div class="fx-highlight-time">
    ${formatHourRange(intel.bestWindow?.start, intel.bestWindow?.end)}
  </div>
</div>

<div class="fx-highlight bad">
  <div class="fx-highlight-label">Toughest</div>
  <div class="fx-highlight-time">
    ${formatHourRange(intel.worstWindow?.start, intel.worstWindow?.end)}
  </div>
</div>

  <div class="fx-block">
  <div class="fx-title">Toughest Stretch</div>
  <div class="fx-main">
    ${formatHourRange(intel.worstWindow?.start, intel.worstWindow?.end)}
  </div>
</div>

    ${renderDayparts(intel.dayparts)}

  `;
}

// ============================================================
// ACCORDION (FINAL FIXED SYSTEM)
// ============================================================

function setupAccordionGroup() {
  if (haAccordionInitialized) return;
  haAccordionInitialized = true;

  const items = document.querySelectorAll("[data-accordion-item]");

  items.forEach(item => {
    const content = item.querySelector("[data-accordion-content]");
    if (!content) return;

    // start collapsed
    content.classList.add("accordion-collapsed");

    item.addEventListener("click", () => {
      console.log("CLICK DETECTED");

      const isOpen = content.classList.contains("accordion-open");

      // close all
      document.querySelectorAll("[data-accordion-content]").forEach(c => {
        c.classList.remove("accordion-open");
        c.classList.add("accordion-collapsed");
      });

      // open clicked
      if (!isOpen) {
        content.classList.remove("accordion-collapsed");
        content.classList.add("accordion-open");
      }
    });
  });
}

// ============================================================
// HELPERS
// ============================================================

function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = value;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function formatHourRange(start, end) {
  if (start == null || end == null) return "--";

  const fmt = h => {
    const suffix = h >= 12 ? "PM" : "AM";
    const display = h % 12 || 12;
    return `${display}${suffix}`;
  };

  return `${fmt(start)}–${fmt(end)}`;
}

function renderDayparts(dayparts) {
  if (!dayparts) return "";

  const labels = {
    am_commute: "AM Commute",
    lunch: "Lunch",
    pm_commute: "PM Commute",
    dinner: "Dinner",
    late_night: "Late Night"
  };

  return `
    <div class="fx-dayparts">
      ${Object.entries(dayparts).map(([key, val]) => `
        <div class="fx-row">
          <span>${labels[key]}</span>
          <div class="fx-bar">
            <div 
  class="fx-fill" 
  style="
    width:${val.avg}%;
    background:${getComfortColor(val.avg)};
  ">
</div>
          </div>
          <span>${val.avg}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function buildExplanation(intel) {
  switch (intel.dominantFactor) {
    case "humidity":
      return "Humidity is the main factor affecting comfort.";
    case "heat":
      return "Heat is reducing comfort levels.";
    case "wind":
      return "Wind is shaping how it feels outside.";
    default:
      return "Conditions are fairly balanced.";
  }
}

/* 🔥 ADD RIGHT BELOW */
function getTempTone(temp) {
  if (temp == null) return "rgba(255,255,255,0.1)";
  if (temp >= 85) return "rgba(255,120,120,0.15)";
  if (temp >= 70) return "rgba(255,200,120,0.15)";
  if (temp >= 55) return "rgba(120,200,120,0.15)";
  return "rgba(120,160,255,0.15)";
}

function getComfortColor(score) {
  if (score >= 85) return "#22c55e";
  if (score >= 70) return "#84cc16";
  if (score >= 55) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}