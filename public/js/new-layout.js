// ============================================================
// AVL WEATHER — V3 LAYOUT (STABLE + UNIFIED)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { generateNarrative } from '/js/intel/synthesizer/index.js';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js';

import { renderPulseV2 } from '/js/modules/renderPulseV2.js';
import { renderSubstackV2 } from '/js/modules/renderSubstackV2.js';

// ============================================================
// FETCH HELPERS
// ============================================================

async function fetchDroughtFire() {
  try {
    const res = await fetch('/api/drought-fire');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ============================================================
// DROUGHT COLOR HELPERS
// ============================================================
function getDroughtColor(dss) {
  if (dss >= 75) return "#ff6b6b";
  if (dss >= 60) return "#ffb347";
  if (dss >= 45) return "#ffd166";
  return "#7bd389";
}

function getFireColor(fri) {
  if (fri >= 70) return "#ff4d4d";
  if (fri >= 55) return "#ff944d";
  if (fri >= 40) return "#ffd166";
  return "#7bd389";
}

function getTrendMeta(trend) {
  if (trend > 2) return { arrow: "↑", label: "Rising" };
  if (trend < -2) return { arrow: "↓", label: "Falling" };
  return { arrow: "→", label: "Steady" };
}

// ============================================================
// NORMALIZATION (LOCAL + SAFE)
// ============================================================

function normalizeHourly(hourly = []) {
  return hourly.map(h => ({
    // TIME
    timestamp: h.timestamp ?? h.ts ?? h.time,

    // TEMP
    temperatureF: h.temperatureF ?? h.temp ?? null,

    // HUMIDITY
    relativeHumidity:
      h.relativeHumidity ?? h.rh ?? h.relative_humidity ?? null,

    // WIND
    windSpeed: h.windSpeed ?? h.wind ?? 0,
    windGust: h.windGust ?? null,

    // DEW
    dewpointF: h.dewpointF ?? h.dewPoint ?? null,

    // 🌧️ CRITICAL — KEEP THESE
    precipAmount:
      h.precipAmount ?? h.precipitation ?? 0,

    precipProbability:
      h.precipProbability ?? h.precipitation_probability ?? null,

    precipType:
      h.precipType ?? null,

    isRainingNow:
      h.isRainingNow ?? false
  }));
}
console.log("🌧️ NORMALIZED SAMPLE:", normalized[0]);

function normalizeCurrent(c = {}) {
  return {
    ...c,
    temp: c.temp ?? c.temperature ?? c.temperatureF ?? null,
    wind: c.wind ?? c.wind_avg ?? c.windSpeed ?? 0,
    rh: c.rh ?? c.relative_humidity ?? null
  };
}

// ------------------------------------------------------------
// WIND HELPERS (LOCAL)
// ------------------------------------------------------------

function smoothWind(current, hours = []) {
  const values = [
    current.windSpeed,
    ...hours.slice(0, 3).map(h => h.windSpeed)
  ].filter(Number.isFinite);

  if (!values.length) return current.windSpeed;

  return values.reduce((a, b) => a + b, 0) / values.length;
}

function smoothGust(current, hours = []) {
  const values = [
    current.windGust,
    ...hours.slice(0, 3).map(h => h.windGust)
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
// CONTENT LOADERS (PULSE + SUBSTACK)
// ============================================================

async function loadPulse() {
  const container = document.getElementById('pulse');
  if (!container) return;

  try {
    const res = await fetch('/api/tidbits/pulse-latest');

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const pulse = await res.json();

    renderPulseV2(container, pulse?.fallback ? null : pulse);

  } catch (err) {
    console.error("Pulse load error:", err);

    renderPulseV2(container, {
      title: "No recent update",
      text: "No recent 828 Weather Pulse update has been published.",
      timestamp: Date.now()
    });
  }
}

async function loadSubstack() {
  const container = document.getElementById('update');
  if (!container) return;

  try {
    const res = await fetch('/api/substack-articles');
    const post = await res.json();

    renderSubstackV2(container, post);

  } catch (err) {
    console.error("Substack load error:", err);
    renderSubstackV2(container, null);
  }
}
// ============================================================
// MAIN ENTRY
// ============================================================

export async function renderNewLayout(container) {
  container.innerHTML = `
    <div class="top-stack">
      <div id="feelscore" class="fade-in"></div>
      <div id="droughtfire" class="fade-in"></div>
    
      <div id="timeline" class="fade-in"></div>
      <div id="tomorrow" class="fade-in"></div>
      <div id="pulse" class="fade-in"></div>
      <div id="update" class="fade-in"></div>
    </div>
  `;

  try {
  const [data, drought] = await Promise.all([
  getWeatherForUI({ lat: 35.5951, lon: -82.5515 }),
  fetchDroughtFire()
]);

// 👇 ADD THESE TWO LINES
console.log("FULL API DATA:", data);
console.log("WIND STATION:", data?.wind_station);

    // ------------------------------------------------------------
    // NORMALIZE ONCE
    // ------------------------------------------------------------
    const hourly = Array.isArray(data?.hourly)
      ? normalizeHourly(data.hourly)
      : [];
console.log("POST-NORMALIZE (LAYOUT):", hourly[0]);
    const current = data?.current
      ? normalizeCurrent(data.current)
      : null;

      // 🔍 DEBUG HERE
console.log("CURRENT DEBUG:", {
  raw: current,
  rh1: current?.relativeHumidity,
  rh2: current?.relative_humidity,
  rh3: current?.rh
});

      const tempest = data?.tempest ?? null;

      console.log("TEMPEST IN LAYOUT:", tempest);

   if (current) renderHeaderMetrics(current, tempest);

    // ------------------------------------------------------------
    // HUMAN INTEL (FIXED)
    // ------------------------------------------------------------
    const human = buildHumanActionIntelFS({
      ...data,
      hourly,
      current,
      tempest
    });

    // ------------------------------------------------------------
    // CORE RENDER
    // ------------------------------------------------------------
   
    renderDroughtFire(drought);
  renderFeelScore(human?.feelscore);
    renderTimeline(hourly);
  const narrativeData = generateNarrative(
  human?.today,
  human?.tomorrow
);

renderTomorrow(narrativeData?.tomorrow);

    // ------------------------------------------------------------
    // CONTENT
    // ------------------------------------------------------------
  await loadPulse();
await loadSubstack();

    runStaggerAnimation();
    hideSplash();

  } catch (err) {
    console.error('Layout error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading</div>`;
  }
}

function detectDominantFactor(s = {}) {
  const wind = s.wind ?? s.windSpeed ?? 0;

  if (s.dewPoint >= 65) return "muggy";
  if (s.temp >= 85) return "heat";
  if (s.temp <= 45) return "cold";
  if (wind >= 12) return "wind";

  return "comfortable";
}

// ============================================================
// FEELSCORE
// ============================================================

function renderFeelScore(data) {
  if (!data) return;

  const { score, headline, subHeadline, bullets, emoji } = data;

  const color = getFeelScoreColor(score);
  const bgTint = getFeelScoreBackground(score);

  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card hero" style="
      background: linear-gradient(${bgTint}, ${bgTint}), #101b33;
    ">
      <div class="fs-header">
        FEELSCORE
        <span class="info-btn" onclick="openInfo('feelscore', ${score})">ⓘ</span>
      </div>

      <div class="fs-hero-row">
        <div class="fs-score" style="color:${color}">${score}</div>
        <div class="fs-status" style="color:${color}">
          ${mapScoreToLabel(score)}
        </div>
      </div>

      <div class="fs-headline">${headline || ""}</div>

      ${
        subHeadline
          ? `<div class="fs-subhead">${subHeadline}</div>`
          : ""
      }

      <div class="fs-bullets">
        ${(bullets || []).map(b => `<div class="fs-bullet">• ${b}</div>`).join('')}
      </div>
    </div>
  `;

  animateScoreOnce('#feelscore .fs-score', score);
}

// ============================================================
// TIMELINE (CLEAN + FUTURE SAFE — FIXED)
// ============================================================

function renderTimeline(hourly) {
  const container = document.getElementById('timeline');

  if (!Array.isArray(hourly) || !hourly.length) {
    container.innerHTML = '';
    return;
  }

  const now = Date.now();

  // ------------------------------------------------------------
  // FUTURE HOURS ONLY (canonical fields)
  // ------------------------------------------------------------
  const future = hourly.filter(h =>
    h &&
    Number.isFinite(h.timestamp) &&
    h.timestamp >= now &&
    Number.isFinite(h.temperatureF)
  );

  // fallback to full array if future slice fails (safety)
  const next = (future.length ? future : hourly)
    .slice(0, 6)
    .filter(h =>
      h &&
      Number.isFinite(h.timestamp) &&
      Number.isFinite(h.temperatureF)
    );

  if (!next.length) {
    container.innerHTML = '';
    return;
  }

  // ------------------------------------------------------------
  // SCORES
  // ------------------------------------------------------------
const scores = next.map((h, i) => {
  let adjusted = { ...h };

  // ------------------------------------------------------------
  // 🆕 APPLY SAME LOGIC AS "NOW"
  // ------------------------------------------------------------
  if (i < 3) {
   adjusted.windSpeed = smoothWind(adjusted, hourly);
adjusted.windGust = smoothGust(adjusted, hourly);

    const g = calculateGustiness(
      adjusted.windSpeed,
      adjusted.windGust
    );

    let score = calculateComfort(adjusted)?.score ?? 0;

    if (g >= 12) score -= 0.5;
    else if (g >= 7) score -= 0.25;

    const scaled = Math.round(score * 10);

    return Math.min(scaled, 98);
  }

  // ------------------------------------------------------------
  // FARTHER HOURS (unchanged)
  // ------------------------------------------------------------
  const raw = calculateComfort(h)?.score ?? 0;
  const scaled = Math.round(raw * 10);

  return Math.min(scaled, 98);
});

  const best = Math.max(...scores);

  // ------------------------------------------------------------
  // BUILD UI
  // ------------------------------------------------------------
  const html = next.map((h, i) => {
    const isBest = scores[i] === best ? "best-hour" : "";

    return `
      <div class="hour-block ${isBest}">
        <div class="hour-time">${formatHour(h.timestamp)}</div>
        <div class="hour-temp">${Math.round(h.temperatureF)}°</div>
        <div class="hour-score">${scores[i]}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="timeline-card">
     <div class="section-title feelscore-title">Feelscore next few hours</div>
      <div class="timeline-row">${html}</div>
    </div>
  `;
}
// ============================================================
// HELPERS
// ============================================================

function animateScoreOnce(selector, score) {
  const el = document.querySelector(selector);
  if (!el || el.dataset.done) return;

  el.dataset.done = "true";
  el.textContent = "0";

  const start = performance.now();

  function frame(t) {
    const p = Math.min((t - start) / 500, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * score);
    if (p < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

// ------------------------------------------------------------
// FORMATTERS
// ------------------------------------------------------------
function formatHour(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: "numeric" });
}

// ------------------------------------------------------------
// FEELSCORE COLORS
// ------------------------------------------------------------
function getFeelScoreColor(score) {
  if (score >= 90) return "#4caf50";
  if (score >= 75) return "#8bc34a";
  if (score >= 60) return "#ffc107";
  if (score >= 45) return "#ff9800";
  return "#f44336";
}

function getFeelScoreBackground(score) {
  if (score >= 90) return "rgba(76,175,80,0.12)";
  if (score >= 75) return "rgba(139,195,74,0.10)";
  if (score >= 60) return "rgba(255,193,7,0.08)";
  if (score >= 45) return "rgba(255,152,0,0.08)";
  return "rgba(244,67,54,0.10)";
}

// ------------------------------------------------------------
// DROUGHT COLORS
// ------------------------------------------------------------
function getDroughtBackground(DSS, FRI) {
  const s = Math.max(DSS, FRI);
  if (s >= 85) return "rgba(183,28,28,0.25)";
  if (s >= 70) return "rgba(244,67,54,0.18)";
  if (s >= 55) return "rgba(255,152,0,0.14)";
  if (s >= 40) return "rgba(255,193,7,0.10)";
  return "rgba(255,255,255,0.03)";
}

// ------------------------------------------------------------
// UI ANIMATIONS
// ------------------------------------------------------------
function runStaggerAnimation() {
  document.querySelectorAll(".fade-in").forEach((el, i) => {
    setTimeout(() => el.classList.add("show"), i * 90);
  });
}

function hideSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add("hide");
    setTimeout(() => splash.remove(), 600);
  }, 300);
}

// ------------------------------------------------------------
// HEADER METRICS
// ------------------------------------------------------------
function renderHeaderMetrics(current, tempest = {}) {
  const container = document.getElementById("metric-chips");
  if (!container || !current) return;

  // ---------------------------
  // helpers
  // ---------------------------
  const toF = (c) => (c * 9) / 5 + 32;
  const toMPH = (ms) => ms * 2.237;
  const round = (v) => (Number.isFinite(v) ? Math.round(v) : "--");

// ---------------------------
// temperature
// ---------------------------
const tempRaw =
  typeof tempest?.air_temperature === "number"
    ? toF(tempest.air_temperature)
    : current.temperatureF;

// ---------------------------
// humidity
// ---------------------------
const rhRaw =
  tempest?.relative_humidity ??
  current.relativeHumidity ??
  current.rh;

// ---------------------------
// dew point
// ---------------------------
const dewRaw =
  typeof tempest?.dew_point === "number"
    ? toF(tempest.dew_point)
    : current.dewpointF ?? null;

// ---------------------------
// wind + gusts
// ---------------------------
const windRaw =
  typeof tempest?.wind_avg === "number"
    ? toMPH(tempest.wind_avg)
    : current.windSpeed;

const gustRaw =
  typeof tempest?.wind_gust === "number"
    ? toMPH(tempest.wind_gust)
    : current.windGust ?? null;

  // ---------------------------
  // normalized values
  // ---------------------------
  const temp = round(tempRaw);
  const rh = round(rhRaw);
  const dew = round(dewRaw);
  const wind = round(windRaw);
  const gust = round(gustRaw);

// ---------------------------
// wind display logic
// ---------------------------
const showGust =
  Number.isFinite(gustRaw) &&
  Number.isFinite(windRaw) &&
  gustRaw > windRaw + 3;

const windHTML = showGust
  ? `
    <span class="label">Wind</span>
    <span class="value">
      ${wind} mph
      <span class="gust">→ ${gust}</span>
    </span>
  `
  : `
    <span class="label">Wind</span>
    <span class="value">${wind}<span class="unit"> mph</span></span>
  `;

  // ---------------------------
  // render
  // ---------------------------
  container.innerHTML = `
    <div class="metric-chip temp">${temp}°</div>

    <div class="metric-chip">
      <span class="label">RH</span>
      <span class="value">${rh}%</span>
    </div>

    <div class="metric-chip">
      <span class="label">DP</span>
      <span class="value">${dew}°</span>
    </div>

    <div class="metric-chip">
      ${windHTML}
    </div>
  `;
}
// ------------------------------------------------------------
// SCORE MAPPING
// ------------------------------------------------------------
function mapScoreToCategory(score) {
  if (score >= 90) return "ideal";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slight";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function mapScoreToLabel(score) {
  if (score >= 90) return "Ideal";
  if (score >= 75) return "Comfortable";
  if (score >= 60) return "Slightly Uncomfortable";
  if (score >= 45) return "Uncomfortable";
  return "Harsh";
}

// ============================================================
// DROUGHT / FIRE
// ============================================================

function renderDroughtFire(data) {
  const el = document.getElementById('droughtfire');
  if (!el) return;

  if (!data) {
    el.innerHTML = '';
    return;
  }

  console.log("🔥 Drought payload:", data);

  const {
    DSS,
    FRI,
    dssTrend = 0,
    friTrend = 0,
    narrative,
    fireDriver
  } = data;

  const droughtMonitor =
    data.droughtMonitor ||
    data.usdm ||
    data.dm ||
    data?.drought?.monitor ||
    null;

  const bgTint = getDroughtBackground(DSS, FRI);

  const dColor = getDroughtColor(DSS);
  const fColor = getFireColor(FRI);

  const dTrend = getTrendMeta(dssTrend);
  const fTrend = getTrendMeta(friTrend);

  el.innerHTML = `
    <div class="df-card" style="
      background:
        linear-gradient(${bgTint}, ${bgTint}),
        #121a2b;
    ">

      <div class="df-header">
        ASHEVILLE DROUGHT AND FIRE THREAT
        <span class="info-btn" onclick="openInfo('drought', ${FRI})">ⓘ</span>
      </div>

      <div class="df-grid">

        <!-- DROUGHT -->
        <div class="df-block">
          <div class="df-label">DROUGHT STRESS</div>

          <div class="df-main" style="color:${dColor}">
            <span class="df-icon">🌵</span>
            <span class="df-value">${DSS ?? "--"}</span>
            <span class="df-trend">${dTrend.arrow}</span>
          </div>

          <div class="df-sub">
            ${dTrend.label}
            ${droughtMonitor ? ` • USDM ${droughtMonitor}` : ""}
          </div>
        </div>

        <!-- FIRE -->
        <div class="df-block">
          <div class="df-label">FIRE RISK</div>

          <div class="df-main" style="color:${fColor}">
            <span class="df-icon">🔥</span>
            <span class="df-value">${FRI ?? "--"}</span>
            <span class="df-trend">${fTrend.arrow}</span>
          </div>

          <div class="df-sub">
            ${fTrend.label}
            ${droughtMonitor ? ` • ${droughtMonitor}` : ""}
          </div>
        </div>

      </div>

      <!-- HEADLINE -->
      <div class="df-headline">
        ${narrative?.headline || ""}
      </div>

      <!-- 🔥 DRIVER (NEW INTELLIGENCE LAYER) -->
      ${
        fireDriver
          ? `<div class="df-driver">${fireDriver}</div>`
          : ""
      }

    </div>
  `;
}

// ============================================================
// TOMORROW
// ============================================================

function renderTomorrow(data) {
  const el = document.getElementById('tomorrow');
  if (!el) return;

  if (!data) {
    el.innerHTML = '';
    return;
  }

  const { score, headline, narrative, bullets, emoji } = data;

  el.innerHTML = `
    <div class="day-card fade-in">

      <div class="day-header-row">
        <div class="day-title">TOMORROW</div>
        <div class="day-score">
          <span class="day-emoji">${emoji ?? ""}</span>
          <span class="day-score-value">${score ?? "--"}</span>
        </div>
      </div>

      <div class="day-headline">
        ${headline || ""}
      </div>

      ${
        narrative
          ? `<div class="day-narrative">${narrative}</div>`
          : ""
      }

      ${
        bullets?.length
          ? `<div class="day-bullets">
              ${bullets.map(b => `<div class="day-bullet">• ${b}</div>`).join("")}
            </div>`
          : ""
      }

    </div>
  `;
}

