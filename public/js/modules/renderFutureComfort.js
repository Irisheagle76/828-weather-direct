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

            const score =
              h.score != null && !isNaN(h.score)
                ? Math.round(h.score)
                : null;

            const scoreClass = getScoreClass(score);

            return `
              <div class="next6-hour">

                <div class="next6-hour-label">${h.hourLabel}</div>

                <div class="next6-hour-emoji">
                  ${h.emoji || "—"}
                </div>

                <div class="next6-hour-temp">${temp}</div>

                ${
                  score != null
                    ? `<div class="next6-hour-score ${scoreClass}">
                        ${score}
                       </div>`
                    : ""
                }

                <div class="next6-hour-factor">
                  ${h.label || ""}
                </div>

              </div>
            `;
          })
          .join("")}
      </div>

    </div>
  `;
}

// ============================================================
// SCORE COLOR HELPER
// ============================================================

function getScoreClass(score) {
  if (score == null) return "neutral";

  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "okay";
  if (score >= 35) return "poor";
  return "bad";
}