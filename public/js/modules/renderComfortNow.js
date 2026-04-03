// /js/modules/renderComfortNow.js

export function renderComfortNow(container, comfort, bestWindow) {
  if (!container || !comfort) return;

  const score =
    comfort.comfortScore != null
      ? `${Math.round(comfort.comfortScore)} / 100`
      : "-- / 100";

  const bulletsHTML = (comfort.bullets || [])
    .slice(0, 3)
    .map(b => `<li>${b}</li>`)
    .join("");

  // -----------------------------
  // Best window (optional)
  // -----------------------------
  let bestHTML = "";

  if (bestWindow && bestWindow.hours?.length) {
    const first = bestWindow.hours[0];
    const last = bestWindow.hours[bestWindow.hours.length - 1];

    bestHTML = `
      <div class="comfort-expand-row">
        <span class="comfort-expand-label">Best Window</span>
        <span class="comfort-expand-value">
          ${first.hourLabel}–${last.hourLabel}
        </span>
      </div>

      <div class="fc-strip">
        ${bestWindow.hours
          .map(h => `
            <div class="fc-hour">
              <div class="fc-hour-label">${h.hourLabel}</div>
              <div class="fc-hour-main">
                <span class="fc-hour-emoji">${h.emoji}</span>
                <span class="fc-hour-temp">
                  ${h.temp != null ? Math.round(h.temp) + "°" : "--"}
                </span>
              </div>
              <div class="fc-hour-extra">
                ${h.comfortScore != null ? Math.round(h.comfortScore) : "--"}/100
              </div>
            </div>
          `)
          .join("")}
      </div>
    `;
  }

  // -----------------------------
  // FINAL RENDER
  // -----------------------------
  container.innerHTML = `
    <div class="comfort-module" data-accordion="comfort">

      <div class="comfort-main">
        <div class="comfort-emoji">${comfort.emoji || "🌤️"}</div>

        <div class="comfort-text-block">
          <div class="comfort-label">Comfort Now</div>
          <div class="comfort-text">
            ${comfort.headline || "Comfort overview"}
          </div>
          <div class="comfort-sub">${score}</div>
        </div>
      </div>

      <div class="comfort-expand">

        <ul class="comfort-bullets">
          ${bulletsHTML}
        </ul>

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

        ${bestHTML}

      </div>
    </div>
  `;
}