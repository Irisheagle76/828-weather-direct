// ============================================================
// TIM'S FORECAST BOARD (MANUAL-FIRST, BACKWARD COMPATIBLE)
// ============================================================

import { getWeatherForUI } from "/js/adapters/weather-adapter.js";
import { calculateComfort } from "/js/intel/comfort.js";

const LOCATION = { lat: 35.5951, lon: -82.5515 };

let forecastOverrides = {};

export async function render4DayForecast(container) {
  if (!container) return;

  container.innerHTML = renderLoading();

  const [manualForecast, weatherData] = await Promise.all([
    loadForecastOverrides(),
    loadWeatherFallback()
  ]);

  forecastOverrides = manualForecast || {};

  const hourly = normalizeHourly(weatherData?.hourly || []);
  const days = buildForecastDays(hourly).map((day, index) => {
    const manual = getManualDay(day.key);
    return manual ? buildManualDay(day, index, manual) : buildFallbackDay(day, index);
  });

  const board = buildBoard(forecastOverrides, days);

  container.innerHTML = `
    ${renderBoardHero(board)}
    ${renderWeekAheadSignals(forecastOverrides.weekAheadSignals, board)}
    <section class="forecast-board-grid" aria-label="Four day forecast">
      ${days.map(renderForecastCard).join("")}
    </section>
  `;
}

async function loadForecastOverrides() {
  try {
    const res = await fetch("/api/router?route=forecast/latest", { cache: "no-store" });
    if (!res.ok) throw new Error(`latest forecast ${res.status}`);
    const forecast = await res.json();
    if (forecast?.days && Object.keys(forecast.days).length) return forecast;
  } catch (err) {
    console.warn("Published forecast API unavailable, trying JSON fallback:", err);
  }

  try {
    const res = await fetch("/forecast-overrides.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`forecast-overrides.json ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("Manual forecast unavailable:", err);
    return {};
  }
}

async function loadWeatherFallback() {
  try {
    return await getWeatherForUI(LOCATION);
  } catch (err) {
    console.warn("Automated fallback unavailable:", err);
    return null;
  }
}

function getManualDay(dateKey) {
  const day = forecastOverrides?.days?.[dateKey];
  if (!day) return null;

  const hasAuthoredForecast =
    hasText(day.headline) ||
    hasText(day.narrative) ||
    hasText(day.condition) ||
    hasText(day.mainIssue) ||
    hasText(day.bestWindow) ||
    hasText(day.localNote || day.localInsight) ||
    day.high != null ||
    day.low != null ||
    day.feelScore != null ||
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

  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index + 1);
    const key = toDateKey(date);
    const hours = hourly
      .filter(hour => hour.dayKey === key)
      .sort((a, b) => a.localDate - b.localDate);

    return { date, key, hours };
  });
}

function buildManualDay(day, index, manual) {
  const fallback = buildFallbackDay(day, index);
  const timeline = normalizeTimeline(manual.timeline);
  const tags = Array.isArray(manual.tags) ? manual.tags.filter(Boolean) : [];
  const condition = manual.condition ? formatCategory(manual.condition) : formatCategory(manual.sky) || fallback.condition;
  const icon = manual.icon || pickManualIcon(manual) || fallback.icon;
  const feelScore = numberOrNull(manual.feelScore) ?? fallback.feelScore;

  return {
    ...fallback,
    source: "manual",
    high: manual.high ?? fallback.high,
    low: manual.low ?? fallback.low,
    icon,
    condition,
    feelScore,
    headline: manual.headline || fallback.headline,
    narrative: manual.narrative || fallback.narrative,
    timeline,
    tags,
    mainIssue: manual.mainIssue || null,
    bestWindow: manual.bestWindow || null,
    confidence: manual.confidence ? normalizeConfidence(manual.confidence) : null,
    localNote: manual.localNote || manual.localInsight || null,
    wind: normalizeManualWind(manual.wind),
    rainWindow: manual.rainWindow || null,
    sky: manual.sky || null,
    humidity: manual.humidity || null,
    stormRisk: manual.stormRisk || "none"
  };
}

