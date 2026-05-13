// ============================================================
// AVL WEATHER — V3 LAYOUT (STABLE + UNIFIED)
// ============================================================

import { getWeatherForUI } from '/js/adapters/weather-adapter.js?v=20260508-popscale';
import { calculateComfort } from '/js/intel/comfort.js';
import { generateNarrative } from '/js/intel/synthesizer/index.js?v=20260505-tomorrowvoice';
import { buildHumanActionIntelFS } from '/js/intel/human-action-feelscore.js?v=20260513-feelscore-dip-threshold';

import { renderPulseV2 } from '/js/modules/renderPulseV2.js';
import { renderSubstackV2 } from '/js/modules/renderSubstackV2.js?v=20260512-update-tagline';

console.log("828 Weather layout version: 20260512-update-tagline");

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

  const normalized = hourly.map(h => ({
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
      h.isRainingNow ?? false,

    cloudCover:
      h.cloudCover ?? h.cloud_cover ?? h.cloudcover ?? null,

    uvIndex:
      h.uvIndex ?? h.uv_index ?? null,

    weatherCode:
      h.weatherCode ?? h.weather_code ?? null
  }));

  // 👇 LOG INSIDE FUNCTION
  console.log("🌧️ NORMALIZED SAMPLE:", normalized[0]);
  console.log("🌧️ RAW SAMPLE:", hourly[0]);

  return normalized;
}

