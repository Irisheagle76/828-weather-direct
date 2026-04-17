// ============================================================
// AVL WEATHER — V3 LAYOUT (STABLE + UNIFIED)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { assembleWithVoice } from '/js/intel/synthesizer/assembleWithVoice.js';
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
    ts: h.ts || h.time || h.timestamp,
    temp: h.temp ?? h.temperature ?? h.temperatureF ?? null,
    dewPoint: h.dewPoint ?? h.dewpoint ?? null,
    wind: h.wind ?? h.windspeed ?? h.windSpeed ?? 0,
    rh: h.rh ?? h.relative_humidity ?? null
  }));
}

function normalizeCurrent(c = {}) {
  return {
    ...c,
    temp: c.temp ?? c.temperature ?? c.temperatureF ?? null,
    wind: c.wind ?? c.wind_avg ?? c.windSpeed ?? 0,
    rh: c.rh ?? c.relative_humidity ?? null
  };
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

    // ------------------------------------------------------------
    // NORMALIZE ONCE
    // ------------------------------------------------------------
    const hourly = Array.isArray(data?.hourly)
      ? normalizeHourly(data.hourly)
      : [];

    const current = data?.current
      ? normalizeCurrent(data.current)
      : null;

    if (current) renderHeaderMetrics(current);

    // ------------------------------------------------------------
    // HUMAN INTEL (FIXED)
    // ------------------------------------------------------------
    const human = buildHumanActionIntelFS({
      ...data,
      hourly,
      current
    });

    // ------------------------------------------------------------
    // CORE RENDER
    // ------------------------------------------------------------
   
    renderDroughtFire(drought);
  renderFeelScore(human?.feelscore);
    renderTimeline(hourly);
    renderTomorrow(human?.tomorrow);

    // ------------------------------------------------------------
    // CONTENT
    // ------------------------------------------------------------
    renderPulseV2(document.getElementById('pulse'), data?.pulse);
    renderSubstackV2(document.getElementById('update'), data?.substack);

    runStaggerAnimation();
    hideSplash();

  } catch (err) {
    console.error('Layout error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading</div>`;
  }
}

function detectDominantFactor(s = {}) {
  if (s.dewPoint >= 65) return "muggy";
  if (s.temp >= 85) return "heat";
  if (s.temp <= 45) return "cold";
  if (s.wind >= 12) return "wind";
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
// TIMELINE (CLEAN + FUTURE SAFE)
// ============================================================

function renderTimeline(hourly) {
  const container = document.getElementById('timeline');

  if (!Array.isArray(hourly) || !hourly.length) {
    container.innerHTML = '';
    return;
  }

  const now = Date.now();

  // ------------------------------------------------------------
  // FUTURE HOURS ONLY
  // ------------------------------------------------------------
  const future = hourly.filter(h =>
    h && h.ts >= now && h.temp != null
  );

  const next = (future.length ? future : hourly).slice(0, 6);

  // ------------------------------------------------------------
  // SCORES (clamped to avoid fake perfection)
  // ------------------------------------------------------------
  const scores = next.map(h => {
    const raw = calculateComfort(h)?.score ?? 0;
    const scaled = Math.round(raw * 10);

    // prevent unrealistic 100 spam (UI-level guard)
    return Math.min(scaled, 98);
  });

  const best = Math.max(...scores);

  // ------------------------------------------------------------
  // BUILD UI (MATCHES CSS)
  // ------------------------------------------------------------
  const html = next.map((h, i) => {
    const isBest = scores[i] === best ? "best-hour" : "";

    return `
      <div class="hour-block ${isBest}">
        <div class="hour-time">${formatHour(h.ts)}</div>
        <div class="hour-temp">${Math.round(h.temp)}°</div>
        <div class="hour-score">${scores[i]}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="timeline-card">
      <div class="section-title">NEXT FEW HOURS</div>
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

function formatHour(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric' });
}

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

function getDroughtBackground(DSS, FRI) {
  const s = Math.max(DSS, FRI);
  if (s >= 85) return "rgba(183,28,28,0.25)";
  if (s >= 70) return "rgba(244,67,54,0.18)";
  if (s >= 55) return "rgba(255,152,0,0.14)";
  if (s >= 40) return "rgba(255,193,7,0.10)";
  return "rgba(255,255,255,0.03)";
}

function runStaggerAnimation() {
  document.querySelectorAll('.fade-in').forEach((el, i) => {
    setTimeout(() => el.classList.add('show'), i * 90);
  });
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  setTimeout(() => {
    splash.classList.add('hide');
    setTimeout(() => splash.remove(), 600);
  }, 300);
}

function renderHeaderMetrics(current) {
  const el = document.getElementById('wx-metrics');
  if (!el) return;

  const temp = Math.round(current.air_temperature ?? current.temperatureF ?? 0);
  const rh = Math.round(current.relative_humidity ?? 0);
  const wind = Math.round(current.wind_avg ?? current.windSpeed ?? 0);

  el.innerHTML = `
    <div class="live-chip">LIVE</div>
    <div class="metric-chip">🌡 ${temp}°</div>
    <div class="metric-chip">💦 ${rh}%</div>
    <div class="metric-chip">💨 ${wind} mph</div>
  `;
}

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

  // 👉 ADD IT HERE
  console.log("🔥 Drought payload:", data);

  const {
    DSS,
    FRI,
    dssTrend = 0,
    friTrend = 0,
    narrative
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

        <div class="df-block">
          <div class="df-label">DROUGHT STRESS</div>

          <div class="df-main" style="color:${dColor}">
            <span class="df-icon">🌵</span>
            <span class="df-value">${DSS ?? "--"}</span>
            <span class="df-trend">${dTrend.arrow}</span>
          </div>

          <div class="df-sub">
            ${fTrend.label}
            ${droughtMonitor ? ` • USDM ${droughtMonitor}` : ""}
          </div>
        </div>

        <div class="df-block">
          <div class="df-label">FIRE RISK</div>

          <div class="df-main" style="color:${fColor}">
            <span class="df-icon">🔥</span>
            <span class="df-value">${FRI ?? "--"}</span>
            <span class="df-trend">${fTrend.arrow}</span>
          </div>

          <div class="df-sub">
  ${dTrend.label}
  ${droughtMonitor ? ` • ${droughtMonitor}` : ""}
</div>
        </div>

      </div>

      <div class="df-headline">
        ${narrative?.headline || ""}
      </div>

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

  const { score, headline, bullets, emoji } = data;

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
        bullets?.length
          ? `<div class="day-bullets">
              ${bullets.map(b => `<div class="day-bullet">• ${b}</div>`).join("")}
            </div>`
          : ""
      }

    </div>
  `;
}