function buildFallbackDay(day, index) {
  const hours = day.hours;
  const temps = hours.map(hour => numberOrNull(hour.temperatureF)).filter(Number.isFinite);
  const rain = analyzeRain(hours);
  const feelScore = computeComfortScore(hours);
  const high = temps.length ? Math.round(Math.max(...temps)) : "--";
  const low = temps.length ? Math.round(Math.min(...temps)) : "--";
  const timeline = buildTimeline(hours);
  const icon = pickFallbackIcon(hours, rain);

  return {
    source: "fallback",
    date: day.date,
    key: day.key,
    index,
    hours,
    high,
    low,
    icon,
    condition: conditionFromIcon(icon, rain),
    feelScore,
    headline: fallbackHeadline(rain, hours),
    narrative: fallbackNarrativePublic(rain, timeline),
    timeline,
    tags: [],
    mainIssue: null,
    bestWindow: null,
    confidence: null,
    localNote: null,
    wind: summarizeWind(hours),
    rainWindow: null,
    sky: null,
    humidity: null,
    stormRisk: rain.type === "none" ? "none" : "possible"
  };
}

function buildBoard(forecast, days) {
  const lead = days[0] || {};

  return {
    boardHeadline: forecast.boardHeadline || lead.headline || "A four-day look at Asheville weather",
    boardSummary: forecast.boardSummary || lead.narrative || "The latest manual forecast will appear here when published.",
    rainRisk: normalizeRisk(forecast.rainRisk || inferRainRisk(days)),
    comfortTrend: normalizeTrend(forecast.comfortTrend || inferComfortTrend(days)),
    bestOutdoorDay: forecast.bestOutdoorDay || labelForDay(bestScoredDay(days)),
    watchDay: forecast.watchDay || labelForDay(watchDay(days)),
    mostComfortableDay: forecast.mostComfortableDay || labelForDay(bestScoredDay(days)),
    mostUncertainDay: forecast.mostUncertainDay || labelForDay(uncertainDay(days)),
    forecastConfidence: numberOrNull(forecast.forecastConfidence) ?? averageConfidence(days)
  };
}

function renderLoading() {
  return `<div class="card forecast-summary">Loading Tim's Forecast Board...</div>`;
}

function renderBoardHero(board) {
  return `
    <section class="forecast-board-hero">
      <div class="forecast-board-kicker">Tim's Forecast Board</div>
      <h2>${escapeHtml(board.boardHeadline)}</h2>
      <p>${escapeHtml(board.boardSummary)}</p>
    </section>
  `;
}

function renderWeekAheadSignals(input, board = {}) {
  const signals = normalizeWeekAheadSignals(input);
  if (!signals.cards.length) return "";

  return `
    <section class="week-ahead-signals" aria-label="Week ahead signals">
      <div class="week-ahead-signals-head">
        <div>
          <span>Tim's weather signals</span>
          <h2>Week Ahead Signals</h2>
        </div>
        <p>A curated look at the pattern, comfort, and watch points.</p>
      </div>

      ${renderSignalSummaryChips(board)}
      ${renderGlobalSignals(signals.global)}

      <div class="week-ahead-signal-grid card-count-${signals.cards.length}">
        ${signals.cards.map(renderSignalCard).join("")}
      </div>
    </section>
  `;
}

function renderSignalSummaryChips(board = {}) {
  return `
    <div class="forecast-board-chips week-ahead-summary-chips">
      ${renderBoardChip("Rain Risk", formatCategory(board.rainRisk), `risk-${board.rainRisk}`)}
      ${renderBoardChip("Comfort Trend", formatCategory(board.comfortTrend), `trend-${board.comfortTrend}`)}
      ${renderBoardChip("Best Outdoor Day", board.bestOutdoorDay || "TBD", "best")}
      ${renderBoardChip("Forecast Confidence", formatPercent(board.forecastConfidence), "confidence")}
    </div>
  `;
}