function normalizeCurrent(c = {}) {
  return {
    ...c,

    // normalize naming across sources
    temp:
      c.temp ??
      c.temperature ??
      c.temperatureF ??
      c.air_temperature ??
      null,

    wind:
      c.wind ??
      c.wind_avg ??
      c.windSpeed ??
      0,

    rh:
      c.rh ??
      c.relative_humidity ??
      c.relativeHumidity ??
      null,

    uvIndex:
      c.uvIndex ??
      c.uv_index ??
      null,

    // 🌧️ optional but helpful for consistency
    precipRate:
      c.precipRate ??
      c.precip_rate ??
      0
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

function getCurrentUvIndex(current = {}, hourly = []) {
  const directUv = current?.uvIndex ?? current?.uv_index;
  if (Number.isFinite(directUv)) return directUv;

  const now = Date.now();
  const closest = hourly
    .filter(h => Number.isFinite(h?.timestamp) && Number.isFinite(h?.uvIndex))
    .map(h => ({ uvIndex: h.uvIndex, distance: Math.abs(h.timestamp - now) }))
    .sort((a, b) => a.distance - b.distance)[0];

  return closest?.distance <= 90 * 60 * 1000 ? closest.uvIndex : null;
}

// ============================================================
// CONTENT LOADERS (PULSE + SUBSTACK)
// ============================================================

async function loadPulse() {
  const container = document.getElementById('pulse');
  if (!container) return;

  try {
    const res = await fetch('/api/tidbits/pulse-feed');

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
      <div id="timeline" class="fade-in"></div>
      <div id="tomorrow" class="fade-in"></div>
      <div id="forecast-link" class="fade-in"></div>
      <div id="droughtfire" class="fade-in"></div>
      <div id="pulse" class="fade-in"></div>
      <div id="update" class="fade-in"></div>
    </div>
  `;

  try {
  const weatherPromise = getWeatherForUI({ lat: 35.5951, lon: -82.5515 });
  const droughtPromise = fetchDroughtFire();

  const data = await weatherPromise;

// 👇 ADD THESE TWO LINES
console.log("FULL API DATA:", data);

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

   if (current) renderHeaderMetrics(current, tempest, hourly);

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
   
  renderFeelScore(human?.feelscore, hourly);
    renderTimeline(hourly, data?.daily, current, tempest);
renderTomorrow(human?.tomorrow);
renderForecastLink();

    runStaggerAnimation();
    hideSplash();

    // ------------------------------------------------------------
    // LOWER-PAGE CONTENT (LOAD AFTER CORE REVEAL)
    // ------------------------------------------------------------
    droughtPromise.then(renderDroughtFire).catch(() => renderDroughtFire(null));
    loadPulse();
    loadSubstack();

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

function buildFeelscoreTempOutlook(hourly = []) {
  if (!Array.isArray(hourly) || !hourly.length) return null;

  const now = new Date();
  const todayTargetHour = now.getHours() < 15 ? 15 : 21;
  const target = new Date(now);
  target.setHours(todayTargetHour, 0, 0, 0);

  const primaryHour = findNearestHour(hourly, target.getTime(), 90);
  const low = findNextLow(hourly, now);

  if (!primaryHour && !low) return null;

  return {
    primary: primaryHour
      ? {
          label: todayTargetHour === 15 ? "3 PM Temp" : "9 PM Temp",
          value: Math.round(primaryHour.temperatureF)
        }
      : null,
    low
  };
}

function findNearestHour(hourly = [], targetTs, toleranceMinutes = 90) {
  const tolerance = toleranceMinutes * 60 * 1000;
  const match = hourly
    .filter(h => Number.isFinite(h?.timestamp) && Number.isFinite(h?.temperatureF))
    .map(h => ({
      ...h,
      distance: Math.abs(h.timestamp - targetTs)
    }))
    .sort((a, b) => a.distance - b.distance)[0];

  return match?.distance <= tolerance ? match : null;
}

function findNextLow(hourly = [], now = new Date()) {
  const hour = now.getHours();
  const windowStart = new Date(now);
  const windowEnd = new Date(now);

  if (hour < 9) {
    windowEnd.setHours(9, 0, 0, 0);
  } else {
    windowStart.setHours(21, 0, 0, 0);
    if (windowStart.getTime() <= now.getTime()) {
      windowEnd.setDate(windowEnd.getDate() + 1);
    }
    windowEnd.setHours(9, 0, 0, 0);
    if (windowEnd.getTime() <= windowStart.getTime()) {
      windowEnd.setDate(windowEnd.getDate() + 1);
    }
  }

  const lows = hourly.filter(h =>
    Number.isFinite(h?.timestamp) &&
    Number.isFinite(h?.temperatureF) &&
    h.timestamp >= windowStart.getTime() &&
    h.timestamp <= windowEnd.getTime()
  );

  if (!lows.length) return null;

  const low = lows.reduce((coldest, h) =>
    h.temperatureF < coldest.temperatureF ? h : coldest
  );

  return {
    label: hour < 9 ? "Morning Low" : "Overnight Low",
    value: Math.round(low.temperatureF)
  };
}

// ============================================================
// FEELSCORE
// ============================================================

function renderFeelScore(data, hourly = []) {
  if (!data) return;

  const { score, headline, subHeadline, narrative, bullets, emoji } = data;
  const tempOutlook = buildFeelscoreTempOutlook(hourly);

  const color = getFeelScoreColor(score);
  const bgTint = getFeelScoreBackground(score);

  document.getElementById('feelscore').innerHTML = `
    <div class="feelscore-card hero" style="
      background: linear-gradient(${bgTint}, ${bgTint}), #101b33;
    ">
      <div class="fs-header">
        <span>FEELSCORE</span>
        <button class="fs-info-cta" type="button" onclick="openInfo('feelscore', ${score})">
          <span>i</span>
          <em>What is this?</em>
        </button>
      </div>

      <div class="fs-hero-row">
        <div class="fs-score" style="color:${color}">${score}</div>
        <div class="fs-status" style="color:${color}">
          ${mapScoreToLabel(score)}
        </div>
      </div>

      <div class="fs-headline">${headline || ""}</div>

      ${
        subHeadline || narrative
          ? `<div class="fs-subhead">${subHeadline || narrative}</div>`
          : ""
      }

      <div class="fs-footer-row">
        <div class="fs-bullets">
          ${(bullets || []).map(b => `<div class="fs-bullet">• ${b}</div>`).join('')}
        </div>

        ${tempOutlook ? `
          <div class="fs-temp-outlook">
            ${tempOutlook.primary ? `
              <div class="fs-temp-main">
                <div class="fs-temp-label">${tempOutlook.primary.label}</div>
                <div class="fs-temp-value">${tempOutlook.primary.value}&deg;</div>
              </div>
            ` : ""}
            ${tempOutlook.low ? `
              <div class="fs-temp-low">
                <div class="fs-temp-label">${tempOutlook.low.label}</div>
                <div class="fs-temp-low-value">${tempOutlook.low.value}&deg;</div>
              </div>
            ` : ""}
          </div>
        ` : ""}
      </div>
  `;

  animateScoreOnce('#feelscore .fs-score', score);
}

// ============================================================
// TIMELINE (CLEAN + FUTURE SAFE — FIXED)
// ============================================================

function renderTimeline(hourly, daily = [], current = null, tempest = null) {
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

  const observedTemp = getObservedTempF(current, tempest);
  const displayHours = applyTemperatureCushion(next, observedTemp);

  // ------------------------------------------------------------
  // SCORES
  // ------------------------------------------------------------
const scores = displayHours.map((h, i) => {
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

  let raw = calculateComfort(adjusted)?.score;

  // 🔒 HARD GUARD
  if (!Number.isFinite(raw)) {
    console.warn("⚠️ BAD COMFORT SCORE", adjusted);
    raw = 5; // neutral baseline
  }

  // apply gust penalty
  if (g >= 12) raw -= 0.5;
  else if (g >= 7) raw -= 0.25;

  const scaled = Math.round(raw * 10);

  // 🔒 FINAL GUARD
  return Number.isFinite(scaled)
    ? Math.min(scaled, 98)
    : 50;
}
  // ------------------------------------------------------------
  // FARTHER HOURS (unchanged)
  // ------------------------------------------------------------
  const raw = calculateComfort(h)?.score ?? 0;
  const scaled = Math.round(raw * 10);

  return Math.min(scaled, 98);
});

  const best = Math.max(...scores);
  const editorial = buildTimelineEditorial(displayHours, scores, daily);

  // ------------------------------------------------------------
  // BUILD UI
  // ------------------------------------------------------------
  const html = displayHours.map((h, i) => {
    const isBest = scores[i] === best ? "best-hour" : "";
    const icon = getHourlyIcon(h);

    return `
      <div class="hour-block ${isBest}">
        <div class="hour-time">${formatHour(h.timestamp)}</div>
        <div class="hour-icon" aria-hidden="true">${icon}</div>
        <div class="hour-temp"><span aria-hidden="true">🌡️</span>${Math.round(h.temperatureF)}°</div>
        <div class="hour-score"><span aria-hidden="true">◎</span>${scores[i]}</div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="timeline-card">
      <div class="timeline-header">
        <div>
          <div class="section-title feelscore-title">Feelscore next few hours</div>
          <div class="timeline-kicker">Near-term comfort outlook</div>
        </div>
        <div class="timeline-best-pill">${best}</div>
      </div>
      <div class="timeline-row">${html}</div>
      ${editorial ? `<div class="timeline-editorial">${editorial}</div>` : ""}
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

function getObservedTempF(current = null, tempest = null) {
  const toF = c => (c * 9) / 5 + 32;

  if (Number.isFinite(tempest?.air_temperature)) {
    return toF(tempest.air_temperature);
  }

  if (Number.isFinite(current?.temperatureF)) {
    return current.temperatureF;
  }

  if (Number.isFinite(current?.temp)) {
    return current.temp;
  }

  return null;
}

function applyTemperatureCushion(hours = [], observedTemp = null) {
  if (!Number.isFinite(observedTemp)) return hours;

  const weights = [0.72, 0.56, 0.38, 0.22, 0.1, 0];

  return hours.map((hour, index) => {
    const modelTemp = hour.temperatureF;
    if (!Number.isFinite(modelTemp)) return hour;

    const difference = observedTemp - modelTemp;
    const weight = Math.abs(difference) >= 3 ? (weights[index] ?? 0) : 0;
    const cushionedTemp = modelTemp + difference * weight;

    return {
      ...hour,
      modeledTemperatureF: modelTemp,
      observedTemperatureF: observedTemp,
      temperatureF: cushionedTemp
    };
  });
}

function formatHourRange(startTs, endTs) {
  return `${formatHour(startTs)}-${formatHour(endTs)}`;
}

function getHourlyIcon(hour = {}) {
  const precipType = String(hour.precipType || "").toLowerCase();
  const precipProbability = Number.isFinite(hour.precipProbability)
    ? hour.precipProbability
    : 0;
  const precipAmount = Number.isFinite(hour.precipAmount)
    ? hour.precipAmount
    : 0;
  const cloudCover = normalizeCloudCover(hour.cloudCover);
  const uvIndex = Number.isFinite(hour.uvIndex) ? hour.uvIndex : 0;
  const code = Number.isFinite(hour.weatherCode) ? hour.weatherCode : null;
  const isNight = isNightHour(hour.timestamp);
  const hasMeaningfulPrecip =
    precipAmount >= 0.005 ||
    precipProbability >= 0.45 ||
    /rain|shower|drizzle|sprinkle|thunder|storm|snow|sleet|ice|freezing/.test(precipType) ||
    (code != null && code >= 51);

  if (code >= 95 || /thunder|storm/.test(precipType)) return "⛈️";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86) || /snow|sleet|ice|freezing/.test(precipType)) return "❄️";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || precipAmount >= 0.005 || precipProbability >= 0.45 || /rain|shower|drizzle|sprinkle/.test(precipType)) return "🌧️";
  if (!isNight && !hasMeaningfulPrecip && uvIndex >= 0.3) return "☀️";
  if (cloudCover >= 0.78) return "☁️";
  if (cloudCover >= 0.38) return isNight ? "☁️" : "⛅";
  return isNight ? "🌙" : "☀️";
}

function isNightHour(timestamp) {
  if (!Number.isFinite(timestamp)) return false;
  const hour = new Date(timestamp).getHours();
  return hour < 6 || hour >= 21;
}
function normalizeCloudCover(value) {
  if (!Number.isFinite(value)) return 0.45;
  return value > 1 ? value / 100 : value;
}

function hasPrecipSignal(hour = {}) {
  const precipType = String(hour.precipType || "").toLowerCase();
  const probability = Number.isFinite(hour.precipProbability)
    ? hour.precipProbability
    : 0;
  const amount = Number.isFinite(hour.precipAmount)
    ? hour.precipAmount
    : 0;
  const code = Number.isFinite(hour.weatherCode) ? hour.weatherCode : null;

  return (
    amount >= 0.005 ||
    probability >= 0.25 ||
    (code != null && code >= 51) ||
    /rain|shower|drizzle|sprinkle|thunder|storm|snow|sleet|ice|freezing/.test(precipType)
  );
}

function getPrecipLabel(hour = {}) {
  const precipType = String(hour.precipType || "").toLowerCase();
  const code = Number.isFinite(hour.weatherCode) ? hour.weatherCode : null;

  if (code >= 95 || /thunder|storm/.test(precipType)) return "thunderstorms";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86) || /snow|sleet|ice|freezing/.test(precipType)) return "wintry precipitation";
  if (/drizzle|sprinkle/.test(precipType)) return "light precipitation";
  if ((code >= 80 && code <= 82) || /shower/.test(precipType)) return "showers";
  return "rain";
}

