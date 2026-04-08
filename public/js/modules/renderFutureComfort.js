// /js/modules/renderFutureComfort.js

import { buildHumanVoice } from "../intel/human-voice.js";

// ============================================================
// DOMINANT FACTOR (lightweight)
// ============================================================
function detectDominant(h) {
  if (h.dewPoint >= 65) return "humidity";
  if (h.wind >= 10) return "wind";
  if (h.temp >= 80) return "heat";
  if (h.temp <= 50) return "cold";
  return "temperature";
}

// ============================================================
// MAIN RENDER
// ============================================================
export function renderFutureComfort(container, items, trend) {
  if (!container || !Array.isArray(items) || items.length === 0) return;

  const safeTrend = trend || "steady";

  const startLabel = items?.[0]?.hourLabel || "";

  container.innerHTML = `
    <div class="comfort-module next6-module">

      <!-- HEADER -->
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

          const score =
            h.score != null && !isNaN(h.score)
              ? Math.round(h.score * 10)
              : null;

          const scoreClass = getScoreClass(score);
          const emoji = getComfortEmoji(score);

          const goldiClass = h.goldilocks ? "goldilocks" : "";

          // ------------------------------------------------------
          // 🔥 HUMAN VOICE (ADDED — NOT REPLACING SCORE)
          // ------------------------------------------------------
          const signals = {
            temp: h.temp,
            dewPoint: h.dewPoint,
            humidity: h.humidity,
            windSpeed: h.wind
          };

          const human = buildHumanVoice(signals, detectDominant(h));

          // headline override (score-aware)
          let headline = human.summary;

          if (h.goldilocks) headline = "Ideal";
          if (score != null && score <= 30) headline = "Uncomfortable";

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

              <!-- 🔥 HEADLINE (replaces generic label) -->
              <div class="next6-hour-factor">
                ${headline}
              </div>

              <!-- 🔥 SUPPORT (light touch only) -->
              <div class="next6-hour-sub">
                ${human.detail}
              </div>

              ${
                h.goldilocks
                  ? `<div class="next6-hour-goldi">✨</div>`
                  : ""
              }

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
// EMOJI
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