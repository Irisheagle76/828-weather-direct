// ============================================================
// 4-DAY FORECAST (MANUAL-FIRST)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js';
import { calculateComfort } from '/js/intel/comfort.js';

const LOCATION = {
  lat: 35.5951,
  lon: -82.5515
};

let forecastOverrides = {};

// ============================================================
// MAIN
// ============================================================

export async function render4DayForecast(container) {
  if (!container) return;

  container.innerHTML = renderLoading();

  const [manualForecast, weatherData] = await Promise.all([
    loadForecastOverrides(),
    loadWeatherFallback()
  ]);

  forecastOverrides = manualForecast;

  const hourly = normalizeHourly(weatherData?.hourly || []);
  const days = buildForecastDays(hourly).map((day, index) => {
    const manual = getManualDay(day.key);
    return manual
      ? buildManualDay(day, index, manual)
      : buildFallbackDay(day, index);
  });

  const lead = days[0];

  container.innerHTML = `
    ${renderLeadClean(lead)}
    ${days.map(renderDay).join('')}
  `;

  bindExpand();
}

// ============================================================
// DATA
// ============================================================

async function loadForecastOverrides() {
  try {
    const res = await fetch('/api/forecast/latest', { cache: 'no-store' });
    if (!res.ok) throw new Error(`latest forecast ${res.status}`);
    const forecast = await res.json();
    if (forecast?.days && Object.keys(forecast.days).length) {
      return forecast;
    }
  } catch (err) {
    console.warn('Published forecast API unavailable, trying JSON fallback:', err);
  }

  try {
    const res = await fetch('/forecast-overrides.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`forecast-overrides.json ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('Manual forecast unavailable:', err);
    return {};
  }
}

async function loadWeatherFallback() {
  try {
    return await getWeatherForUI(LOCATION);
  } catch (err) {
    console.warn('Automated fallback unavailable:', err);
    return null;
  }
}

function getManualDay(dateKey) {
  const day = forecastOverrides?.days?.[dateKey];
  if (!day) return null;

  const hasAuthoredForecast =
    hasText(day.headline) ||
    hasText(day.narrative) ||
    day.high != null ||
    day.low != null ||
    hasTimeline(day.timeline);

  return hasAuthoredForecast ? day : null;
}

function normalizeHourly(hourly) {
  return hourly.map(hour => {
    const date = new Date(hour.timestamp);

    return {
      ...hour,
      localDate: date,
      localHour: date.getHours(),
      dayKey: toDateKey(date)
    };
  });
}

function buildForecastDays(hourly) {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const days = [];

  for (let offset = 1; offset <= 4; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);

    const key = toDateKey(date);
    const hours = hourly
      .filter(hour => hour.dayKey === key)
      .sort((a, b) => a.localDate - b.localDate);

    days.push({ date, key, hours });
  }

  return days;
}

// ============================================================
// DAY BUILDERS
// ============================================================

function buildManualDay(day, index, manual) {
  const fallback = buildFallbackDay(day, index);
  const confidence = numberOrNull(manual.confidence);
  const timeline = normalizeTimeline(manual.timeline);
  const tags = Array.isArray(manual.tags) ? manual.tags.filter(Boolean) : [];

  return {
    ...fallback,
    source: 'manual',
    high: manual.high ?? fallback.high,
    low: manual.low ?? fallback.low,
    icon: pickManualIcon(manual),
    headline: manual.headline || fallback.headline,
    takeaway: manual.narrative || fallback.takeaway,
    timeline,
    tags,
    localInsight: manual.localInsight || null,
    confidence,
    showScore: false,
    wind: normalizeManualWind(manual.wind),
    rainWindow: manual.rainWindow || null,
    sky: manual.sky || null,
    humidity: manual.humidity || null,
    stormRisk: manual.stormRisk || 'none'
  };
}

function buildFallbackDay(day, index) {
  const hours = day.hours;
  const temps = hours.map(hour => numberOrNull(hour.temperatureF)).filter(Number.isFinite);
  const rain = analyzeRain(hours);
  const score = computeComfortScore(hours);
  const high = temps.length ? Math.round(Math.max(...temps)) : '--';
  const low = temps.length ? Math.round(Math.min(...temps)) : '--';
  const timeline = buildTimeline(hours);

  return {
    source: 'fallback',
    date: day.date,
    key: day.key,
    index,
    hours,
    high,
    low,
    icon: pickFallbackIcon(hours, rain),
    headline: fallbackHeadline(rain, hours),
    takeaway: fallbackNarrativePublic(rain, timeline),
    timeline,
    tags: [],
    localInsight: null,
    confidence: null,
    showScore: false,
    wind: summarizeWind(hours),
    rainWindow: null,
    sky: null,
    stormRisk: rain.type === 'none' ? 'none' : 'possible'
  };
}