function getDaylightBounds(timestamp, daily = []) {
  const target = new Date(timestamp);
  const targetKey = target.toDateString();
  const match = Array.isArray(daily)
    ? daily.find(day => {
        const dayTs = day?.timestamp ?? day?.date ?? day?.time;
        const date = Number.isFinite(dayTs)
          ? new Date(dayTs)
          : new Date(dayTs);
        return !Number.isNaN(date.getTime()) && date.toDateString() === targetKey;
      })
    : null;

  const sunrise = Number.isFinite(match?.sunrise) ? match.sunrise : null;
  const sunset = Number.isFinite(match?.sunset) ? match.sunset : null;

  if (sunrise && sunset) return { sunrise, sunset };

  const fallbackRise = new Date(target);
  fallbackRise.setHours(6, 30, 0, 0);

  const fallbackSet = new Date(target);
  fallbackSet.setHours(20, 0, 0, 0);

  return {
    sunrise: fallbackRise.getTime(),
    sunset: fallbackSet.getTime()
  };
}

function isWithinDaylight(hour, daily) {
  const { sunrise, sunset } = getDaylightBounds(hour.timestamp, daily);
  return hour.timestamp >= sunrise && hour.timestamp <= sunset;
}

function findBestOutdoorWindow(hours = [], scores = [], daily = []) {
  const candidates = hours.map((hour, index) => ({
    ...hour,
    score: scores[index] ?? 0
  })).filter(hour =>
    isWithinDaylight(hour, daily) &&
    hour.score >= 72 &&
    !hasPrecipSignal(hour)
  );

  if (candidates.length < 2) return null;

  let bestWindow = null;

  for (let i = 0; i < candidates.length - 1; i++) {
    for (const size of [3, 2]) {
      const slice = candidates.slice(i, i + size);
      if (slice.length !== size) continue;

      const isConsecutive = slice.every((hour, idx) =>
        idx === 0 || hour.timestamp - slice[idx - 1].timestamp <= 90 * 60 * 1000
      );

      if (!isConsecutive) continue;

      const avgScore = slice.reduce((sum, hour) => sum + hour.score, 0) / slice.length;
      if (!bestWindow || avgScore > bestWindow.avgScore) {
        const bounds = getDaylightBounds(slice[0].timestamp, daily);
        bestWindow = {
          start: slice[0].timestamp,
          end: Math.min(slice.at(-1).timestamp + 60 * 60 * 1000, bounds.sunset),
          avgScore
        };
      }
    }
  }

  return bestWindow;
}

