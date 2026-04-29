// ============================================================
// FUTURE COMFORT (V8 — TIME-ANCHORED + CLEAN SEPARATION)
// ============================================================

import { calculateComfort } from "../intel/comfort.js";

// ============================================================
// ⚡ LIGHTNING PARSER
// ============================================================

function parseLightning(h = {}) {
  if (h.lightning?.detected) {
    return {
      lightning: h.lightning,
      thunder: h.thunder ?? true
    };
  }

  const count =
    h.lightning_strike_count ??
    h.lightningStrikeCount ??
    0;

  const distanceKm =
    h.lightning_strike_avg_distance ??
    h.lightningStrikeAvgDistance ??
    null;

  const distanceMiles =
    distanceKm != null ? distanceKm * 0.621371 : null;

  if (count > 0) {
    return {
      lightning: {
        detected: true,
        distanceMiles: distanceMiles ?? 10
      },
      thunder: true
    };
  }

  return {
    lightning: null,
    thunder: false
  };
}

// ============================================================
// ⚡ IMPACT ENGINE
// ============================================================

function computeImpact(h = {}) {
  const lightning = h.lightning;
  const precip = h.precipitation ?? 0;

  if (lightning?.detected) {
    const d = lightning.distanceMiles ?? 10;
    if (d <= 3) return 85;
    if (d <= 6) return 70;
    if (d <= 10) return 55;
    return 40;
  }

  if (h.thunder) return 50;

  if (precip > 0) {
    if (precip < 0.1) return 15;
    if (precip < 0.5) return 25;
    if (precip < 1.5) return 35;
    return 45;
  }

  return 0;
}

function getImpactLabel(impact) {
  if (impact >= 80) return "Hazardous";
  if (impact >= 60) return "Stormy";
  if (impact >= 40) return "Unsettled";
  if (impact >= 20) return "Active";
  return "Calm";
}

// ============================================================
// 🧠 NORMALIZE HOURS (FIXED — NO GLOBAL "NOW")
// ============================================================

function normalizeHours(hours = [], referenceTime = Date.now()) {
  const normalized = hours
    .map((h, i, arr) => {
      if (!h) return null;

      const ts = h.timestamp ?? h.ts;
      if (!Number.isFinite(ts)) return null;

      const { lightning, thunder } = parseLightning(h);

      const score = calculateAdjustedScore(h, i, arr);

      const enriched = { ...h, lightning, thunder };
      const impact = computeImpact(enriched);

      return {
        timestamp: ts,
        temperatureF:
          h.temperatureF ?? h.temp ?? null,
        windSpeed: h.windSpeed ?? 0,
        windGust: h.windGust ?? null,
        precipitation: h.precipitation ?? 0,

        lightning,
        thunder,

        score,
        impact,
        impactLabel: getImpactLabel(impact),

        goldilocks: !!h.goldilocks,
        hourLabel: h.hourLabel ?? formatHour(ts)
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (!normalized.length) return [];

  // 🔑 anchor to provided reference time
  let closestIndex = 0;
  let smallestDiff = Infinity;

  for (let i = 0; i < normalized.length; i++) {
    const diff = Math.abs(normalized[i].timestamp - referenceTime);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = i;
    }
  }

  return normalized.slice(closestIndex, closestIndex + 6);
}

// ============================================================
// 🎯 MAIN RENDER (NOW + TOMORROW SAFE)
// ============================================================

export function renderFutureComfort(container, {
  items,
  referenceTime = Date.now(),
  trend = null
}) {
  if (!container || !Array.isArray(items) || !items.length) {
    container.innerHTML = "";
    return;
  }

  const hours = normalizeHours(items, referenceTime);

  const computedTrend = detectTrend(hours);
  const safeTrend = trend ?? computedTrend;

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
// ⏱️ TIME HELPERS (NEW)
// ============================================================

export function getTomorrowAnchor() {
  const t = new Date();
  t.setHours(24, 0, 0, 0); // midnight next day
  return t.getTime();
}

// ============================================================
// 🧱 HOUR CARD
// ============================================================

function renderHourCard(h) {
  const temp = Number.isFinite(h.temperatureF)
    ? `${Math.round(h.temperatureF)}°`
    : "--";

  const score =
    h.score != null ? Math.round(h.score * 10) : null;

  const emoji =
    h.impact >= 60 ? "⚡" : getComfortEmoji(score);

  const scoreClass = getScoreClass(score);
  const goldiClass = h.goldilocks ? "goldilocks" : "";

  const tint = getImpactBackground(h.impact, score);

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
        h.impact >= 40
          ? `<div class="next6-hour-impact">
              ${h.impactLabel}
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
// 📊 SUMMARY + TREND
// ============================================================

function buildSummary(hours, trend) {
  if (!hours.length) return "";

  const maxImpact = Math.max(...hours.map(h => h.impact));

  if (maxImpact >= 70)
    return "Thunderstorms likely, with lightning nearby";

  if (maxImpact >= 50)
    return "Storms may impact conditions at times";

  if (maxImpact >= 40)
    return "Unsettled conditions expected";

  const precipTotal =
    hours.reduce((s, h) => s + (h.precipitation ?? 0), 0);

  if (precipTotal > 0.05)
    return "Rain may affect comfort";

  if (trend === "improving") return "Gradually improving";
  if (trend === "worsening") return "Gradually worsening";

  return "Conditions remain fairly steady";
}

function detectTrend(hours) {
  if (!hours.length) return "steady";

  const diff =
    (hours.at(-1).score ?? 0) - (hours[0].score ?? 0);

  if (diff > 0.2) return "improving";
  if (diff < -0.2) return "worsening";
  return "steady";
}

// ============================================================
// 🌬️ SCORE ENGINE
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
// 🎨 UI HELPERS
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

function getImpactBackground(impact, score) {
  if (impact >= 70) return "rgba(120, 60, 160, 0.18)";
  if (impact >= 50) return "rgba(80, 120, 200, 0.16)";
  if (impact >= 40) return "rgba(120, 140, 200, 0.14)";

  if (score >= 85) return "rgba(80, 200, 120, 0.12)";
  if (score >= 70) return "rgba(100, 180, 255, 0.12)";
  if (score >= 55) return "rgba(255, 200, 100, 0.12)";
  if (score >= 40) return "rgba(255, 140, 80, 0.12)";
  return "rgba(255, 80, 80, 0.12)";
}