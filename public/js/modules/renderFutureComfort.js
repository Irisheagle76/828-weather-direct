// ============================================================
// FUTURE COMFORT (V4 — FIXED + CONSISTENT)
// ============================================================

import { calculateComfort } from "../intel/comfort.js";

// ============================================================
// NORMALIZE HOURS (STRICT + FINAL)
// ============================================================

function normalizeHours(hours = []) {
  const now = Date.now();

  const normalized = hours
    .map((h, i, arr) => {
      if (!h) return null;

      const ts = h.timestamp ?? h.ts;
      if (!Number.isFinite(ts)) return null;

      return {
        timestamp: ts,

        temperatureF:
          Number.isFinite(h.temperatureF)
            ? h.temperatureF
            : Number.isFinite(h.temp)
              ? h.temp
              : null,

        windSpeed: h.windSpeed ?? 0,
        windGust: h.windGust ?? null,
        precipitation: h.precipitation ?? 0,

        // 🔥 CRITICAL: use adjusted scoring (NOT raw)
        score: calculateAdjustedScore(h, i, arr),

        goldilocks: !!h.goldilocks,
        hourLabel: h.hourLabel ?? formatHour(ts)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!normalized.length) return [];

  // ------------------------------------------------------------
  // FIND CLOSEST TO NOW
  // ------------------------------------------------------------
  let closestIndex = 0;
  let smallestDiff = Infinity;

  for (let i = 0; i < normalized.length; i++) {
    const diff = Math.abs(normalized[i].timestamp - now);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  }

  return normalized.slice(closestIndex, closestIndex + 6);
}

// ============================================================
// MAIN RENDER
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

          <div class="comfort-label">Next Few Hours</div>

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
  const temp = Number.isFinite(h.temperatureF)
    ? `${Math.round(h.temperatureF)}°`
    : "--";

  const score =
    h.score != null
      ? Math.round(h.score * 10)
      : null;

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

      <div class="next6-hour-label">${h.hourLabel}</div>
      <div class="next6-hour-emoji">${emoji}</div>
      <div class="next6-hour-temp">${temp}</div>

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
// SUMMARY + TREND
// ============================================================

function buildSummary(hours, trend) {
  if (!hours.length) return "";

  const first = hours[0];
  const last = hours.at(-1);

  const tempDiff = (last.temperatureF ?? 0) - (first.temperatureF ?? 0);
  const scoreDiff = (last.score ?? 0) - (first.score ?? 0);

  const avgWind =
    hours.reduce((s, h) => s + (h.windSpeed ?? 0), 0) / hours.length;

  const maxGust = Math.max(...hours.map(h => h.windGust ?? 0));
  const precipTotal =
    hours.reduce((s, h) => s + (h.precipitation ?? 0), 0);

  if (precipTotal > 0.05) return "Rain may impact comfort";
  if (maxGust >= 35) return "Gusty winds will impact comfort";

  if (trend === "improving") {
    return tempDiff > 2
      ? "Warming and becoming more comfortable"
      : "Gradually improving";
  }

  if (trend === "worsening") {
    return tempDiff < -2
      ? "Cooling and becoming less comfortable"
      : "Gradually worsening";
  }

  if (avgWind > 8) return "A steady breeze influences how it feels";

  if (tempDiff >= 4) return "Warming through this period";
  if (tempDiff <= -4) return "Cooling through this period";

  if (scoreDiff >= 0.2) return "Comfort improves slightly";
  if (scoreDiff <= -0.2) return "Comfort dips slightly";

  return "Conditions remain fairly steady";
}

function detectTrend(hours) {
  if (!hours.length) return "steady";

  const diff = (hours.at(-1).score ?? 0) - (hours[0].score ?? 0);

  if (diff > 0.2) return "improving";
  if (diff < -0.2) return "worsening";
  return "steady";
}

// ============================================================
// SCORE ENGINE (THE FIX)
// ============================================================

function calculateAdjustedScore(h, i, hours = []) {
  let adjusted = { ...h };

  if (i < 3) {
    adjusted.windSpeed = smoothWind(adjusted, hours);
    adjusted.windGust = smoothGust(adjusted, hours);

    const g = calculateGustiness(
      adjusted.windSpeed,
      adjusted.windGust
    );

    let score = calculateComfort(adjusted)?.score ?? 0;

    if (g >= 12) score -= 0.5;
    else if (g >= 7) score -= 0.25;

    return score;
  }

  return calculateComfort(h)?.score ?? null;
}

// ============================================================
// WIND HELPERS (FIXED INDEX BUG)
// ============================================================

function smoothWind(current, hours = []) {
  const idx = hours.findIndex(h => h.timestamp === current.timestamp);
  if (idx === -1) return current.windSpeed;

  const window = hours.slice(idx, idx + 3);

  const values = [
    current.windSpeed,
    ...window.map(h => h.windSpeed)
  ].filter(Number.isFinite);

  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : current.windSpeed;
}

function smoothGust(current, hours = []) {
  const idx = hours.findIndex(h => h.timestamp === current.timestamp);
  if (idx === -1) return current.windGust;

  const window = hours.slice(idx, idx + 3);

  const values = [
    current.windGust,
    ...window.map(h => h.windGust)
  ].filter(Number.isFinite);

  if (!values.length) return current.windGust;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;

  return Math.min(avg, (current.windSpeed ?? 0) * 2.5);
}

function calculateGustiness(windSpeed, windGust) {
  if (!Number.isFinite(windSpeed) || !Number.isFinite(windGust)) return 0;
  return Math.max(0, windGust - windSpeed);
}

// ============================================================
// UI HELPERS
// ============================================================

function formatHour(ts) {
  const d = new Date(ts);
  return isNaN(d.getTime())
    ? "--"
    : d.toLocaleTimeString([], { hour: "numeric" });
}

function getTrendText(t) {
  return t === "improving"
    ? "Getting more comfortable"
    : t === "worsening"
    ? "Getting less comfortable"
    : "Comfort holding steady";
}

function getTrendArrow(t) {
  return t === "improving" ? "↑" : t === "worsening" ? "↓" : "→";
}

function getTrendEmoji(t) {
  return t === "improving" ? "😌" : t === "worsening" ? "😕" : "😐";
}

function getScoreClass(s) {
  if (s == null) return "neutral";
  if (s >= 80) return "great";
  if (s >= 65) return "good";
  if (s >= 50) return "okay";
  if (s >= 35) return "poor";
  return "bad";
}

function getComfortEmoji(s) {
  if (s == null) return "—";
  if (s >= 80) return "😌";
  if (s >= 65) return "🙂";
  if (s >= 50) return "😐";
  if (s >= 35) return "😕";
  return "🥵";
}

function getFeelScoreBackground(s) {
  if (s >= 85) return "rgba(80, 200, 120, 0.12)";
  if (s >= 70) return "rgba(100, 180, 255, 0.12)";
  if (s >= 55) return "rgba(255, 200, 100, 0.12)";
  if (s >= 40) return "rgba(255, 140, 80, 0.12)";
  return "rgba(255, 80, 80, 0.12)";
}