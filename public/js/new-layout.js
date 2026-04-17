// ============================================================
// AVL WEATHER — V2 LAYOUT (CLEAN + STABLE)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { normalizeOpenMeteo } from '/js/intel/normalize-hourly.js';
import { assembleWithVoice } from '/js/intel/synthesizer/assembleWithVoice.js';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js';

import { renderPulseV2 } from '/js/modules/renderPulseV2.js';
import { renderSubstackV2 } from '/js/modules/renderSubstackV2.js';

// ============================================================
// DROUGHT FETCH
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
// MAIN ENTRY
// ============================================================

export async function renderNewLayout(container) {
  container.innerHTML = `
    <div class="top-stack">
      <div id="feelscore" class="fade-in"></div>
      <div id="droughtfire" class="fade-in"></div>
      <div id="today" class="fade-in"></div>
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

    // ============================================================
    // SAFE NORMALIZATION
    // ============================================================

   // ============================================================
// SAFE NORMALIZATION (LOCAL + NON-DESTRUCTIVE)
// ============================================================

function normalizeHourlyLocal(hourlyRaw = []) {
  return hourlyRaw.map(h => ({
    ts: h.ts || h.time || h.timestamp,

    temp:
      h.temp ??
      h.temperature ??
      h.temperatureF,

    dewPoint:
      h.dewPoint ??
      h.dewpoint ??
      null,

    wind:
      h.wind ??
      h.windspeed ??
      h.windSpeed ??
      0,

    rh:
      h.rh ??
      h.relative_humidity ??
      h.humidity ??
      null
  }));
}

let hourly = [];
let current = null;

// ------------------------------------------------------------
// HOURLY
// ------------------------------------------------------------

if (Array.isArray(data?.hourly) && data.hourly.length) {
  hourly = normalizeHourlyLocal(data.hourly);
} else {
  console.warn("⚠️ Invalid hourly structure:", data?.hourly);
}

// ------------------------------------------------------------
// CURRENT (light normalization only)
// ------------------------------------------------------------

if (data?.current) {
  current = {
    ...data.current,
    temp:
      data.current.temp ??
      data.current.temperature ??
      data.current.temperatureF,

    wind:
      data.current.wind ??
      data.current.wind_avg ??
      data.current.windSpeed,

    rh:
      data.current.rh ??
      data.current.relative_humidity
  };
}

    // ============================================================
    // RENDER CORE
    // ============================================================

    renderFeelScore(current);
    renderDroughtFire(drought);
    renderToday(human?.today);
    renderTimeline(hourly);
    renderTomorrow(human?.tomorrow);

    // ============================================================
    // CONTENT MODULES
    // ============================================================

    renderPulseV2(
      document.getElementById('pulse'),
      data?.pulse
    );

    renderSubstackV2(
      document.getElementById('update'),
      data?.substack
    );

    runStaggerAnimation();
    hideSplash();

  } catch (err) {
    console.error('Layout error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading</div>`;
  }
}

// ============================================================
// FEELSCORE
// ============================================================

function renderFeelScore(current) {
  if (!current) return;

  const comfort = calculateComfort(current);
  const score = Math.round((comfort?.score || 0) * 10);

  const color = getFeelScoreColor(score);
  const bgTint = getFeelScoreBackground(score);

  const intel = buildHumanActionIntelFS({ current, score });

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(score),
    comfort?.goldilocks
  );

  const headline = narrative?.headline || "Feels pretty good out";
  const bullets = (narrative?.bullets || []).slice(0, 2);

  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card hero" style="
      background:
        linear-gradient(${bgTint}, ${bgTint}),
        #101b33;
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

      <div class="fs-headline">${headline}</div>

      <div class="fs-bullets">
        ${bullets.map(b => `<div class="fs-bullet">• ${b}</div>`).join('')}
      </div>
    </div>
  `;

  animateScoreOnce('#feelscore .fs-score', score);
}

// ============================================================
// DROUGHT / FIRE
// ============================================================

function renderDroughtFire(data) {
  if (!data) return;

  const { DSS, FRI, narrative } = data;
  const bgTint = getDroughtBackground(DSS, FRI);

  document.getElementById('droughtfire').innerHTML = `
    <div class="df-card" style="
      background:
        linear-gradient(${bgTint}, ${bgTint}),
        #121a2b;
    ">
      <div class="df-header">DROUGHT / FIRE</div>

      <div class="df-scores">
        <div class="df-score">🔥 ${FRI}</div>
        <div class="df-score">🌵 ${DSS}</div>
      </div>

      <div class="df-headline">${narrative?.headline || ""}</div>
    </div>
  `;
}

// ============================================================
// TODAY
// ============================================================

function renderToday(today) {
  if (!today) return;

  document.getElementById('today').innerHTML = `
    <div class="today-card">
      <div class="section-title">TODAY</div>
      <div>${today.headline}</div>
    </div>
  `;
}

// ============================================================
// TOMORROW
// ============================================================

function renderTomorrow(data) {
  if (!data) return;

  const { headline, bullets, score } = data;
  const bgTint = getFeelScoreBackground(score || 70);

  document.getElementById('tomorrow').innerHTML = `
    <div class="tomorrow-card" style="
      background:
        linear-gradient(${bgTint}, ${bgTint}),
        #101b33;
    ">
      <div class="section-title">TOMORROW</div>
      <div class="tm-headline">${headline}</div>
      <div class="tm-bullets">
        ${(bullets || []).slice(0, 2).map(b => `
          <div class="tm-bullet">• ${b}</div>
        `).join("")}
      </div>
    </div>
  `;
}

// ============================================================
// TIMELINE
// ============================================================

function renderTimeline(hourly) {
  const container = document.getElementById('timeline');

  if (!Array.isArray(hourly) || !hourly.length) {
    container.innerHTML = '';
    return;
  }

  // ------------------------------------------------------------
  // VALID DATA (normalized shape)
  // ------------------------------------------------------------
  const valid = hourly.filter(h =>
    h && h.ts && h.temp != null
  );

  if (!valid.length) {
    container.innerHTML = '';
    return;
  }

  // ------------------------------------------------------------
  // NEXT 6 HOURS (future-aware)
  // ------------------------------------------------------------
  const now = Date.now();

  const future = valid.filter(h => h.ts >= now);

  const next = (future.length ? future : valid).slice(0, 6);

  // ------------------------------------------------------------
  // BEST HOUR
  // ------------------------------------------------------------
  const scores = next.map(h =>
    Math.round((calculateComfort(h)?.score || 0) * 10)
  );

  const best = Math.max(...scores);

  // ------------------------------------------------------------
  // BUILD UI
  // ------------------------------------------------------------
  const html = next.map((h, i) => {
    const score = scores[i];
    const isBest = score === best ? "best-hour" : "";

    return `
      <div class="hour-block ${isBest}">
        <div>${formatHour(h.ts)}</div>
        <div>${Math.round(h.temp)}°</div>
        <div>${score}</div>
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