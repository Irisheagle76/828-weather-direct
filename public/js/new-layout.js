// ============================================================
// AVL WEATHER — CLEAN SYNTH LAYOUT (WITH DROUGHT/FIRE)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { normalizeOpenMeteo } from '/js/intel/normalize-hourly.js';
import { assembleWithVoice } from '/js/intel/synthesizer/assembleWithVoice.js';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js';


// ============================================================
// DROUGHT / FIRE FETCH
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
// MAIN
// ============================================================

export async function renderNewLayout(container) {
  container.innerHTML = `
    <div class="top-stack">
      <div id="feelscore" class="card"></div>
      <div id="droughtfire" class="card"></div>
      <div id="today" class="card"></div>
      <div id="timeline" class="card"></div>
      <div id="tomorrow" class="card"></div>
    </div>
  `;

  try {
    const [data, drought] = await Promise.all([
      getWeatherForUI({
        lat: 35.5951,
        lon: -82.5515
      }),
      fetchDroughtFire()
    ]);

    const hourly = normalizeOpenMeteo(data.hourly || []);
    const current =
      normalizeOpenMeteo([data.current])[0] ||
      data.current;

    const human = buildHumanActionIntelFS({
      ...data,
      hourly,
      current
    });

    renderFeelScore(current);
    renderDroughtFire(drought); // 👈 NEW
    renderToday(human.today);
    renderTimeline(hourly);
    renderTomorrow(human.tomorrow);

  } catch (err) {
    console.error('Preview load error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading preview</div>`;
  }
}

// ============================================================
// FEELSCORE (NOW)
// ============================================================

function renderFeelScore(current) {
  if (!current) return;

  const comfort = calculateComfort(current);
  const score = Math.round((comfort?.score || 0) * 10);

  const color = getFeelScoreColor(score);
  const bgTint = getFeelScoreBackground(score);

  const intel = buildIntel(current, score, "current");

  const narrative = assembleWithVoice(
    intel,
    "today",
    mapScoreToCategory(score),
    comfort?.goldilocks
  );

  const headline =
    narrative?.headline ||
    "Feels pretty good out";

  const bullets = (
    narrative?.bullets?.length
      ? narrative.bullets
      : calmBullets(score, current)
  ).slice(0, 2);

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
        <div class="fs-score" style="color:${color}">
          ${score}
        </div>
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

  // ============================================================
  // ANIMATION (COUNT UP + BUMP)
  // ============================================================

  const scoreEl = document.querySelector('#feelscore .fs-score');

  if (!scoreEl) return;

  // prevent re-running animation unnecessarily
  if (!scoreEl.dataset.animated) {
    scoreEl.dataset.animated = "true";

    // start at 0
    scoreEl.textContent = "0";

    // count-up animation
    animateScore(scoreEl, score);

    // bump effect
    scoreEl.classList.add('bump');
    setTimeout(() => {
      scoreEl.classList.remove('bump');
    }, 300);

  } else {
    // fallback (no animation)
    scoreEl.textContent = score;
  }
}

// ============================================================
// DROUGHT / FIRE (NEW MODULE)
// ============================================================
function renderDroughtFire(data) {
  if (!data) return;

  const { DSS, FRI, dssLabel, friLabel, narrative } = data;

  const headline =
    narrative?.headline ||
    "Dry conditions in place";

  const bullets = (narrative?.bullets || []).slice(0, 2);

  // -----------------------------
  // COLORS
  // -----------------------------
 const dssColor = getDSSColor(DSS);
const friColor = getFRIColor(FRI);

const bgTint = getDroughtBackground(DSS, FRI);

  // -----------------------------
  // OFFICIAL DROUGHT (TEMP STATIC)
  // -----------------------------
  const official = {
    level: "D3",
    label: "Extreme Drought"
  };

  const badgeColor = getDroughtColor(official.level);

  document.getElementById('droughtfire').innerHTML = `
    <div class="df-card" style="
  background:
    linear-gradient(${bgTint}, ${bgTint}),
    #121a2b;
">

      <div class="df-header">
        DROUGHT / FIRE
        <span class="info-btn" onclick="openInfo('drought')">ⓘ</span>
      </div>

      <div class="df-scores">

        <div class="df-score" style="color:${friColor}">
          🔥 ${FRI}
          <span class="df-label">${friLabel}</span>
        </div>

        <div class="df-score" style="color:${dssColor}">
          🌵 ${DSS}
          <span class="df-label">${dssLabel}</span>
        </div>

      </div>

      <div class="df-official">
        <span class="df-badge" style="background:${badgeColor}">
          ${official.level}
        </span>
        ${official.label}
      </div>

      <div class="df-headline">${headline}</div>

      <div class="df-bullets">
        ${bullets.map(b => `<div class="df-bullet">• ${b}</div>`).join('')}
      </div>

    </div>
  `;
}

// ============================================================
// TODAY (DAY SHAPE)
// ============================================================

function renderToday(today) {
  if (!today) return;

  const score = today.score ?? 70;

  const headline =
    today.headline ||
    (score >= 90
      ? "One of those easy, dialed-in days"
      : "Comfortable overall");

  const bullets = (
    today.bullets?.length
      ? today.bullets
      : calmDayBullets(score)
  ).slice(0, 2);

  document.getElementById('today').innerHTML = `
    <div class="today-card">
      <div class="today-header">
        <div class="today-title">TODAY</div>
        <div class="today-emoji">${today.emoji || ""}</div>
      </div>

      <div class="today-headline">${headline}</div>

      <div class="today-bullets">
        ${bullets.map(b => `<div class="today-bullet">• ${b}</div>`).join('')}
      </div>
    </div>
  `;
}


// ============================================================
// TOMORROW (CHANGE / CONTINUITY)
// ============================================================

function renderTomorrow(tomorrow) {
  if (!tomorrow) return;

  const score = tomorrow.score ?? 70;

  const headline =
    tomorrow.headline ||
    (score >= 90
      ? "More of the same — another great day lined up"
      : "Conditions stay fairly similar");

  const bullets = (
    tomorrow.bullets?.length
      ? tomorrow.bullets
      : calmTomorrowBullets(score)
  ).slice(0, 2);

  document.getElementById('tomorrow').innerHTML = `
    <div class="tomorrow-card">
      <div class="tomorrow-header">
        <div class="tomorrow-title">TOMORROW</div>
        <div class="tomorrow-emoji">${tomorrow.emoji || ""}</div>
      </div>

      <div class="tomorrow-headline">${headline}</div>

      <div class="tomorrow-bullets">
        ${bullets.map(b => `<div class="tomorrow-bullet">• ${b}</div>`).join('')}
      </div>
    </div>
  `;
}


// ============================================================
// TIMELINE
// ============================================================

function renderTimeline(hourly) {
  if (!hourly?.length) return;

  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 1);

  const startIndex = hourly.findIndex(h => h.timestamp >= now.getTime());
  const nextHours = hourly.slice(startIndex >= 0 ? startIndex : 0, startIndex + 6);

  const html = nextHours.map(h => {
    const c = calculateComfort(h);
    const score = Math.round((c?.score || 0) * 10);

    return `
      <div class="hour-block">
        <div class="hour-time">${formatHour(h.timestamp)}</div>
        <div class="hour-icon">${getSimpleIcon(score)}</div>
        <div class="hour-temp">${Math.round(h.temperatureF)}°</div>
        <div class="hour-score">${score}</div>
      </div>
    `;
  }).join('');

  document.getElementById('timeline').innerHTML = `
    <div class="timeline-card">
      <div class="timeline-title">Next Few Hours</div>
      <div class="timeline-row">${html}</div>
    </div>
  `;
}


