// /js/modules/renderHumanAction.js

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

export function renderHumanActionExpanded(todayIntel, tomorrowIntel) {
  setExpanded("today", todayIntel);
  setExpanded("tomorrow", tomorrowIntel);
}

function setExpanded(type, intel) {
  const el = document.getElementById(`ha-${type}-expanded`);
  if (!el || !intel || !intel.snapshot) return;

  const s = intel.snapshot;

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
  `;
}

// -----------------------------
// small helpers (local only)
// -----------------------------
function setText(id, value) {
  const el = document.getElementById(id);
  if (el && value != null) el.textContent = value;
}

function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}