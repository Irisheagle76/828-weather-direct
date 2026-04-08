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

      <div class="fx-tile">
        <div class="fx-top">
          ${high != null ? `${Math.round(high)}° / ${Math.round(low)}°` : "--"}
        </div>
        <div class="fx-sub">High / Low</div>
        <div class="fx-label">Temperature</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">${dew != null ? Math.round(dew) + "°" : "--"}</div>
        <div class="fx-sub">Dew Point</div>
        <div class="fx-label">Moisture</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">${wind != null ? Math.round(wind) + " mph" : "--"}</div>
        <div class="fx-sub">
          ${gust != null ? `Gusts ${Math.round(gust)} mph` : ""}
        </div>
        <div class="fx-label">Wind</div>
      </div>

      <div class="fx-tile">
        <div class="fx-top">
          ${precipChance != null ? precipChance + "%" : "--"}
        </div>
        <div class="fx-sub">${precipType}</div>
        <div class="fx-label">Precipitation</div>
      </div>

    </div>

    <div class="fx-block">
      <div class="fx-title">Best Window</div>
      <div class="fx-main">
        ${formatHourRange(intel.bestWindow?.start, intel.bestWindow?.end)}
      </div>
    </div>

    <div class="fx-block">
      <div class="fx-title">Toughest Stretch</div>
      <div class="fx-main">
        ${formatHourRange(intel.worstWindow?.start, intel.worstWindow?.end)}
      </div>
    </div>

    ${renderDayparts(intel.dayparts)}

    <div class="fx-explain">
      ${buildExplanation(intel)}
    </div>
  `;
}

// ============================================================
// ACCORDION (FINAL FIXED SYSTEM)
// ============================================================

function setupAccordionGroup() {
  if (haAccordionInitialized) return;
  haAccordionInitialized = true;

  const container = document.querySelector('[data-accordion="ha"]');
  if (!container) return;

  const items = container.querySelectorAll("[data-accordion-item]");

  // ✅ initialize collapsed state ONCE
  items.forEach(item => {
    const content = item.querySelector("[data-accordion-content]");
    if (!content) return;

    content.classList.add("accordion-expand", "accordion-collapsed");
  });

  // ✅ event delegation (ONE listener)
  container.addEventListener("click", (e) => {

    // 🚫 ignore clicks inside expanded content
    if (e.target.closest("[data-accordion-content]")) return;

   const trigger = e.target.closest("[data-accordion-trigger]");
if (!trigger) return;

const item = trigger.closest("[data-accordion-item]");
    if (!item) return;

    const content = item.querySelector("[data-accordion-content]");
    if (!content) return;

    const isOpen = content.classList.contains("accordion-open");

    // close all
    items.forEach(i => {
      const c = i.querySelector("[data-accordion-content]");
      if (!c) return;
      c.classList.remove("accordion-open");
      c.classList.add("accordion-collapsed");
    });

    // open clicked
    if (!isOpen) {
      content.classList.remove("accordion-collapsed");
      content.classList.add("accordion-open");
    }
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
          <span>${labels[key] || key}</span>
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