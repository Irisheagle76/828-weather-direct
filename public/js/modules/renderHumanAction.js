// ============================================================
// HUMAN ACTION RENDER (FINAL STABLE)
// ============================================================

// ============================================================
// MAIN BLOCK RENDER
// ============================================================

export function renderHumanAction(today, tomorrow) {
  renderBlock("today", today);
  renderBlock("tomorrow", tomorrow);
}

function renderBlock(type, data) {
  if (!data) return;

  const p = `ha-${type}`;

  setText(`${p}-emoji`, data.emoji);
  setText(`${p}-title`, data.headline);
  setText(`${p}-body`, data.narrative);

  setHTML(
    `${p}-bullets`,
    (data.bullets || []).map(b => `<li>${b}</li>`).join("")
  );

  const badge = document.getElementById(`${p}-goldilocks`);
  if (badge) {
    badge.style.display = data.goldilocks ? "inline-block" : "none";
  }
}

// ============================================================
// EXPANDED PANEL
// ============================================================

export function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  renderExpanded("today", todayIntel);
  renderExpanded("tomorrow", tomorrowIntel);

  // 🔥 ensure DOM is ready before binding
  setTimeout(setupAccordion, 0);
}

function renderExpanded(type, intel) {
  const el = document.getElementById(`ha-${type}-expanded`);
  if (!el || !intel) return;

  const s = intel.snapshot || {};

  const high = intel.stats?.tempMax ?? s.temp ?? null;
  const low = intel.stats?.tempMin ?? s.temp ?? null;
  const dew = s.dewPoint ?? null;
  const wind = s.windSpeed ?? null;
  const gust = s.windGust ?? null;
  const precip = intel.precipChance ?? null;

  el.innerHTML = `
    <div class="fx-grid">

      <div class="fx-tile primary" style="background:${getTempTone(high)};">
        <div class="fx-icon">🌡️</div>
        <div class="fx-top">
          ${high != null ? `${Math.round(high)}° / ${Math.round(low)}°` : "--"}
        </div>
        <div class="fx-sub">Daily Range</div>
      </div>

      <div class="fx-tile">
        <div class="fx-icon">💧</div>
        <div class="fx-top">
          ${dew != null ? Math.round(dew) + "°" : "--"}
        </div>
        <div class="fx-sub">Humidity Feel</div>
      </div>

      <div class="fx-tile">
        <div class="fx-icon">🌬️</div>
        <div class="fx-top">
          ${wind != null ? Math.round(wind) + " mph" : "--"}
        </div>
        <div class="fx-sub">
          ${gust != null ? `Gusts ${Math.round(gust)}` : "Wind"}
        </div>
      </div>

      <div class="fx-tile">
        <div class="fx-icon">🌧️</div>
        <div class="fx-top">
          ${precip != null ? precip + "%" : "Dry"}
        </div>
        <div class="fx-sub">
          ${precip ? "Rain chance" : "No precipitation"}
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
      <div class="fx-highlight-label">Toughest Stretch</div>
      <div class="fx-highlight-time">
        ${formatHourRange(intel.worstWindow?.start, intel.worstWindow?.end)}
      </div>
    </div>

    ${renderDayparts(intel.dayparts)}
  `;
}

// ============================================================
// ACCORDION (SIMPLE + RELIABLE)
// ============================================================

function setupAccordion() {
  document.querySelectorAll("[data-accordion-item]").forEach(item => {
    const trigger = item.querySelector("[data-accordion-trigger]");
    const content = item.querySelector("[data-accordion-content]");
    if (!trigger || !content) return;

    // reset every render (safe + simple)
    content.classList.add("accordion-expand");
    content.classList.add("accordion-collapsed");

trigger.onclick = () => {
  const group = item.closest("[data-accordion]");
  const isOpen = content.classList.contains("accordion-open");

  group.querySelectorAll("[data-accordion-item]").forEach(i => {
    i.classList.remove("open");
  });

  group.querySelectorAll("[data-accordion-content]").forEach(c => {
    c.classList.remove("accordion-open");
    c.classList.add("accordion-collapsed");
  });

  if (!isOpen) {
    content.classList.remove("accordion-collapsed");
    content.classList.add("accordion-open");
    item.classList.add("open"); // 🔥 this was missing
  }
};
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
    return `${h % 12 || 12}${suffix}`;
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
            <div class="fx-fill" style="
              width:${val.avg}%;
              background:${getComfortColor(val.avg)};
            "></div>
          </div>
          <span>${val.avg}</span>
        </div>
      `).join("")}
    </div>
  `;
}

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