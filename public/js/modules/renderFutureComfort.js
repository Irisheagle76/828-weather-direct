// /js/modules/renderFutureComfort.js (v2 — STABLE + NORMALIZED)

// ============================================================
// NORMALIZE HOURS (critical)
// ============================================================

function normalizeHours(hours = []) {
  return hours.map(h => ({
    ts: h.ts ?? h.time ?? h.timestamp,
    temp: h.temp ?? h.temperature ?? h.temperatureF ?? null,
    wind: h.wind ?? h.windSpeed ?? 0,
    precip: h.precip ?? h.precipitation ?? 0,
    score: h.score ?? null,
    goldilocks: !!h.goldilocks,
    hourLabel: h.hourLabel ?? ""
  }));
}

// ============================================================
// COLOR SCALE
// ============================================================

function getFeelScoreBackground(score) {
  if (score >= 85) return "rgba(80, 200, 120, 0.12)";
  if (score >= 70) return "rgba(100, 180, 255, 0.12)";
  if (score >= 55) return "rgba(255, 200, 100, 0.12)";
  if (score >= 40) return "rgba(255, 140, 80, 0.12)";
  return "rgba(255, 80, 80, 0.12)";
}

// ============================================================
// MAIN
// ============================================================

export function renderFutureComfort(container, items, trend) {
  if (!container || !Array.isArray(items) || !items.length) {
    container.innerHTML = "";
    return;
  }

  const hours = normalizeHours(items);

  const safeTrend = trend || detectTrend(hours);
  const summary = buildSummary(hours, safeTrend);

  container.innerHTML = `
    <div class="comfort-module next6-module">

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

      <div class="next6-strip">
        ${hours.map(renderHourCard).join("")}
      </div>

    </div>
  `;
}

// ============================================================
// HOUR CARD
// ============================================================

function renderHourCard(h) {
  const temp =
    h.temp != null ? `${Math.round(h.temp)}°` : "--";

  const score =
    h.score != null ? Math.round(h.score * 10) : null;

  const emoji = getComfortEmoji(score);
  const scoreClass = getScoreClass(score);
  const goldiClass = h.goldilocks ? "goldilocks" : "";

  const tint = getFeelScoreBackground(score ?? 50);

  return `
    <div class="next6-hour ${goldiClass}" style="
      background:
        linear-gradient(${tint}, ${tint}),
        rgba(255,255,255,0.05);
    ">

      <div class="next6-hour-label">
        ${h.hourLabel}
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
// SUMMARY (cleaned logic)
// ============================================================

function buildSummary(hours, trend) {
  if (!hours.length) return "";

  const first = hours[0];
  const last = hours.at(-1);

  const tempDiff = (last.temp ?? 0) - (first.temp ?? 0);
  const scoreDiff = (last.score ?? 0) - (first.score ?? 0);

  const avgWind =
    hours.reduce((s, h) => s + (h.wind ?? 0), 0) / hours.length;

  const precipTotal =
    hours.reduce((s, h) => s + (h.precip ?? 0), 0);

  // precipitation dominates
  if (precipTotal > 0.05) {
    return "Rain may impact comfort during this stretch";
  }

  // trend-based messaging
  if (trend === "improving") {
    if (tempDiff > 2) return "Warming and becoming more comfortable";
    return "Gradually becoming more comfortable";
  }

  if (trend === "worsening") {
    if (tempDiff < -2) return "Cooling and becoming less comfortable";
    return "Gradually becoming less comfortable";
  }

  // secondary factors
  if (avgWind > 8) return "A steady breeze influences how it feels";

  if (tempDiff >= 4) return "Warming through this period";
  if (tempDiff <= -4) return "Cooling through this period";

  if (scoreDiff >= 0.2) return "Comfort improves slightly";
  if (scoreDiff <= -0.2) return "Comfort dips slightly";

  return "Conditions remain fairly steady";
}

// ============================================================
// TREND
// ============================================================

function detectTrend(hours) {
  if (!hours.length) return "steady";

  const first = hours[0];
  const last = hours.at(-1);

  const diff = (last.score ?? 0) - (first.score ?? 0);

  if (diff > 0.2) return "improving";
  if (diff < -0.2) return "worsening";

  return "steady";
}

// ============================================================
// DISPLAY HELPERS
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
// SCORE + EMOJI
// ============================================================

function getScoreClass(score) {
  if (score == null) return "neutral";
  if (score >= 80) return "great";
  if (score >= 65) return "good";
  if (score >= 50) return "okay";
  if (score >= 35) return "poor";
  return "bad";
}

function getComfortEmoji(score) {
  if (score == null) return "—";
  if (score >= 80) return "😌";
  if (score >= 65) return "🙂";
  if (score >= 50) return "😐";
  if (score >= 35) return "😕";
  return "🥵";
}