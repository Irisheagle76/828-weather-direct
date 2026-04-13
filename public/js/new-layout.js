// ============================================================
// NEW LAYOUT — AVL WEATHER PREVIEW (FINAL CLEAN)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';
import { assembleWithVoice } from '/js/intel/synthesizer/assembleWithVoice.js';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js';


// ============================================================
// MAIN RENDER (FIXED DATA PIPELINE)
// ============================================================

export async function renderNewLayout(container) {
  container.innerHTML = `
    <div class="top-stack">
      <div id="feelscore" class="card"></div>
      <div id="today" class="card"></div>
      <div id="timeline" class="card"></div>
      <div id="tomorrow" class="card"></div>
    </div>
  `;

  try {
    const data = await getWeatherForUI({
      lat: 35.5951,
      lon: -82.5515
    });

    // ------------------------------------------------------------
    // 🔥 NORMALIZE ALL WEATHER INPUT (CRITICAL FIX)
    // ------------------------------------------------------------
    const rawHourly = data.hourly || [];
    const hourly = normalizeOpenMeteo(rawHourly);

    // normalize current using same pipeline
    const current =
      normalizeOpenMeteo([data.current])[0] ||
      data.current;

    // ------------------------------------------------------------
    // 🧠 HUMAN INTEL (now uses clean data)
    // ------------------------------------------------------------
    const human = buildHumanActionIntelFS({
      ...data,
      hourly,
      current
    });

    // ------------------------------------------------------------
    // 🎯 RENDER
    // ------------------------------------------------------------
    renderFeelScore(current);
    renderToday(human.today);
    renderTimeline(hourly);
    renderTomorrow(human.tomorrow);

  } catch (err) {
    console.error('Preview load error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading preview</div>`;
  }
}

// ============================================================
// FEELSCORE (SYNTHESIZED)
// ============================================================

function renderFeelScore(current) {
  if (!current) return;

  const comfort = calculateComfort(current);
  const score = Math.round((comfort?.score || 0) * 10);

  const intel = {
    signals: {
      temp: current.temp,
      dewPoint: current.dewPoint ?? current.dew_point ?? null,
      windSpeed: current.wind ?? current.windSpeed ?? 0
    },
    dominantFactor: detectDominantFactor(current),
    confidence: 0.7,
    snapshot: current
  };

  const category = mapScoreToCategory(score);

  const narrative = assembleWithVoice(
    intel,
    "today",
    category,
    comfort?.goldilocks
  );

  const headline = comfort?.goldilocks
    ? "Chef’s kiss outside"
    : narrative?.headline || "Feels pretty good out";

  const bullets = (narrative?.bullets || []).slice(0, 2);

  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card">

      <div class="fs-header">
        <div class="fs-title">FEELSCORE</div>
        <div class="fs-score">${score}</div>
      </div>

      <div class="fs-headline">${headline}</div>

      ${bullets.length ? `
        <div class="fs-bullets">
          ${bullets.map(b => `<div class="fs-bullet">• ${b}</div>`).join('')}
        </div>
      ` : ``}

    </div>
  `;
}


// ============================================================
// TODAY
// ============================================================

function renderToday(today) {
  if (!today) return;

  const headline = today.headline || "Conditions are steady";
  const bullets = (today.bullets || []).slice(0, 3);

  document.getElementById('today').innerHTML = `
    <div class="today-card">

      <div class="today-header">
        <div class="today-title">TODAY</div>
        <div class="today-emoji">${today.emoji || ""}</div>
      </div>

      <div class="today-headline">${headline}</div>

      ${bullets.length ? `
        <div class="today-bullets">
          ${bullets.map(b => `<div class="today-bullet">• ${b}</div>`).join('')}
        </div>
      ` : ``}

    </div>
  `;
}


// ============================================================
// TOMORROW
// ============================================================

function renderTomorrow(tomorrow) {
  if (!tomorrow) return;

  const headline = tomorrow.headline || "Conditions are steady";
  const bullets = (tomorrow.bullets || []).slice(0, 3);

  document.getElementById('tomorrow').innerHTML = `
    <div class="tomorrow-card">

      <div class="tomorrow-header">
        <div class="tomorrow-title">TOMORROW</div>
        <div class="tomorrow-emoji">${tomorrow.emoji || ""}</div>
      </div>

      <div class="tomorrow-headline">${headline}</div>

      ${bullets.length ? `
        <div class="tomorrow-bullets">
          ${bullets.map(b => `<div class="tomorrow-bullet">• ${b}</div>`).join('')}
        </div>
      ` : ``}

    </div>
  `;
}


// ============================================================
// TIMELINE (UNCHANGED BASELINE)
// ============================================================

function renderTimeline(hourly) {
  if (!hourly?.length) return;

  const nextHours = hourly.slice(0, 5);

  const html = nextHours.map(h => {
    const comfort = calculateComfort(h);
    const score = Math.round((comfort?.score || 0) * 10);
    const emoji = getSimpleIcon(score);

    return `
      <div class="hour-block">
        <div class="hour-time">${formatHour(h.time)}</div>
        <div class="hour-icon">${emoji}</div>
        <div class="hour-temp">${Math.round(h.temp)}°</div>
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
// HELPERS
// ============================================================

function mapScoreToCategory(score) {
  if (score >= 88) return "veryComfortable";
  if (score >= 70) return "comfortable";
  if (score >= 55) return "slightlyUncomfortable";
  if (score >= 40) return "uncomfortable";
  return "harsh";
}

function detectDominantFactor(current) {
  const dp = current.dewPoint ?? current.dew_point ?? 55;
  const temp = current.temp ?? 70;
  const wind = current.wind ?? current.windSpeed ?? 0;

  if (dp >= 68) return "muggy";
  if (temp >= 88) return "heat";
  if (temp <= 45) return "cold";
  if (wind >= 15) return "wind";

  return "sun";
}

function formatHour(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}

function getSimpleIcon(score) {
  if (score >= 80) return "🙂";
  if (score >= 60) return "😐";
  return "😕";
}