// ============================================================
// RENDER
// ============================================================

function renderLoading() {
  return `
    <div class="card forecast-summary">
      Loading the 4-day forecast...
    </div>
  `;
}

function renderLead(day) {
  if (!day) return '';

  const timeline = day.timeline || {};
  const blocks = [
    ['Morning', timeline.morning],
    ['Midday', timeline.midday],
    ['Afternoon', timeline.afternoon],
    ['Evening', timeline.evening]
  ];

  return `
    <section class="forecast-lead">
      <div class="forecast-headline">
      ${escapeHtml(day.headline || '4-Day Forecast')}
      </div>

    <div class="forecast-timeline">
      <strong>Morning:</strong> ${escapeHtml(timeline.morning || '—')} |
      <strong>Midday:</strong> ${escapeHtml(timeline.midday || '—')} |
      <strong>Afternoon:</strong> ${escapeHtml(timeline.afternoon || '—')} |
      <strong>Evening:</strong> ${escapeHtml(timeline.evening || '—')}
    </div>
  `;
}

function renderSummary(days) {
  return '';
}

function renderLeadClean(day) {
  if (!day) return '';

  const timeline = day.timeline || {};
  const blocks = [
    ['Morning', timeline.morning],
    ['Midday', timeline.midday],
    ['Afternoon', timeline.afternoon],
    ['Evening', timeline.evening]
  ];

  return `
    <section class="forecast-lead">
      <div class="forecast-headline">
        ${escapeHtml(day.headline || '4-Day Forecast')}
      </div>

      <div class="forecast-timeline" aria-label="Forecast timeline">
        ${blocks.map(([label, text]) => `
          <div class="forecast-timeline-block">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(text || '-')}</strong>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderDay(day) {
  const toneClass = toneClassFor(day);

  return `
    <div class="card forecast-row expandable ${toneClass}">
      <div class="row-top">
        <div class="day">${escapeHtml(formatDay(day.date, day.index))}</div>
      </div>

      <div class="row-main">
        <div class="temps">
          <span class="high">${escapeHtml(formatTemp(day.high))}</span>
          <span class="low">${escapeHtml(formatTemp(day.low))}</span>
        </div>

        ${renderDaySignal(day)}
      </div>

      ${renderScoreBar(day)}

      <div class="row-bottom">
        <div class="day-headline">${escapeHtml(day.headline || '')}</div>
        ${renderTakeaway(day.takeaway)}
        ${renderSignals(day)}
        ${renderLocalInsight(day.localInsight)}
      </div>

      <div class="expand-content">
        ${renderExpandedDetails(day)}
      </div>
    </div>
  `;
}

function renderTakeaway(text) {
  if (!text) return '';
  return `<div class="takeaway">${escapeHtml(text)}</div>`;
}

function renderDaySignal(day) {
  return `<div class="forecast-card-icon">${day.icon}</div>`;
}

function renderScoreBar(day) {
  return '';
}

function renderSignals(day) {
  const signals = [
    ...(day.tags || []).map(tag => ({ label: tag, type: 'tag' })),
    day.humidity ? { label: `Humidity: ${formatCategory(day.humidity)}`, type: 'humidity' } : null,
    day.wind ? { label: `Wind ${formatWind(day.wind)}`, type: 'wind' } : null,
    day.rainWindow?.start
      ? {
          label: `Rain window: ${day.rainWindow.start}${day.rainWindow.end ? ` to ${day.rainWindow.end}` : ''}`,
          type: 'rain'
        }
      : null
  ].filter(Boolean);

  if (!signals.length) return '';

  return `
    <div class="forecast-signals">
      ${signals.map(signal => `
        <span class="forecast-signal forecast-signal-${signal.type}">
          ${escapeHtml(signal.label)}
        </span>
      `).join('')}
    </div>
  `;
}

function renderLocalInsight(text) {
  if (!text) return '';
  return `<div class="forecast-local"><span>Local note</span>${escapeHtml(text)}</div>`;
}

function renderExpandedDetails(day) {
  if (day.source === 'manual') {
    return renderManualTimeline(day.timeline);
  }

  return `
    <div class="hourly-strip">
      ${day.hours
        .filter(hour => hour.localHour >= 7 && hour.localHour < 19)
        .map(renderHour)
        .join('')}
    </div>
  `;
}

