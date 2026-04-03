// /js/modules/renderFutureComfort.js

export function renderFutureComfort(container, items) {
  if (!container || !Array.isArray(items)) return;

  container.innerHTML = `
    <div class="comfort-module next6-module" data-accordion="future">

      <div class="next6-header">
        <div class="next6-label">Future Comfort</div>
      </div>

      <div class="next6-strip">
        ${items
          .map(h => {
            const temp =
              h.temp != null && !isNaN(h.temp)
                ? Math.round(h.temp) + "°"
                : "--";

            return `
              <div class="next6-hour">
                <div class="next6-hour-label">${h.hourLabel}</div>
                <div class="next6-hour-emoji">${h.emoji || "—"}</div>
                <div class="next6-hour-temp">${temp}</div>
                <div class="next6-hour-factor">${h.label || ""}</div>
              </div>
            `;
          })
          .join("")}
      </div>

    </div>
  `;
}