// ============================================================
// HELPERS (UNCHANGED)
// ============================================================

function buildIntel(current, score, mode) {
  return {
    signals: {
      temp: current.temperatureF,
      dewPoint: current.dewpointF,
      windSpeed: current.wind_speed ?? 0
    },
    pattern: {
      avg: score,
      trend: 0,
      min: score - 5,
      max: score + 5
    },
    context: {
      label: "today",
      timeWindow: mode
    },
    dominantFactor: detectDominantFactor(current)
  };
}

function calmBullets(score) {
  if (score >= 90) {
    return ["Nothing really pushing you around", "Air feels light and easy"];
  }
  return ["Fairly steady conditions overall"];
}

function calmDayBullets(score) {
  return score >= 90
    ? ["Just a smooth, easy stretch of weather"]
    : ["Conditions stay fairly steady"];
}

function calmTomorrowBullets(score) {
  return score >= 90
    ? ["That comfortable feel sticks around"]
    : ["No major changes expected"];
}

function mapScoreToCategory(score) {
  if (score >= 88) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slightlyUncomfortable";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function detectDominantFactor(current) {
  const dp = current.dewpointF ?? 55;
  const temp = current.temperatureF ?? 70;
  const wind = current.wind_speed ?? 0;

  if (dp >= 68) return "muggy";
  if (temp >= 88) return "heat";
  if (temp <= 45) return "cold";
  if (wind >= 15) return "wind";

  return "dry";
}