function normalizeWeekAheadSignals(input) {
  const cards = Array.isArray(input?.cards)
    ? input.cards
        .map(card => ({
          label: String(card?.label || "").trim(),
          value: String(card?.value || "").trim(),
          detail: String(card?.detail || "").trim(),
          type: normalizeSignalType(card?.type)
        }))
        .filter(card => card.label && card.value)
        .slice(0, 2)
    : [];

  return {
    global: input?.global && typeof input.global === "object" ? input.global : {},
    cards: cards.length >= 2 ? cards : []
  };
}

function normalizeSignalType(type) {
  const value = String(type || "").trim().toLowerCase();
  return ["comfort", "impact", "pattern", "uncertainty", "mountain", "custom"].includes(value)
    ? value
    : "custom";
}

function renderGlobalSignals(global = {}) {
  const fields = [
    { label: "Weather Pattern", value: global.weatherPattern, type: "pattern" },
    { label: "Temperature Trend", value: global.temperatureTrend, type: "temperature" },
    { label: "Wind Signal", value: global.windSignal, type: "wind" },
    { label: "Rainfall Trend", value: global.rainfallTrend, type: "rain" },
    { label: "Mountain Visibility", value: global.mountainVisibility, type: "mountain" }
  ].filter(field => hasText(field.value)).slice(0, 3);

  if (!fields.length) return "";

  return `
    <div class="week-ahead-global-strip">
      ${fields.map(field => `
        <div class="week-ahead-global-item global-${escapeHtml(field.type)}">
          <span>${escapeHtml(field.label)}</span>
          <strong>${escapeHtml(field.value)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function renderSignalCard(card) {
  return `
    <article class="week-ahead-signal-card signal-${escapeHtml(card.type)}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      ${card.detail ? `<p>${escapeHtml(card.detail)}</p>` : ""}
    </article>
  `;
}

function renderForecastCard(day) {
  return `
    <article class="forecast-board-card ${toneClassFor(day)}">
      <div class="forecast-card-top">
        <div>
          <div class="forecast-card-day">${escapeHtml(formatDay(day.date, day.index))}</div>
          <div class="forecast-card-date">${escapeHtml(formatCardDate(day.date))}</div>
        </div>
        <div class="forecast-condition">
          <span>${escapeHtml(day.icon)}</span>
          <strong>${escapeHtml(formatCategory(day.condition) || "Forecast")}</strong>
        </div>
      </div>

      <div class="forecast-card-temps">
        <div><span>High</span><strong>${escapeHtml(formatTemp(day.high))}</strong></div>
        <div><span>Low</span><strong>${escapeHtml(formatTemp(day.low))}</strong></div>
        <div><span>FeelScore</span><strong>${escapeHtml(formatScore(day.feelScore))}</strong></div>
      </div>

      <h3>${escapeHtml(day.headline || "Forecast update")}</h3>
      <p>${escapeHtml(shortNarrative(day.narrative))}</p>

      <div class="forecast-card-chips">
        ${renderInfoChip("Wind", day.source === "manual" ? formatWind(day.wind) : null)}
        ${renderInfoChip("Main Issue", day.mainIssue)}
        ${renderInfoChip("Best Window", day.bestWindow)}
        ${renderInfoChip("Confidence", day.confidence ? formatCategory(day.confidence) : null)}
      </div>

      ${renderTags(day.tags)}
      ${day.localNote ? `<div class="forecast-card-local"><span>Local note</span>${escapeHtml(day.localNote)}</div>` : ""}
    </article>
  `;
}

function renderBoardChip(label, value, type) {
  return `
    <span class="forecast-board-chip ${escapeHtml(type)}">
      <em>${escapeHtml(label)}</em>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function renderInfoChip(label, value) {
  if (!value) return "";
  return `
    <span class="forecast-info-chip">
      <em>${escapeHtml(label)}</em>
      <strong>${escapeHtml(value)}</strong>
    </span>
  `;
}

function renderTags(tags = []) {
  if (!tags.length) return "";
  return `
    <div class="forecast-card-tags">
      ${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
    </div>
  `;
}

function analyzeRain(hours) {
  if (!hours.length) return { type: "none", coverage: 0, peak: 0 };

  const buckets = { morning: [], midday: [], afternoon: [], evening: [] };

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
  if (coverage < 0.2) return { type: "none", coverage, peak: 0 };

  const dominant = counts.sort((a, b) => b.count - a.count)[0];
  return { type: dominant.key, coverage, peak: dominant.peak };
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
  if (!subset.length) return "no update";

  const avgCloud = average(subset.map(hour => numberOrNull(hour.cloudCover)).filter(Number.isFinite));
  const rainHits = subset.filter(hour => {
    const probability = normalizeProbability(hour.precipProbability);
    const amount = numberOrNull(hour.precipAmount) || 0;
    return amount > 0.01 || probability >= 45;
  }).length;
  const rainRatio = rainHits / subset.length;

  if (rainRatio > 0.4) return "showers likely";
  if (rainRatio > 0.15) return "spotty showers";
  if (avgCloud > 70 || (avgCloud > 0.7 && avgCloud <= 1)) return "mostly cloudy";
  if (avgCloud > 40 || (avgCloud > 0.4 && avgCloud <= 1)) return "partly cloudy";
  return "mostly sunny";
}

function computeComfortScore(hours) {
  if (!hours.length) return null;
  const scores = hours
    .map(hour => calculateComfort(hour)?.score)
    .filter(Number.isFinite)
    .map(score => score * 10);

  return scores.length ? Math.round(average(scores)) : null;
}

function summarizeWind(hours) {
  if (!hours.length) return null;
  const anchor = hours.find(hour => hour.localHour >= 11 && hour.localHour <= 15) || hours[Math.floor(hours.length / 2)];
  if (!anchor) return null;

  return {
    direction: directionFromDegrees(anchor.windDirection ?? anchor.windDir),
    speed: numberOrNull(anchor.windSpeed),
    gust: numberOrNull(anchor.windGust)
  };
}

function fallbackHeadline(rain, hours) {
  if (rain.coverage > 0.55) return "Wet periods likely";
  if (rain.coverage > 0.3) return "Showers possible at times";

  const cloud = average(hours.map(hour => numberOrNull(hour.cloudCover)).filter(Number.isFinite));
  if (cloud > 70 || (cloud > 0.7 && cloud <= 1)) return "Clouds hold through the day";
  if (cloud > 40 || (cloud > 0.4 && cloud <= 1)) return "A mix of sun and clouds";
  return "Mostly quiet weather";
}

function fallbackNarrativePublic(rain, timeline) {
  if (rain.type !== "none") return `Showers are most favored around ${rain.type}, with timing still subject to refinement.`;
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
  if (!wind || typeof wind !== "object") return null;
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
  if (day.stormRisk && day.stormRisk !== "none") return "⛈️";
  if (day.sky === "showery") return "🌦️";
  if (day.sky === "stormy") return "⛈️";
  if (day.sky === "overcast" || day.sky === "mostly_cloudy") return "☁️";
  if (day.sky === "partly_cloudy") return "⛅";
  return "☀️";
}

function pickFallbackIcon(hours, rain) {
  if (rain.coverage > 0.55) return "🌧️";
  if (rain.coverage > 0.3) return "🌦️";
  const cloud = average(hours.map(hour => numberOrNull(hour.cloudCover)).filter(Number.isFinite));
  if (cloud > 70 || (cloud > 0.7 && cloud <= 1)) return "☁️";
  if (cloud > 40 || (cloud > 0.4 && cloud <= 1)) return "⛅";
  return "☀️";
}

function conditionFromIcon(icon, rain) {
  if (rain.coverage > 0.55) return "Rain likely";
  if (rain.coverage > 0.3) return "Showery";
  if (icon.includes("☁")) return "Mostly cloudy";
  if (icon.includes("⛅")) return "Partly cloudy";
  return "Mostly sunny";
}

function normalizeConfidence(value) {
  if (value === "low" || value === "medium" || value === "high") return value;
  const n = Number(value);
  if (!Number.isFinite(n)) return "medium";
  if (n >= 0.75) return "high";
  if (n >= 0.5) return "medium";
  return "low";
}

function normalizeRisk(value) {
  return ["low", "medium", "high"].includes(value) ? value : "low";
}

function normalizeTrend(value) {
  return ["improving", "steady", "declining", "mixed"].includes(value) ? value : "steady";
}

function inferRainRisk(days) {
  const risky = days.filter(day => day.stormRisk && day.stormRisk !== "none" && day.stormRisk !== "possible").length;
  const possible = days.filter(day => day.stormRisk === "possible").length;
  if (risky >= 2) return "high";
  if (risky || possible) return "medium";
  return "low";
}

function inferComfortTrend(days) {
  const scores = days.map(day => numberOrNull(day.feelScore)).filter(Number.isFinite);
  if (scores.length < 2) return "steady";
  const delta = scores[scores.length - 1] - scores[0];
  if (delta >= 10) return "improving";
  if (delta <= -10) return "declining";
  return "steady";
}

function bestScoredDay(days) {
  return days.filter(day => numberOrNull(day.feelScore) != null).sort((a, b) => b.feelScore - a.feelScore)[0] || days[0];
}

function watchDay(days) {
  return days.find(day => day.stormRisk && day.stormRisk !== "none") || uncertainDay(days);
}

function uncertainDay(days) {
  return days.find(day => day.confidence === "low") || days.find(day => day.confidence === "medium") || days[days.length - 1];
}

function averageConfidence(days) {
  const map = { low: 45, medium: 70, high: 88 };
  const values = days.map(day => map[day.confidence]).filter(Number.isFinite);
  return values.length ? Math.round(average(values)) : null;
}

function labelForDay(day) {
  if (!day?.date) return "TBD";
  return day.date.toLocaleDateString([], { weekday: "long" });
}

function toneClassFor(day) {
  if (day.stormRisk && day.stormRisk !== "none") return "rain";
  if (day.sky === "overcast" || day.sky === "mostly_cloudy") return "cloudy";
  if (day.sky === "partly_cloudy") return "partly";
  if (day.icon.includes("🌧") || day.icon.includes("🌦") || day.icon.includes("⛈")) return "rain";
  if (day.icon.includes("☁")) return "cloudy";
  if (day.icon.includes("⛅")) return "partly";
  return "sunny";
}

function formatDay(date, index) {
  if (index === 0) return "Tomorrow";
  return date.toLocaleDateString([], { weekday: "long" });
}

function formatCardDate(date) {
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatTemp(value) {
  if (value === "--" || value == null) return "--";
  return `${Math.round(Number(value))}°`;
}

function formatScore(value) {
  const score = numberOrNull(value);
  return score == null ? "--" : String(Math.round(score));
}

function formatWind(wind) {
  if (!wind) return "";
  if (wind.calm) return "Calm";

  const direction = wind.direction === "variable" ? "Variable" : wind.direction;
  const speed = formatWindRange(wind.speedMin ?? wind.speed, wind.speedMax ?? wind.speed);
  const gust = wind.gustNA ? "" : wind.gust != null ? `, gusts ${Math.round(wind.gust)} mph` : "";

  return [direction, speed].filter(Boolean).join(" ") + gust;
}

function formatWindRange(min, max) {
  const low = numberOrNull(min);
  const high = numberOrNull(max);

  if (low != null && high != null && low !== high) return `${Math.round(low)}-${Math.round(high)} mph`;
  if (low != null || high != null) return `${Math.round(low ?? high)} mph`;
  return "";
}

function formatPercent(value) {
  const n = numberOrNull(value);
  return n == null ? "TBD" : `${Math.round(n)}%`;
}

function shortNarrative(text) {
  const value = String(text || "").trim();
  if (value.length <= 180) return value;
  return `${value.slice(0, 177).trim()}...`;
}

function formatCategory(value) {
  return String(value || "")
    .split("_")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function directionFromDegrees(degrees) {
  const value = numberOrNull(degrees);
  if (value == null) return null;
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(value / 45) % 8];
}

function normalizeProbability(value) {
  const n = numberOrNull(value);
  if (n == null) return 0;
  return n <= 1 ? n * 100 : n;
}

function numberOrNull(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTimeline(timeline) {
  return Boolean(timeline && Object.values(timeline).some(hasTimelineText));
}

function hasTimelineText(value) {
  return hasText(value) && value.trim().toLowerCase() !== "no update";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
