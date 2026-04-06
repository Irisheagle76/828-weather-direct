// /js/modules/renderFutureComfort.js

export function renderFutureComfort(container, items, trend) {
  if (!container || !Array.isArray(items) || items.length === 0) return;

  const safeTrend = trend || "steady";

  const startLabel = items?.[0]?.hourLabel || "";
  const headerText = startLabel
    ? `Next 6 Hours • from ${startLabel}`
    : "Next 6 Hours";

  container.innerHTML = `
    <div class="comfort-module next6-module">

  <div class="next6-header">
  <div class="next6-label">NEXT 6 HOURS</div>
  <div class="next6-text">
   ${startLabel ? `${startLabel} onward` : ""}
  </div>
</div>

      <!-- TREND -->
      <button class="next6-trend-chip ${safeTrend}">
        <span class="trend-arrow">${getTrendArrow(safeTrend)}</span>
        <span class="trend-text">${getTrendText(safeTrend)}</span>
      </button>

      <!-- HOURS -->
      <div class="next6-strip">
        ${items.map(h => {
          const temp =
            h.temp != null && !isNaN(h.temp)
              ? Math.round(h.temp) + "°"
              : "--";

          // 🔥 FIX: convert 0–10 → 0–100
          const score =
            h.score != null && !isNaN(h.score)
              ? Math.round(h.score * 10)
              : null;

          const scoreClass = getScoreClass(score);
          const emoji = getComfortEmoji(score);
          const label = getComfortLabel(score);

          const goldiClass = h.goldilocks ? "goldilocks" : "";

          return `
            <div class="next6-hour ${goldiClass}">

              <div class="next6-hour-label">
                ${h.hourLabel || ""}
              </div>

              <div class="next6-hour-emoji">
                ${emoji}
              </div>

              <div class="next6-hour-temp">
                ${temp}
              </div>

              ${
                score != null
                  ? `
                    <div class="next6-hour-score ${scoreClass}">
                      ${score}
                    </div>
                  `
                  : ""
              }

              <div class="next6-hour-factor">
                ${label}
              </div>

            </div>
          `;
        }).join("")}
      </div>

    </div>
  `;
}

// ============================================================
// SCORE COLOR
// ============================================================

function getScoreClass(score) {
  if (score == null) return "neutral";

  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "okay";
  if (score >= 35) return "poor";
  return "bad";
}

// ============================================================
// EMOJI (derived from score)
// ============================================================

function getComfortEmoji(score) {
  if (score == null) return "—";

  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  if (score >= 50) return "😐";
  if (score >= 35) return "😕";
  return "🥵";
}

// ============================================================
// LABEL (derived from score)
// ============================================================

function getComfortLabel(score) {
  if (score == null) return "";

  if (score >= 80) return "Great";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 35) return "Poor";
  return "Harsh";
}

// ============================================================
// TREND
// ============================================================

function getTrendText(trend) {
  if (trend === "improving") return "Getting more comfortable";
  if (trend === "worsening") return "Getting less comfortable";
  return "Comfort holding steady";
}

function getTrendArrow(trend) {
  if (trend === "improving") return "↑";
  if (trend === "worsening") return "↓";
  return "→";
}