// ============================================================
// AVL WEATHER — V2 LAYOUT (CLEAN + MODULAR)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { normalizeOpenMeteo } from '/js/intel/normalize-hourly.js';
import { assembleWithVoice } from '/js/intel/synthesizer/assembleWithVoice.js';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js';

// NEW MODULES
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

    const hourly = normalizeOpenMeteo(data.hourly || []);
    const current =
      normalizeOpenMeteo([data.current])[0] || data.current;

      renderHeaderMetrics(current);

    const human = buildHumanActionIntelFS({
      ...data,
      hourly,
      current
    });

    // -----------------------------
    // CORE MODULES
    // -----------------------------
    renderFeelScore(current);
    renderDroughtFire(drought);
    renderToday(human.today);
    renderTimeline(hourly);
    renderTomorrow(human.tomorrow);

    // -----------------------------
    // CONTENT MODULES (NEW)
    // -----------------------------
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

const intel = buildHumanActionIntelFS({ current });

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
        <div class="fs-title">
          FEELSCORE
          <span class="info-btn" onclick="openInfo('feelscore', ${score})">ⓘ</span>
        </div>
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

  const { DSS, FRI, dssLabel, friLabel, narrative } = data;

  const bgTint = getDroughtBackground(DSS, FRI);

  document.getElementById('droughtfire').innerHTML = `
    <div class="df-card" style="
      background:
        linear-gradient(${bgTint}, ${bgTint}),
        #121a2b;
    ">
      <div class="df-header">DROUGHT / FIRE</div>

      <div class="df-scores">
        <div class="df-score">${FRI}</div>
        <div class="df-score">${DSS}</div>
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
// TOMORROW (FIXED)
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
// TIMELINE (KEEP SIMPLE)
// ============================================================

function renderTimeline(hourly) {
  if (!hourly?.length) return;

  const next = hourly.slice(0, 6);

  document.getElementById('timeline').innerHTML = `
    <div class="timeline-card">
      <div class="section-title">NEXT FEW HOURS</div>

      <div class="timeline-row">
        ${next.map(h => {
          const comfort = calculateComfort(h);
          const score = Math.round((comfort?.score || 0) * 10);

          const tint = getFeelScoreBackground(score);
          const color = getFeelScoreColor(score);

          return `
            <div class="hour-block" style="
              background:
                linear-gradient(${tint}, ${tint}),
                rgba(255,255,255,0.04);
            ">

              <div class="hour-time">
                ${formatHour(h.timestamp)}
              </div>

              <div class="hour-icon">
                ${getWeatherEmoji(h)}
              </div>

              <div class="hour-temp">
                ${Math.round(h.temperatureF)}°
              </div>

              <div class="hour-score" style="color:${color}">
                ${score}
              </div>

            </div>
          `;
        }).join('')}
      </div>
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

  animateScore(el, score);

  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

function animateScore(el, end) {
  const start = performance.now();

  function frame(t) {
    const p = Math.min((t - start) / 500, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * end);
    if (p < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function formatHour(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric' });
}

// color helpers (same as before)
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
  const elements = document.querySelectorAll('.fade-in');

  elements.forEach((el, i) => {
    if (el.classList.contains('show')) return;

    setTimeout(() => {
      el.classList.add('show');
    }, i * 90);
  });
}

function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  // let the first card begin animating before fade
  setTimeout(() => {
    splash.classList.add('hide');

    // remove from DOM after animation completes
    setTimeout(() => {
      splash.remove();
    }, 600);

  }, 300);
}

function renderHeaderMetrics(current) {
  const el = document.getElementById('metric-chips');
  const updated = document.getElementById('updated-time');

  if (!el || !current) return;

  const temp = Math.round(current.air_temperature ?? current.temperatureF ?? 0);
  const dew = Math.round(current.dew_point ?? 0);
  const rh = Math.round(current.relative_humidity ?? 0);
  const wind = Math.round(current.wind_avg ?? current.windSpeed ?? 0);

  el.innerHTML = `
    <div class="metric-chip">🌡 ${temp}°</div>
    <div class="metric-chip">💧 ${dew}°</div>
    <div class="metric-chip">💦 ${rh}%</div>
    <div class="metric-chip">💨 ${wind} mph</div>
  `;

  if (updated && current.timestamp) {
    updated.textContent =
      "Updated " + formatTimeAgo(new Date(current.timestamp));
  }
}

function formatTimeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

function getWeatherEmoji(h) {
  if (h.precipitation > 0.1) return "🌧️";
  if (h.cloudcover > 60) return "☁️";
  return "☀️";
}

function mapScoreToCategory(score) {
  if (score >= 90) return "ideal";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slight";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}