// /js/modules/renderComfortNow.js

export function renderComfortNow(container, comfort, bestWindow) {
  if (!container || !comfort) return;

 const scoreValue =
  comfort.comfortScore != null
    ? Math.round(comfort.comfortScore)
    : null;

const score =
  scoreValue != null
    ? `${scoreValue} / 100`
    : "-- / 100";

const scoreClass = getComfortClass(scoreValue);

  const bulletsHTML = (comfort.bullets || [])
    .slice(0, 3)
    .map(b => `<li>${b}</li>`)
    .join("");

  container.innerHTML = `
    <div class="comfort-module" data-accordion="comfort">

      <!-- TOP ROW -->
      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji || "🌤️"}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>

          <div class="comfort-score-row">
  <div class="comfort-score ${scoreClass}">
    ${score}
  </div>

  <button class="comfort-info-btn" aria-expanded="false">
    ⓘ
  </button>
</div>

<div class="comfort-explainer hidden">
  Blends temperature, humidity, wind, and sun into a 0–100 comfort score.
</div>

          <div class="comfort-text">
            ${comfort.headline || "Comfort overview"}
          </div>
        </div>
      </div>

      <!-- BULLETS -->
      <div class="comfort-body">
        <ul class="comfort-bullets">
          ${bulletsHTML}
        </ul>
      </div>

      <!-- EXPANDED PANEL -->
      <div class="comfort-expand">

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Feels Like</span>
          <span class="comfort-expand-value">
            ${comfort.feelsLike != null ? Math.round(comfort.feelsLike) + "°" : "--"}
          </span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Humidity</span>
          <span class="comfort-expand-value">
            ${comfort.humidity != null ? Math.round(comfort.humidity) + "%" : "--"}
          </span>
        </div>

        <div class="comfort-expand-row">
          <span class="comfort-expand-label">Wind</span>
          <span class="comfort-expand-value">
            ${comfort.windSpeed != null ? Math.round(comfort.windSpeed) + " mph" : "--"}
          </span>
        </div>

        ${renderBestWindow(bestWindow)}

      </div>

    </div>
  `;
  attachComfortInfoToggle(container);
  attachComfortAccordion(container);

}

// ============================================================
// BEST WINDOW HELPER
// ============================================================

function renderBestWindow(bestWindow) {
  if (!bestWindow || !bestWindow.hours?.length) return "";

  const first = bestWindow.hours[0];
  const last = bestWindow.hours[bestWindow.hours.length - 1];

  return `
    <div class="comfort-expand-row">
      <span class="comfort-expand-label">Best Window</span>
      <span class="comfort-expand-value">
        ${first.hourLabel}–${last.hourLabel}
      </span>
    </div>

    <div class="comfort-extra-line">
      Most comfortable stretch based on lower humidity, lighter wind, and better temperature balance.
    </div>
  `;

}
function attachComfortInfoToggle(container) {
  const btn = container.querySelector(".comfort-info-btn");
  const explainer = container.querySelector(".comfort-explainer");

  if (!btn || !explainer) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // 🔥 VERY IMPORTANT

    const isHidden = explainer.classList.toggle("hidden");
    btn.setAttribute("aria-expanded", !isHidden);
  });
}

function getComfortClass(score) {
  if (score == null) return "neutral";

  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "okay";
  if (score >= 35) return "poor";
  return "bad";
}

// ============================================================
// Comfort Now Accordion
// ============================================================

function attachComfortAccordion(container) {
  const module = container.querySelector(".comfort-module");
  if (!module) return;

  module.addEventListener("click", (e) => {
    // ignore clicks on info button
    if (e.target.closest(".comfort-info-btn")) return;

    module.classList.toggle("active");
  });
}