function buildTimelineEditorial(hours = [], scores = [], daily = []) {
  const parts = [];
  const bestWindow = findBestOutdoorWindow(hours, scores, daily);
  const precipHour = hours.find(hasPrecipSignal);

  if (bestWindow) {
    parts.push(`Best outdoor window: ${formatHourRange(bestWindow.start, bestWindow.end)}.`);
  }

  if (precipHour) {
    const label = getPrecipLabel(precipHour);
    parts.push(`${label.charAt(0).toUpperCase() + label.slice(1)} may be in play around ${formatHour(precipHour.timestamp)}.`);
  }

  return parts.join(" ");
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
  }, 100);
}

// ------------------------------------------------------------
// HEADER METRICS
// ------------------------------------------------------------
function renderHeaderMetrics(current, tempest = {}, hourly = []) {
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

const uvRaw = getCurrentUvIndex(current, hourly);

  // ---------------------------
  // normalized values
  // ---------------------------
  const temp = round(tempRaw);
  const rh = round(rhRaw);
  const dew = round(dewRaw);
  const wind = round(windRaw);
  const gust = round(gustRaw);
  const uv = Number.isFinite(uvRaw) ? Math.round(uvRaw) : null;

// ---------------------------
// wind display logic
// ---------------------------
const showGust =
  Number.isFinite(gustRaw) &&
  Number.isFinite(windRaw) &&
  gustRaw > windRaw + 3;

const windHTML = showGust
  ? `
    <span class="metric-icon" aria-hidden="true">&#127788;&#65039;</span>
    <span class="label">Wind</span>
    <span class="value">
      ${wind} mph
      <span class="gust">G ${gust}</span>
    </span>
  `
  : `
    <span class="metric-icon" aria-hidden="true">&#127788;&#65039;</span>
    <span class="label">Wind</span>
    <span class="value">${wind}<span class="unit"> mph</span></span>
  `;

  // ---------------------------
  // render
  // ---------------------------
  container.innerHTML = `
    <div class="metric-chip temp">
      <span class="metric-icon" aria-hidden="true">&#127777;&#65039;</span>
      <span class="value">${temp}°</span>
    </div>

    <div class="metric-chip humidity">
      <span class="metric-icon" aria-hidden="true">&#128167;</span>
      <span class="label">RH</span>
      <span class="value">${rh}%</span>
    </div>

    <div class="metric-chip dew">
      <span class="metric-icon" aria-hidden="true">&#128166;</span>
      <span class="label">DP</span>
      <span class="value">${dew}°</span>
    </div>

    <div class="metric-chip wind">
      ${windHTML}
    </div>

    ${uv != null ? `
      <div class="metric-chip uv">
        <span class="metric-icon" aria-hidden="true">☀️</span>
        <span class="label">UV</span>
        <span class="value">${uv}</span>
      </div>
    ` : ""}
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
    fireDriver,
    dssLabel,
    friLabel
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
        <div>
          <div class="df-title">ASHEVILLE DROUGHT AND FIRE THREAT</div>
          <div class="df-subtitle">Fuel dryness, rainfall deficits, wind, and humidity</div>
        </div>
        <button class="df-info-cta" type="button" onclick="openInfo('drought', ${FRI})">
          <span aria-hidden="true">i</span>
          More Info
        </button>
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
          <div class="df-scale-label">${dssLabel || labelDroughtStress(DSS)}</div>

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
          <div class="df-scale-label">${friLabel || labelFireRisk(FRI)}</div>

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

let liveTimerStarted = false;

export async function initGlobalWeatherUI() {
  try {
    const data = await getWeatherForUI({
      lat: 35.5951,
      lon: -82.5515
    });

    const fetchedAt = Date.now();

    const hourly = Array.isArray(data?.hourly)
      ? normalizeHourly(data.hourly)
      : [];

    const current = data?.current
      ? normalizeCurrent(data.current)
      : null;

    const tempest = data?.tempest ?? null;

    // 🔥 header metrics
    if (current) {
      renderHeaderMetrics(current, tempest, hourly);
    }

    // 🔥 live time
    const live = document.getElementById("liveAge");

    if (live) {
      live.textContent = "UPDATED JUST NOW";

      if (!liveTimerStarted) {
        liveTimerStarted = true;

        setInterval(() => {
          const minutes = Math.floor(
            (Date.now() - fetchedAt) / 60000
          );

          live.textContent =
            minutes < 1
              ? "UPDATED JUST NOW"
              : `${minutes} min ago`;
        }, 60000);
      }
    }

    return { data, hourly, current, fetchedAt };

  } catch (err) {
    console.error("Global UI init failed:", err);
    return null;
  }
}

// ============================================================
// Forecast LINK
// ============================================================
function renderForecastLinkLegacy() {
  const el = document.getElementById('forecast-link');
  if (!el) return;

  el.innerHTML = `
    <div class="card forecast-link-card">
      <a href="/forecast.html">
        Next 4 Days →
      </a>
    </div>
  `;
}

function labelDroughtStress(score) {
  if (!Number.isFinite(score)) return "Unavailable";
  if (score < 20) return "Normal";
  if (score < 40) return "Dry";
  if (score < 60) return "Moderate";
  if (score < 80) return "Severe";
  return "Extreme";
}

function labelFireRisk(score) {
  if (!Number.isFinite(score)) return "Unavailable";
  if (score < 20) return "Low";
  if (score < 40) return "Moderate";
  if (score < 60) return "Elevated";
  if (score < 80) return "High";
  return "Extreme";
}

function renderForecastLink() {
  const el = document.getElementById('forecast-link');
  if (!el) return;

  el.innerHTML = `
    <div class="forecast-link-card">
      <a class="forecast-link" href="/forecast.html" aria-label="Open the next four day forecast">
        <span class="forecast-link-copy">
          <span class="forecast-link-kicker">Extended Forecast</span>
          <span class="forecast-link-title">See how the next 4 days unfold</span>
          <span class="forecast-link-sub">Daily cards, timing notes, and comfort signals</span>
        </span>

        <span class="forecast-link-preview" aria-hidden="true">
          <span class="forecast-preview-grid">
            <span class="forecast-preview-day"><b>Day 1</b><i>☀️</i><em></em></span>
            <span class="forecast-preview-day"><b>Day 2</b><i>⛅</i><em></em></span>
            <span class="forecast-preview-day"><b>Day 3</b><i>🌧️</i><em></em></span>
            <span class="forecast-preview-day"><b>Day 4</b><i>🌤️</i><em></em></span>
          </span>
        </span>

        <span class="forecast-link-main">
          Open
          <span class="forecast-link-arrow" aria-hidden="true">→</span>
        </span>
      </a>
    </div>
  `;
}
