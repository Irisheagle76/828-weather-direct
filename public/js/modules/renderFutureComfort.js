// /js/modules/renderFutureComfort.js

// ============================================================
// FUTURE COMFORT (BALANCED WITH COMFORT NOW)
// ============================================================

export function renderFutureComfort(container, items, trend) {
  if (!container || !Array.isArray(items) || !items.length) return;

  const safeTrend = trend || detectTrend(items);
  const summary = buildSummary(items, safeTrend);

  container.innerHTML = `
    <div class="comfort-module next6-module">

      <!-- MATCHES COMFORT NOW STRUCTURE -->
      <div class="comfort-main">

        <div class="comfort-emoji">
          ${getTrendEmoji(safeTrend)}
        </div>

        <div class="comfort-text-block">

          <div class="comfort-label">Future Comfort</div>

          <div class="comfort-score ${safeTrend}">
            ${getTrendArrow(safeTrend)}
          </div>

          <div class="comfort-text">
            ${getTrendText(safeTrend)}
          </div>

          <div class="comfort-support">
            ${summary}
          </div>

        </div>

      </div>

      <!-- HOURS STRIP -->
      <div class="next6-strip">
        ${items.map(renderHourCard).join("")}
      </div>

    </div>
  `;
}

// ============================================================
// HOUR CARD (UNCHANGED STRUCTURE)
// ============================================================
function renderHourCard(h) {
  const temp =
    h.temp != null && !isNaN(h.temp)
      ? Math.round(h.temp) + "°"
      : "--";

  const score =
    h.score != null && !isNaN(h.score)
      ? Math.round(h.score * 10)
      : null;

  const emoji = getComfortEmoji(score);
  const scoreClass = getScoreClass(score);
  const goldiClass = h.goldilocks ? "goldilocks" : "";

  const tint = getFeelScoreBackground(score || 50); // 🔥 KEY ADD

  return `
    <div class="next6-hour ${goldiClass}" style="
      background:
        linear-gradient(${tint}, ${tint}),
        rgba(255,255,255,0.05);
    ">

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
          ? `<div class="next6-hour-score ${scoreClass}">
              ${score}
            </div>`
          : ""
      }

      ${
        h.goldilocks
          ? `<div class="next6-hour-goldi">✨</div>`
          : ""
      }

    </div>
  `;
}

// ============================================================
// SUMMARY (PRIMARY MESSAGE)
// ============================================================
function buildSummary(hours, trend) {
  if (!hours.length) return "";

  const first = hours[0];
  const last = hours[hours.length - 1];

  const tempDiff = (last.temp ?? 0) - (first.temp ?? 0);
  const scoreDiff = (last.score ?? 0) - (first.score ?? 0);

  const avgWind =
    hours.reduce((sum, h) => sum + (h.wind ?? 0), 0) / hours.length;

  const precipTotal =
    hours.reduce((sum, h) => sum + (h.precip ?? 0), 0);

  if (precipTotal > 0.05) {
    return "Rain may affect comfort during this period";
  }

  if (trend === "improving") {
    if (tempDiff > 2) return "Warming up and becoming more comfortable";
    return "Conditions gradually become more comfortable";
  }

  if (trend === "worsening") {
    if (tempDiff < -2) return "Cooling off and becoming less comfortable";
    return "Conditions trend less comfortable";
  }

  if (avgWind > 8) {
    return "A steady breeze affects how it feels";
  }

  if (tempDiff >= 4) return "Warming up through this stretch";
  if (tempDiff <= -4) return "Cooling off gradually";

  if (scoreDiff >= 0.2) return "Comfort improves slightly";
  if (scoreDiff <= -0.2) return "Comfort dips slightly";

  return "Conditions remain fairly steady";
}

// ============================================================
// TREND DETECTION
// ============================================================
function detectTrend(hours) {
  if (!hours.length) return "steady";

  const first = hours[0];
  const last = hours[hours.length - 1];

  const diff = (last.score ?? 0) - (first.score ?? 0);

  if (diff > 0.2) return "improving";
  if (diff < -0.2) return "worsening";

  return "steady";
}

// ============================================================
// TREND DISPLAY
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

function getTrendEmoji(trend) {
  if (trend === "improving") return "😌";
  if (trend === "worsening") return "😕";
  return "😐";
}

// ============================================================
// SCORE STYLE
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