function renderManualTimeline(timeline = {}) {
  const blocks = [
    ['Morning', timeline.morning],
    ['Midday', timeline.midday],
    ['Afternoon', timeline.afternoon],
    ['Evening', timeline.evening]
  ];

  return `
    <div class="hourly-strip">
      ${blocks.map(([label, text]) => `
        <div class="hour">
          <div class="hour-time">${escapeHtml(label)}</div>
          <div class="hour-temp">${escapeHtml(text || '—')}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHour(hour) {
  const level = getPrecipLevel(hour);

  return `
    <div class="hour">
      <div class="hour-time">${formatHour(hour.localHour)}</div>
      <div class="hour-temp">${Math.round(hour.temperatureF)}°</div>
      <div class="precip-bar">
        <div class="precip-fill level-${level}"></div>
      </div>
    </div>
  `;
}

// ============================================================
// WEATHER ANALYSIS
// ============================================================

function analyzeRain(hours) {
  if (!hours.length) return { type: 'none', coverage: 0, peak: 0 };

  const buckets = {
    morning: [],
    midday: [],
    afternoon: [],
    evening: []
  };

  hours.forEach(hour => {
    const probability = normalizeProbability(hour.precipProbability);
    const amount = numberOrNull(hour.precipAmount) || 0;
    const hasRain = amount > 0.01 || probability >= 45;

    if (!hasRain) return;

    if (hour.localHour >= 5 && hour.localHour < 10) buckets.morning.push(probability);
    else if (hour.localHour < 14) buckets.midday.push(probability);
    else if (hour.localHour < 18) buckets.afternoon.push(probability);
    else buckets.evening.push(probability);
  });

  const counts = Object.entries(buckets).map(([key, values]) => ({
    key,
    count: values.length,
    peak: values.length ? Math.max(...values) : 0
  }));

  const totalRain = counts.reduce((sum, bucket) => sum + bucket.count, 0);
  const coverage = totalRain / hours.length;

  if (coverage < 0.2) {
    return { type: 'none', coverage, peak: 0 };
  }

  const dominant = counts.sort((a, b) => b.count - a.count)[0];

  return {
    type: dominant.key,
    coverage,
    peak: dominant.peak
  };
}

function buildTimeline(hours) {
  return {
    morning: summarizeHours(hours, 6, 11),
    midday: summarizeHours(hours, 11, 14),
    afternoon: summarizeHours(hours, 14, 18),
    evening: summarizeHours(hours, 18, 22)
  };
}

function summarizeHours(hours, start, end) {
  const subset = hours.filter(hour => hour.localHour >= start && hour.localHour < end);
  if (!subset.length) return '—';

  const avgCloud = average(subset.map(hour => numberOrNull(hour.cloudCover)).filter(Number.isFinite));
  const rainHits = subset.filter(hour => {
    const probability = normalizeProbability(hour.precipProbability);
    const amount = numberOrNull(hour.precipAmount) || 0;
    return amount > 0.01 || probability >= 45;
  }).length;
  const rainRatio = rainHits / subset.length;

  if (rainRatio > 0.4) return 'showers likely';
  if (rainRatio > 0.15) return 'spotty showers';
  if (avgCloud > 70 || (avgCloud > 0.7 && avgCloud <= 1)) return 'mostly cloudy';
  if (avgCloud > 40 || (avgCloud > 0.4 && avgCloud <= 1)) return 'partly cloudy';
  return 'mostly sunny';
}

function computeComfortScore(hours) {
  if (!hours.length) return 50;

  const scores = hours
    .map(hour => calculateComfort(hour)?.score)
    .filter(Number.isFinite)
    .map(score => score * 10);

  if (!scores.length) return 50;
  return Math.round(average(scores));
}

function summarizeWind(hours) {
  if (!hours.length) return null;

  const anchor =
    hours.find(hour => hour.localHour >= 11 && hour.localHour <= 15) ||
    hours[Math.floor(hours.length / 2)];

  if (!anchor) return null;

  return {
    direction: directionFromDegrees(anchor.windDirection ?? anchor.windDir),
    speed: numberOrNull(anchor.windSpeed),
    gust: numberOrNull(anchor.windGust)
  };
}

// ============================================================
// COPY / FORMAT HELPERS
// ============================================================

function fallbackHeadline(rain, hours) {
  if (rain.coverage > 0.55) return 'Wet periods likely';
  if (rain.coverage > 0.3) return 'Showers possible at times';

  const cloud = average(hours.map(hour => numberOrNull(hour.cloudCover)).filter(Number.isFinite));
  if (cloud > 70 || (cloud > 0.7 && cloud <= 1)) return 'Clouds hold through the day';
  if (cloud > 40 || (cloud > 0.4 && cloud <= 1)) return 'A mix of sun and clouds';
  return 'Mostly quiet weather';
}

function fallbackNarrativePublic(rain, timeline) {
  if (rain.type !== 'none') {
    return `Showers are most favored around ${rain.type}, with timing still subject to refinement.`;
  }

  return `A quieter setup is favored, with ${timeline.morning} conditions early and ${timeline.afternoon} conditions later in the day.`;
}

function normalizeTimeline(timeline = {}) {
  return {
    morning: timeline.morning || null,
    midday: timeline.midday || null,
    afternoon: timeline.afternoon || null,
    evening: timeline.evening || null
  };
}

function normalizeManualWind(wind = {}) {
  if (!wind || typeof wind !== 'object') return null;

  const direction = wind.direction || null;
  const calm = Boolean(wind.calm);
  const speedMin = numberOrNull(wind.speedMin ?? wind.speed);
  const speedMax = numberOrNull(wind.speedMax ?? wind.speed);
  const gustNA = Boolean(wind.gustNA);
  const gust = gustNA ? null : numberOrNull(wind.gust);

  if (calm) return { direction, calm: true, speedMin: null, speedMax: null, gust: null, gustNA: true };

  if (!direction && speedMin == null && speedMax == null && gust == null && !gustNA) return null;

  return { direction, calm, speedMin, speedMax, gust, gustNA };
}

function pickManualIcon(day) {
  if (day.stormRisk && day.stormRisk !== 'none') return '⛈️';
  if (day.sky === 'showery') return '🌦️';
  if (day.sky === 'stormy') return '⛈️';
  if (day.sky === 'overcast' || day.sky === 'mostly_cloudy') return '☁️';
  if (day.sky === 'partly_cloudy') return '⛅';
  return '☀️';
}

function pickFallbackIcon(hours, rain) {
  if (rain.coverage > 0.55) return '🌧️';
  if (rain.coverage > 0.3) return '🌦️';

  const cloud = average(hours.map(hour => numberOrNull(hour.cloudCover)).filter(Number.isFinite));

  if (cloud > 70 || (cloud > 0.7 && cloud <= 1)) return '☁️';
  if (cloud > 40 || (cloud > 0.4 && cloud <= 1)) return '⛅';
  return '☀️';
}

function toneClassFor(day) {
  if (day.stormRisk && day.stormRisk !== 'none') return 'rain';
  if (day.sky === 'overcast' || day.sky === 'mostly_cloudy') return 'cloudy';
  if (day.sky === 'partly_cloudy') return 'partly';
  if (day.icon.includes('🌧') || day.icon.includes('🌦') || day.icon.includes('⛈')) return 'rain';
  if (day.icon.includes('☁')) return 'cloudy';
  if (day.icon.includes('⛅')) return 'partly';
  return 'sunny';
}

function mapComfortScore(score) {
  if (score >= 90) return 'Ideal';
  if (score >= 75) return 'Excellent';
  if (score >= 60) return 'Comfortable';
  if (score >= 45) return 'Unsettled';
  return 'Harsh';
}

function formatDay(date, index) {
  if (index === 0) return 'TOMORROW';
  return date.toLocaleDateString([], { weekday: 'long' }).toUpperCase();
}

function formatHour(hour) {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

function formatTemp(value) {
  if (value === '--' || value == null) return '--';
  return `${Math.round(Number(value))}°`;
}

function formatWind(wind) {
  if (!wind) return '';
  if (wind.calm) return 'calm';

  const min = numberOrNull(wind.speedMin ?? wind.speed);
  const max = numberOrNull(wind.speedMax ?? wind.speed);
  const speed = formatWindRange(min, max);
  const gust = wind.gustNA ? ' gust N/A' : wind.gust != null ? ` gusts ${Math.round(wind.gust)}` : '';

  const direction = wind.direction === 'variable' ? 'Variable' : wind.direction;
  return [direction, speed].filter(Boolean).join(' ') + gust;
}

function formatCategory(value) {
  return String(value || '')
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatWindRange(min, max) {
  if (min != null && max != null && min !== max) {
    return `${Math.round(min)}-${Math.round(max)} mph`;
  }

  if (min != null || max != null) {
    return `${Math.round(min ?? max)} mph`;
  }

  return '';
}

function getPrecipLevel(hour) {
  const probability = normalizeProbability(hour.precipProbability);
  const amount = numberOrNull(hour.precipAmount) || 0;

  if (amount < 0.005 && probability < 50) return 0;
  if (amount >= 0.15 || probability >= 85) return 5;
  if (amount >= 0.08 || probability >= 70) return 4;
  if (amount >= 0.04 || probability >= 60) return 3;
  if (amount >= 0.02 || probability >= 55) return 2;
  return 1;
}

function directionFromDegrees(degrees) {
  const value = numberOrNull(degrees);
  if (value == null) return null;

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(value / 45) % 8;
  return directions[index];
}

function normalizeProbability(value) {
  const n = numberOrNull(value);
  if (n == null) return 0;
  return n <= 1 ? n * 100 : n;
}

function numberOrNull(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasTimeline(timeline) {
  return Boolean(timeline && Object.values(timeline).some(hasText));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function bindExpand() {
  const cards = document.querySelectorAll('.forecast-row');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const isOpen = card.classList.contains('open');
      cards.forEach(other => other.classList.remove('open'));
      if (!isOpen) card.classList.add('open');
    });
  });
}