function formatHour(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric' });
}

function getSimpleIcon(score) {
  if (score >= 80) return "🙂";
  if (score >= 60) return "😐";
  return "😕";
}

function getDroughtColor(level) {
  switch (level) {
    case "D0": return "#F7E600"; // yellow
    case "D1": return "#E6B566"; // tan
    case "D2": return "#F29F05"; // orange
    case "D3": return "#D73027"; // red
    case "D4": return "#7F0000"; // dark red
    default: return "#999";
  }
}
// ============================================================
// COLOR SYSTEM
// ============================================================

function getFeelScoreColor(score) {
  if (score >= 90) return "#4caf50";
  if (score >= 75) return "#8bc34a";
  if (score >= 60) return "#ffc107";
  if (score >= 45) return "#ff9800";
  return "#f44336";
}

function getDSSColor(score) {
  if (score < 25) return "#4caf50";
  if (score < 45) return "#cddc39";
  if (score < 65) return "#ffc107";
  if (score < 85) return "#ff5722";
  return "#b71c1c";
}

function getFRIColor(score) {
  if (score < 30) return "#4caf50";
  if (score < 50) return "#ffc107";
  if (score < 70) return "#ff9800";
  if (score < 85) return "#f44336";
  return "#b71c1c";
}

function mapScoreToLabel(score) {
  if (score >= 90) return "Ideal";
  if (score >= 70) return "Comfortable";
  if (score >= 55) return "Slightly Off";
  if (score >= 40) return "Uncomfortable";
  return "Harsh";
}

function getDroughtBackground(DSS, FRI) {
  const severity = Math.max(DSS, FRI);

  if (severity >= 85) return "rgba(183, 28, 28, 0.25)"; // deep red
  if (severity >= 70) return "rgba(244, 67, 54, 0.18)"; // red
  if (severity >= 55) return "rgba(255, 152, 0, 0.14)"; // orange
  if (severity >= 40) return "rgba(255, 193, 7, 0.10)"; // yellow
  return "rgba(255,255,255,0.03)";
}

function getFeelScoreBackground(score) {
  if (score >= 90) return "rgba(76, 175, 80, 0.12)";   // soft green
  if (score >= 75) return "rgba(139, 195, 74, 0.10)";
  if (score >= 60) return "rgba(255, 193, 7, 0.08)";
  if (score >= 45) return "rgba(255, 152, 0, 0.08)";
  return "rgba(244, 67, 54, 0.10)";
}

// ============================================================
// ANIMATE SCORE
// ============================================================
function animateScore(el, end) {
  if (!el) return;

  const duration = 500;
  const startTime = performance.now();

  function frame(now) {
    const progress = Math.min((now - startTime) / duration, 1);

    // easeOut for smoother finish
    const eased = 1 - Math.pow(1 - progress, 3);

    const value = Math.round(eased * end);
    el.textContent = value;

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  }

  requestAnimationFrame(frame);
}