// ============================================================
// NEW LAYOUT — AVL WEATHER PREVIEW
// ============================================================

// 👉 IMPORT YOUR EXISTING LOGIC (adjust paths as needed)
import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfortScore } from './js/intel/comfort.js';


// ============================================================
// MAIN RENDER FUNCTION
// ============================================================

export async function renderNewLayout(container) {
  container.innerHTML = `
    <div class="top-stack">

      <!-- FEELSCORE -->
      <div id="feelscore" class="card"></div>

      <!-- TODAY -->
      <div id="today" class="card"></div>

      <!-- NEXT FEW HOURS -->
      <div id="timeline" class="card"></div>

      <!-- TOMORROW -->
      <div id="tomorrow" class="card"></div>

    </div>
  `;

  try {
  const data = await getWeatherForUI({ lat, lon });

    // --- CURRENT ---
    const current = data.current;
    const hourly = data.hourly;

    const currentScore = calculateComfortScore(current);

    renderFeelScore(current, currentScore);
    renderToday(hourly);
    renderTimeline(hourly);
    renderTomorrow(data);

  } catch (err) {
    console.error('Preview load error:', err);
    container.innerHTML = `<div style="padding:20px;">Error loading preview</div>`;
  }
}


// ============================================================
// FEELSCORE MODULE
// ============================================================

function renderFeelScore(current, score) {
  const label = getFeelLabel(score);
  const detail = getFeelDetail(current);
  const action = getFeelAction(score);

  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card">
      <div class="fs-title">FEELSCORE</div>
      <div class="fs-score">${Math.round(score)}</div>
      <div class="fs-label">${label}</div>
      <div class="fs-detail">${detail}</div>
      <div class="fs-action">${action}</div>
    </div>
  `;
}


// ============================================================
// TODAY MODULE (INSIGHT LAYER)
// ============================================================

function renderToday(hourly) {
  const headline = getTodayHeadline(hourly);
  const { bestWindow, worstWindow } = getKeyWindows(hourly);

  document.getElementById('today').innerHTML = `
    <div class="today-card">
      <div class="today-headline">${headline}</div>

      <div class="today-points">
        <div>Worst: ${worstWindow}</div>
        <div>Best: ${bestWindow}</div>
      </div>
    </div>
  `;
}


// ============================================================
// TIMELINE (NEXT FEW HOURS)
// ============================================================

function renderTimeline(hourly) {
  const nextHours = data.hourly.time.slice(0, 5).map((t, i) => ({
  time: t,
  temp: data.hourly.temperature_2m[i],
  humidity: data.hourly.relative_humidity_2m[i]
}));

  const html = nextHours.map(h => {
    const score = calculateComfortScore(h);
    const emoji = getSimpleIcon(score);

    return `
      <div class="hour-block">
        <div class="hour-time">${formatHour(h.time)}</div>
        <div class="hour-icon">${emoji}</div>
        <div class="hour-temp">${Math.round(h.temp)}°</div>
        <div class="hour-score">${Math.round(score)}</div>
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
// TOMORROW MODULE
// ============================================================

function renderTomorrow(data) {
  const tomorrow = data.daily[1];

  const score = calculateComfortScore({
    temp: tomorrow.temp.max,
    humidity: tomorrow.humidity,
    wind: tomorrow.wind
  });

  const label = getFeelLabel(score);

  document.getElementById('tomorrow').innerHTML = `
    <div class="tomorrow-card">
      <div class="tomorrow-title">TOMORROW</div>
      <div class="tomorrow-score">FeelScore ${Math.round(score)}</div>
      <div class="tomorrow-label">${label}</div>
    </div>
  `;
}


// ============================================================
// HELPERS (LIGHTWEIGHT — NO NEW ENGINE)
// ============================================================

function getFeelLabel(score) {
  if (score >= 85) return "Feels amazing";
  if (score >= 75) return "Feels great";
  if (score >= 65) return "Pretty comfortable";
  if (score >= 50) return "A bit off";
  if (score >= 35) return "Uncomfortable";
  return "Rough outside";
}

function getFeelDetail(current) {
  if (current.humidity > 70) return "Humid air";
  if (current.humidity < 40) return "Dry air";
  if (current.wind > 10) return "Breezy conditions";
  return "Balanced conditions";
}

function getFeelAction(score) {
  if (score >= 80) return "Great time to be outside";
  if (score >= 65) return "Good for most activities";
  if (score >= 50) return "Okay in short bursts";
  return "Better to limit time outside";
}


// ============================================================
// TODAY LOGIC (uses your existing hourly data)
// ============================================================

function getTodayHeadline(hourly) {
  const now = calculateComfortScore(hourly[0]);
  const later = calculateComfortScore(hourly[3]);

  if (later > now + 5) return "Improves later today";
  if (later < now - 5) return "Gets less comfortable this afternoon";
  return "Stays fairly steady today";
}

function getKeyWindows(hourly) {
  let best = { score: -Infinity, index: 0 };
  let worst = { score: Infinity, index: 0 };

  hourly.slice(0, 8).forEach((h, i) => {
    const score = calculateComfortScore(h);

    if (score > best.score) best = { score, index: i };
    if (score < worst.score) worst = { score, index: i };
  });

  return {
    bestWindow: formatHour(hourly[best.index].time),
    worstWindow: formatHour(hourly[worst.index].time)
  };
}


// ============================================================
// SMALL UTILITIES
// ============================================================

function formatHour(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: 'numeric' });
}

function getSimpleIcon(score) {
  if (score >= 80) return "🙂";
  if (score >= 60) return "😐";
  return "😕";
}