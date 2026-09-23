import { buildHumanActionIntelFS } from "/js/intel/human-action-feelscore.js";
import { calculateComfort } from "/js/intel/comfort.js";
import { isPulseFresh } from "/js/pulse-freshness.js";
import { drawRegionalMap, LABELS as MAP_LABELS } from "./regional-map.js";
import { CAMERAS, cameraCards, bindCameraFailures } from "./live-look.js";
import { forecastComfortCopy } from "/js/intel/forecast-comfort-context.js";
import { comfortTimeBuckets, bestComfortWindow } from "/js/intel/comfort-time-buckets.js";

const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };
const WMO = {
  0: ["Clear", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"], 3: ["Cloudy", "☁️"],
  45: ["Fog", "🌫️"], 48: ["Freezing fog", "🌫️"], 51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"], 61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"], 80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"], 82: ["Heavy showers", "🌧️"], 95: ["Thunderstorms", "⛈️"], 96: ["Storms with hail", "⛈️"], 99: ["Strong storms", "⛈️"]
};
const cache = new Map();
const previewStates = new URLSearchParams(location.search).get("preview") === "states";
const state = { weather: null, forecast: null, feelscore: null, pulse: null, article: null, hiking: null, sky: null, activeDay: "today", regionalLoaded: false };
let toastTimer = null;
let refreshTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const routeUrl = (route) => `/api/router?route=${route}`;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function stripHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value);
  return (template.content.textContent || "").replace(/\s+/g, " ").trim();
}

function sanitizePulseHtml(value = "") {
  const template = document.createElement("template");
  template.innerHTML = String(value);
  const allowed = new Set(["A", "B", "BR", "EM", "I", "LI", "OL", "P", "STRONG", "U", "UL"]);
  const clean = (node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE || !allowed.has(child.tagName)) {
        clean(child);
        child.replaceWith(...child.childNodes);
        continue;
      }
      const href = child.tagName === "A" ? child.getAttribute("href") : null;
      Array.from(child.attributes).forEach((attr) => child.removeAttribute(attr.name));
      if (child.tagName === "A" && href) {
        try {
          const url = new URL(href, location.origin);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported link");
          child.setAttribute("href", url.href);
          child.setAttribute("target", "_blank");
          child.setAttribute("rel", "noopener noreferrer");
        } catch { child.replaceWith(...child.childNodes); continue; }
      }
      clean(child);
    }
  };
  clean(template.content);
  return template.innerHTML;
}

async function fetchJson(url, { ttl = 0, force = false } = {}) {
  const saved = cache.get(url);
  if (!force && saved && Date.now() - saved.at < ttl) return saved.data;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const data = await response.json();
    cache.set(url, { at: Date.now(), data });
    return data;
  } finally { clearTimeout(timer); }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function formatTime(value, options = {}) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit", ...options }).format(new Date(value));
}

function formatDate(value, options = {}) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", ...options }).format(new Date(value));
}

function timeAgo(value) {
  const time = Number(value) || new Date(value).getTime();
  if (!Number.isFinite(time)) return "Updated recently";
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return formatDate(time, { year: "numeric" });
}

function fFromC(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 9 / 5 + 32) : null; }
function degrees(value) { return Number.isFinite(Number(value)) ? `${Math.round(Number(value))}°` : "--°"; }
function mphFromMs(value) { return Number.isFinite(Number(value)) ? Math.round(Number(value) * 2.23694) : null; }
function normalizePercent(value) { const n = Number(value); return Number.isFinite(n) ? (n <= 1 ? n : n / 100) : 0; }
function todayKey(value = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function closestHour(hourly = [], now = Date.now()) {
  return [...hourly].filter((h) => Number.isFinite(Number(h?.timestamp))).sort((a, b) => Math.abs(Number(a.timestamp) - now) - Math.abs(Number(b.timestamp) - now))[0] || null;
}

function upcomingHours(hourly = [], count = 6) {
  const now = Date.now() - 45 * 60 * 1000;
  return hourly.filter((hour) => Number(hour?.timestamp) >= now).slice(0, count);
}

function conditionFor(hour = {}) {
  const code = Number(hour.weatherCode ?? hour.weather_code);
  if (WMO[code]) return { label: WMO[code][0], icon: WMO[code][1] };
  const cloud = normalizePercent(hour.cloudCover ?? hour.cloud_cover);
  return cloud >= .8 ? { label: "Cloudy", icon: "☁️" } : cloud >= .35 ? { label: "Partly cloudy", icon: "⛅" } : { label: "Mostly clear", icon: "☀️" };
}

function comfortFor(hour) {
  const result = hour ? calculateComfort(hour) : null;
  return result && Number.isFinite(result.score) ? { ...result, score100: Math.round(result.score * 10) } : null;
}

function trendFor(hours = []) {
  const scored = hours.map((hour) => comfortFor(hour)?.score100).filter(Number.isFinite);
  if (scored.length < 2) return { label: "Steady", scores: scored };
  const delta = scored.at(-1) - scored[0];
  return { label: delta >= 7 ? "Improving" : delta <= -7 ? "Declining" : "Steady", scores: scored };
}

function bestWindow(hours = []) {
  const scored = hours.map((hour) => ({ hour, comfort: comfortFor(hour) })).filter((item) => item.comfort);
  if (!scored.length) return "Best window is updating.";
  const best = scored.sort((a, b) => b.comfort.score100 - a.comfort.score100)[0];
  return `Best upcoming comfort: ${formatTime(best.hour.timestamp)} · FEELSCORE ${best.comfort.score100}`;
}

function scoreLabel(score) {
  if (score >= 85) return "Very comfortable";
  if (score >= 70) return "Comfortable";
  if (score >= 55) return "Slightly uncomfortable";
  if (score >= 40) return "Uncomfortable";
  return "Harsh";
}

function renderTrend(target, hours = [], { anchorNow = true, label = "Next 18 hours" } = {}) {
  // Presentation only: every plotted score comes from the existing comfort engine.
  const points = hours.map(hour => ({ timestamp: Number(hour.timestamp), score: comfortFor(hour)?.score100 })).filter(p => Number.isFinite(p.timestamp) && Number.isFinite(p.score));
  const currentScoreSource = state.feelscore?.feelscore?.score;
  const currentScore = currentScoreSource == null ? NaN : Number(currentScoreSource);
  if (anchorNow && Number.isFinite(currentScore)) points.unshift({ timestamp: Date.now(), score: Math.round(currentScore) });
  target.hidden = points.length < 2;
  if (target.hidden) { target.innerHTML = ""; return; }
  const width = 360, left = 27, right = 16, top = 24, bottom = 150;
  const start = points[0].timestamp, span = points.at(-1).timestamp - start;
  const plotted = points.map(p => ({ ...p, x: left + (p.timestamp - start) / span * (width - left - right), y: top + (100 - Math.max(0, Math.min(100, p.score))) / 100 * (bottom - top) }));
  let path = `M ${plotted[0].x} ${plotted[0].y}`;
  plotted.slice(1).forEach((p, i) => { const previous = plotted[i], mid = (previous.x + p.x) / 2; path += ` C ${mid} ${previous.y}, ${mid} ${p.y}, ${p.x} ${p.y}`; });
  const best = plotted.reduce((a, b) => b.score > a.score ? b : a);
  const y = score => top + (100 - score) / 100 * (bottom - top);
  const summary = points.map(p => `${formatTime(p.timestamp)}: FEELSCORE ${p.score}`).join(". ");
  const labels = [0, Math.round((plotted.length - 1) / 3), Math.round((plotted.length - 1) * 2 / 3), plotted.length - 1];
  target.setAttribute("aria-label", `Comfort Curve. ${summary}`);
  target.innerHTML = `<span class="curve-heading"><strong>Comfort Curve</strong><span>${escapeHtml(label)}</span></span>
    <svg viewBox="0 0 360 181" role="img" aria-label="${escapeHtml(summary)}">
      <rect class="curve-band" x="${left}" y="${y(100)}" width="317" height="${y(70) - y(100)}" rx="5" />
      ${[100, 70, 40, 0].map(score => `<line class="curve-grid" x1="${left}" x2="344" y1="${y(score)}" y2="${y(score)}" /><text class="curve-axis" x="20" y="${y(score) + 4}" text-anchor="end">${score}</text>`).join("")}
      <path class="curve-area" d="${path} L ${plotted.at(-1).x} ${bottom} L ${left} ${bottom} Z" />
      <path class="curve-line" d="${path}" />
      <circle class="curve-now" cx="${plotted[0].x}" cy="${plotted[0].y}" r="4" />
      <text class="curve-score" x="${left}" y="${Math.max(15, plotted[0].y - 12)}" text-anchor="start">${anchorNow ? "Now · " : ""}${plotted[0].score}</text>
      <circle class="curve-best" cx="${best.x}" cy="${best.y}" r="5" />
      <text class="curve-score" x="${best.x}" y="${Math.max(15, best.y - 12)}" text-anchor="${best.x > 285 ? "end" : "middle"}">${best === plotted[0] ? "" : `★ ${best.score}`}</text>
      ${labels.map(i => `<text class="curve-time" x="${plotted[i].x}" y="173" text-anchor="${i === 0 ? "start" : i === plotted.length - 1 ? "end" : "middle"}">${escapeHtml(formatTime(plotted[i].timestamp).replace(":00", ""))}</text>`).join("")}
    </svg><span class="curve-caption">Higher = more comfortable outside</span>`;
}

function renderHours(target, hours = [], detailed = false) {
  const prepared = hours.map((hour) => ({ hour, comfort: comfortFor(hour), condition: conditionFor(hour) }));
  const best = prepared.filter((item) => item.comfort).sort((a, b) => b.comfort.score100 - a.comfort.score100)[0];
  target.innerHTML = prepared.length ? prepared.map((item) => `
    <article class="hour-card ${item === best ? "is-best" : ""}">
      <time>${escapeHtml(formatTime(item.hour.timestamp, { minute: undefined }))}</time>
      <span class="hour-icon" aria-hidden="true">${item.condition.icon}</span>
      <strong class="hour-temp">${degrees(item.hour.temperatureF)}</strong>
      <span class="hour-score">${item.comfort ? `FS ${item.comfort.score100}` : "FS --"}</span>
      ${detailed ? `<small>${Math.round(normalizePercent(item.hour.precipProbability) * 100)}% rain</small>` : ""}
    </article>`).join("") : `<div class="empty-state">Hourly comfort data is temporarily unavailable.</div>`;
}

function renderCurrent() {
  const weather = state.weather || {};
  const current = weather.current || weather.current_conditions || {};
  const hour = closestHour(weather.hourly || []);
  const condition = conditionFor(hour || current);
  const temperature = fFromC(current.air_temperature) ?? Math.round(Number(hour?.temperatureF));
  const feels = fFromC(current.feels_like) ?? temperature;
  const dew = fFromC(current.dew_point) ?? Math.round(Number(hour?.dewpointF));
  const wind = mphFromMs(current.wind_avg) ?? Math.round(Number(hour?.windSpeed));
  const gust = mphFromMs(current.wind_gust) ?? Math.round(Number(hour?.windGust));
  $("#currentTemp").textContent = degrees(temperature);
  $("#currentFeels").textContent = degrees(feels);
  $("#currentDew").textContent = degrees(dew);
  $("#currentWind").textContent = Number.isFinite(wind) ? `${wind} mph` : "--";
  $("#currentGust").textContent = Number.isFinite(gust) ? `${gust} mph` : "--";
  // Tempest's sea-level pressure is in hPa (equivalent to millibars).
  // Do not substitute unadjusted station pressure at Asheville's elevation.
  const pressureSource = current.sea_level_pressure ?? current.pressure;
  const pressureMb = pressureSource == null || pressureSource === "" ? NaN : Number(pressureSource);
  $("#currentPressure").firstChild.textContent = Number.isFinite(pressureMb) ? `${(pressureMb / 33.86389).toFixed(2)} inHg` : "--";
  $("#currentPressureMb").textContent = Number.isFinite(pressureMb) ? `${pressureMb.toFixed(1)} mb` : "-- mb";
  $("#currentCondition").textContent = condition.label;
  $("#currentIcon").textContent = condition.icon;
  $("#currentObserved").textContent = current.timestamp ? `Observed ${timeAgo(current.timestamp)}` : "Latest Asheville observation";
  $("#currentCard").classList.remove("loading");
}

function renderTemperatureComparison(data) {
  const ready = data?.available && Number.isFinite(data.differenceF) && Number.isFinite(data.yesterday?.temperatureF);
  const difference = ready ? Math.round(Math.abs(data.differenceF)) : null;
  const comparison = $("#currentComparison");
  comparison.hidden = !ready;
  comparison.textContent = !ready ? "" : difference === 0
    ? "It's currently about the same temperature as this time yesterday."
    : `It's currently ${difference}° ${data.differenceF > 0 ? "warmer" : "cooler"} compared to this time yesterday.`;
  comparison.title = ready ? `Same station observations: ${formatTime(data.current.timestamp)} today vs. ${formatTime(data.yesterday.timestamp)} yesterday` : "";
}

function renderFeelScore() {
  const weather = state.weather || {};
  state.feelscore = buildHumanActionIntelFS({ ...weather, current: weather.current, tempest: weather.current, hourly: weather.hourly || [] });
  const primary = state.feelscore?.feelscore;
  const copy = forecastComfortCopy({ item: primary, forecast: state.forecast || {}, hourly: weather.hourly || [] });
  const hours = upcomingHours(weather.hourly || []);
  const trend = trendFor(hours);
  const score = Math.round(Number(primary?.score));
  $("#homeScore").textContent = Number.isFinite(score) ? score : "--";
  $("#homeScoreLabel").textContent = copy.headline;
  $("#homeScoreNarrative").textContent = copy.weatherNarrative || "Hourly comfort guidance is updating.";
  $("#homeScoreEmoji").textContent = copy.emoji;
  const curveHours = (weather.hourly || []).filter(hour => Number(hour.timestamp) > Date.now()).slice(0, 18);
  $("#homeBestWindow").textContent = bestWindow(curveHours);
  renderTrend($("#homeTrend"), curveHours);
  $("#homeFeelScore").classList.remove("loading");
  renderHours($("#nextSix"), hours);
  $("#nextSixTrend").textContent = trend.label;
  renderFeelScoreDetail();
}

function renderFeelScoreDetail() {
  const item = state.activeDay === "tomorrow" ? state.feelscore?.tomorrow : state.feelscore?.feelscore;
  const copy = forecastComfortCopy({ item, forecast: state.forecast || {}, hourly: state.weather?.hourly || [], tomorrow: state.activeDay === "tomorrow" });
  $("#detailEmoji").textContent = copy.emoji;
  $("#detailLabel").textContent = copy.headline;
  $("#detailNarrative").textContent = copy.weatherNarrative || "Hourly comfort guidance is updating.";
  const tomorrowDate = new Date(`${todayKey()}T12:00:00Z`);
  tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
  const tomorrowKey = tomorrowDate.toISOString().slice(0, 10);
  const selectedKey = state.activeDay === "tomorrow" ? tomorrowKey : todayKey();
  const buckets = comfortTimeBuckets(state.weather?.hourly || [], selectedKey);
  const best = bestComfortWindow(buckets);
  $("#detailBestWindow").textContent = best ? `Best Window · ${formatTime(best.start)}–${formatTime(best.end)} · FEELSCORE ${best.min === best.max ? best.min : `${best.min}–${best.max}`}${best.min < 70 ? " · best available, but comfort is limited" : ""}` : "Best Window unavailable · not enough continuous hourly guidance.";
  const active = buckets.filter(b=>!b.passed), passed = buckets.filter(b=>b.passed);
  const cards = active.map(bucket => `<section class="comfort-bucket${best?.name === bucket.name ? " is-best" : ""}"><strong>${bucket.name}${best?.name === bucket.name ? " ★" : ""}</strong><small>${bucket.label}${bucket.partial && bucket.min != null ? " · remaining hours" : ""}</small><span class="bucket-score">${bucket.min == null ? bucket.partial ? "Almost over" : "Unavailable" : bucket.min === bucket.max ? bucket.min : `${bucket.min}–${bucket.max}`}</span><small>${bucket.min != null ? "FEELSCORE /100" : bucket.partial ? "No full hourly reading remains in this window." : "Hourly guidance missing"}</small>${bucket.tempMin != null ? `<small>${bucket.tempMin}–${bucket.tempMax}°F</small>` : ""}${bucket.min != null ? `<p>${escapeHtml(bucket.takeaway)}</p><small>${bucket.count} hourly readings${bucket.count < bucket.end-bucket.start && !bucket.partial ? " · limited coverage" : ""}</small>` : ""}</section>`).join("");
  $("#detailBuckets").innerHTML = cards || `<p>No remaining time windows today.</p>`;
  $("#detailPassed").hidden = !passed.length;
  $("#detailPassedContent").textContent = passed.map(b=>`${b.name} · ${b.label} · passed`).join(" / ");
}

function extractForecastUpdate(forecast = {}) {
  const candidates = [forecast.forecastUpdate, forecast.whatsChanged, forecast.update, forecast.change];
  const found = candidates.find((item) => item && typeof item === "object" && item.active !== false && (item.title || item.headline));
  if (!found) return null;
  const expires = found.expiresAt ? new Date(found.expiresAt).getTime() : null;
  if (Number.isFinite(expires) && expires <= Date.now()) return null;
  return { title: found.title || found.headline, message: found.message || found.summary || found.description || "", updatedAt: found.updatedAt || found.publishedAt || forecast.lastUpdated };
}

function renderPriorityCard(target, kind, item) {
  if (!item) { target.hidden = true; target.innerHTML = ""; return; }
  target.innerHTML = `<div class="priority-label">${kind === "alert" ? "828 Weather Alert" : "Forecast Update"}</div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.message || "")}</p>${kind === "alert" ? `<div class="alert-disclaimer">828 Weather Direct meteorologist information · Not an official NWS warning</div>` : ""}<small>Updated ${escapeHtml(formatTime(item.updatedAt || item.publishedAt || item.timestamp))}</small>`;
  target.hidden = false;
}

function renderAlerts(alertsPayload) {
  let alert = Array.isArray(alertsPayload?.alerts) ? alertsPayload.alerts.find((item) => !item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()) : null;
  if (previewStates) alert = { title: "Strong storm approaching Asheville", message: "Torrential rain, frequent lightning and gusty winds are moving toward the city from the west.", publishedAt: Date.now() - 12 * 60 * 1000 };
  renderPriorityCard($("#homeAlert"), "alert", alert);
}

function renderForecastUpdate() {
  let update = extractForecastUpdate(state.forecast);
  if (previewStates) update = { title: "Rain timing has shifted earlier", message: "New guidance brings widespread rain into Asheville closer to 2 PM instead of late afternoon.", updatedAt: Date.now() - 22 * 60 * 1000 };
  renderPriorityCard($("#homeForecastUpdate"), "update", update);
  renderPriorityCard($("#forecastUpdate"), "update", update);
}

function manualDays(forecast = {}) {
  return Object.entries(forecast.days || {}).map(([key, value]) => ({ key, ...value })).filter((day) => day.key >= todayKey()).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 4);
}

function automatedDays(weather = {}) {
  return (weather.daily || []).filter((day) => todayKey(day.timestamp) >= todayKey()).slice(0, 4).map((day) => {
    const hours = (weather.hourly || []).filter((hour) => todayKey(hour.timestamp) === todayKey(day.timestamp));
    const representative = hours.find((hour) => new Date(hour.timestamp).getHours() >= 14) || hours[0] || {};
    const condition = conditionFor(representative);
    return { key: todayKey(day.timestamp), headline: condition.label, narrative: "Automated weather guidance is filling in until Tim's latest authored forecast is available.", high: day.tempMax, low: day.tempMin, rainChance: Math.round(normalizePercent(day.precipProbability) * 100), icon: condition.icon, source: "automated" };
  });
}

function forecastDays() {
  const manual = manualDays(state.forecast);
  if (manual.length >= 4) return manual;
  const keyed = new Map(manual.map((day) => [day.key, day]));
  automatedDays(state.weather).forEach((day) => { if (!keyed.has(day.key)) keyed.set(day.key, day); });
  return [...keyed.values()].sort((a, b) => a.key.localeCompare(b.key)).slice(0, 4);
}

function forecastIcon(day) {
  if (day.icon) return day.icon;
  const sky = String(day.sky || "");
  if (day.stormRisk && day.stormRisk !== "none") return "⛈️";
  if (sky.includes("show") || sky.includes("rain")) return "🌦️";
  if (sky.includes("cloud") || sky === "overcast") return "☁️";
  return "☀️";
}

function renderForecast() {
  const forecast = state.forecast || {};
  const days = forecastDays();
  $("#forecastHeadline").textContent = forecast.boardHeadline || days[0]?.headline || "Latest Asheville outlook";
  $("#forecastSummary").textContent = forecast.boardSummary || days[0]?.narrative || "The next authored forecast is being prepared.";
  const signals = forecast.weekAheadSignals?.cards || [];
  $("#forecastSignals").innerHTML = signals.slice(0, 3).map((signal) => `<span>${escapeHtml(signal.label)} · ${escapeHtml(signal.value)}</span>`).join("");
  $("#forecastDays").innerHTML = days.length ? days.map((day) => {
    const date = new Date(`${day.key}T12:00:00`);
    const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
    const rain = Number(day.rainChance ?? day.precipProbability);
    const rainPercent = Number.isFinite(rain) ? Math.round(normalizePercent(rain) * 100) : null;
    const meta = [Number.isFinite(rainPercent) ? `${rainPercent}% rain` : null, day.bestWindow ? `Best: ${day.bestWindow}` : null, day.confidence ? `${String(day.confidence).replace(/^./, (c) => c.toUpperCase())} confidence` : null].filter(Boolean);
    return `<article class="panel forecast-day"><header class="forecast-day-head"><div><p>${escapeHtml(formatDate(date))}</p><h2>${escapeHtml(dayLabel)} ${forecastIcon(day)}</h2></div><div class="forecast-day-temp"><strong>${degrees(day.high)}</strong><small>${degrees(day.low)}</small></div></header><div class="forecast-day-body"><h3>${escapeHtml(day.headline || "Forecast")}</h3><p>${escapeHtml(day.narrative || "Tim's practical forecast read is updating.")}</p>${meta.length ? `<div class="forecast-meta">${meta.map((m) => `<span>${escapeHtml(m)}</span>`).join("")}</div>` : ""}</div></article>`;
  }).join("") : `<div class="empty-state">The four-day forecast is temporarily unavailable.</div>`;
  $("#homeForecastDays").innerHTML = days.length ? days.map((day) => `<article class="forecast-mini"><span>${escapeHtml(new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${day.key}T12:00:00`)))}</span><span class="forecast-icon" aria-hidden="true">${forecastIcon(day)}</span><strong>${degrees(day.high)} / ${degrees(day.low)}</strong><small>${escapeHtml(day.headline || "Forecast")}</small></article>`).join("") : `<div class="empty-state">Forecast updating.</div>`;
  renderForecastUpdate();
}

function renderPulse() {
  const payload = state.pulse || {};
  const items = Array.isArray(payload.items) ? payload.items : payload.fallback ? [] : [payload, ...(payload.recent || [])];
  const latest = items[0];
  if (latest && isPulseFresh(latest.editedAt || latest.timestamp)) {
    $("#homePulseTime").textContent = `${formatTime(latest.editedAt || latest.timestamp)} · ${timeAgo(latest.editedAt || latest.timestamp)}`;
    $("#homePulseTitle").textContent = latest.title || "Quick update";
    $("#homePulseText").textContent = stripHtml(latest.text || "").slice(0, 220);
    const thumbnail = $("#homePulseThumbnail");
    const media = latest.mediaUrl || latest.image || "";
    if (media) {
      const isVideo = latest.mediaType === "video" || /\.(mp4|mov)(\?|$)/i.test(media) || media.includes("/video/");
      const marker = isVideo ? "/video/upload/" : "/image/upload/";
      const transform = isVideo ? "so_0,c_fill,w_320,h_200,q_auto,f_jpg" : "c_fill,w_320,h_200,q_auto,f_auto";
      thumbnail.src = media.includes(marker) ? media.replace(marker, `${marker}${transform}/`) : media;
      thumbnail.alt = `Thumbnail for latest 828 Pulse update: ${latest.title || "Quick update"}`;
      thumbnail.hidden = false;
    } else {
      thumbnail.removeAttribute("src");
      thumbnail.alt = "";
      thumbnail.hidden = true;
    }
    $("#homePulse").hidden = false;
  } else { $("#homePulse").hidden = true; }
  $("#pulseFeed").innerHTML = items.length ? items.map((item) => {
    const media = item.mediaUrl || "";
    const isVideo = item.mediaType === "video" || /\.(mp4|mov)(\?|$)/i.test(media) || media.includes("/video/");
    const mediaHtml = media ? isVideo ? `<video class="pulse-item-media" src="${escapeHtml(media)}" controls muted playsinline preload="metadata"></video>` : `<img class="pulse-item-media" src="${escapeHtml(media)}" alt="" loading="lazy" />` : "";
    return `<article class="panel pulse-item">${mediaHtml}<div class="pulse-item-body"><div class="pulse-item-meta"><span class="pulse-beacon"></span>${escapeHtml(formatTime(item.editedAt || item.timestamp))} · ${escapeHtml(timeAgo(item.editedAt || item.timestamp))}</div><h2>${escapeHtml(item.title || "Quick update")}</h2><div>${sanitizePulseHtml(item.text || "")}</div></div></article>`;
  }).join("") : `<div class="empty-state">No Pulse entries are available yet.</div>`;
}

function articleExcerpt(value) { const text = stripHtml(value); return text.length > 190 ? `${text.slice(0, 187).trim()}…` : text; }
function renderArticle() {
  const article = state.article;
  if (!article?.link || article.fallback) { $("#homeArticle").hidden = true; return; }
  const ageHours = (Date.now() - new Date(article.pubDate).getTime()) / 3600000;
  $("#homeArticleKicker").textContent = ageHours >= 0 && ageHours <= 48 ? "New 828 Weather Update" : "Latest Outlook";
  $("#homeArticleTitle").textContent = article.title;
  $("#homeArticleDescription").textContent = articleExcerpt(article.description);
  $("#homeArticleDate").textContent = `${formatDate(article.pubDate, { year: "numeric" })} · Read on Substack →`;
  $("#homeArticle").href = article.link;
  $("#homeArticleImage").src = article.ogImage || "/images/828-brand-card.png";
  $("#homeArticleImage").alt = `${article.title} cover art`;
  $("#homeArticle").hidden = false;
}

function elevationRecommendation(g = {}) {
  if (g.lightning?.active) return "Avoid exposed terrain";
  if (Number(g.maxGust) >= 25 || g.fogRisk === "Elevated") return "Lower to mid elevations favored";
  if (Number(g.hikerScore) >= 70) return "Most elevations look workable";
  return "Lower elevations are the safer bet";
}

function renderHiking() {
  const g = state.hiking?.guidance || {};
  const publishedAge = Date.now() - Date.parse(state.hiking?.generatedAt);
  if (!Number.isFinite(publishedAge) || publishedAge > 90 * 60000 || publishedAge < -5 * 60000) {
    $("#homeHikingLabel").textContent = "Check the mountain views";
    $("#homeHikingMeta").textContent = "Trail report needs an update";
    return;
  }
  $("#homeHikingLabel").textContent = g.hikerScoreLabel || g.overall || "Trail read";
  $("#homeHikingMeta").textContent = Number.isFinite(Number(g.hikerScore)) ? `HikerScore ${Math.round(Number(g.hikerScore))}` : "Open HikerScore";
}

function sunsetInfo() {
  const today = (state.weather?.daily || []).find((day) => todayKey(day.timestamp) === todayKey());
  const sunset = Number(today?.sunset);
  return { sunset, start: sunset ? sunset - 35 * 60000 : null, end: sunset ? sunset + 15 * 60000 : null };
}

function renderSunsetContext() {
  const { sunset } = sunsetInfo();
  $("#homeSunsetLabel").textContent = sunset ? `Sunset ${formatTime(sunset)}` : "Sky context";
  $("#homeSunsetMeta").textContent = state.sky?.trend?.overallTrend && state.sky.trend.overallTrend !== "unknown" ? String(state.sky.trend.overallTrend).replaceAll("_", " ") : "Open tonight's read";
}

async function loadHiking(force = false) {
  if (state.hiking && !force) return state.hiking;
  state.hiking = await fetchJson("/data/hiking-guidance.json", { ttl: 15 * 60 * 1000, force });
  renderHiking();
  return state.hiking;
}

async function loadSky(force = false) {
  state.sky = await fetchJson(routeUrl("sky/current"), { ttl: 3 * 60 * 1000, force });
  renderSunsetContext();
  return state.sky;
}

async function renderMoreView(view) {
  $("#moreMenu").hidden = true;
  $(".future-products").hidden = true;
  $("#moreDetail").hidden = false;
  const target = $("#moreDetailContent");
  target.innerHTML = `<div class="empty-state">Loading ${escapeHtml(view)}…</div>`;
  try {
    if (view === "hiking") {
      const payload = await loadHiking();
      const g = payload.guidance || {};
      target.innerHTML = `<section class="panel more-hero"><p class="kicker">HikerScore</p><h2>${Number.isFinite(Number(g.hikerScore)) ? Math.round(Number(g.hikerScore)) : "--"} · ${escapeHtml(g.hikerScoreLabel || g.overall || "Trail guidance")}</h2><p>${escapeHtml(g.bestWindow || g.hikerNarrative || "Mountain conditions are updating.")}</p></section><section class="panel"><p class="kicker">Recommended elevation</p><h2>${escapeHtml(elevationRecommendation(g))}</h2><div class="more-stats"><div><span>Peak gust</span><strong>${Number.isFinite(Number(g.maxGust)) ? `${Math.round(Number(g.maxGust))} mph` : "--"}</strong></div><div><span>Mitchell difference</span><strong>${Number.isFinite(Number(g.mitchellDrop)) ? `${Math.round(Number(g.mitchellDrop))}° cooler` : "--"}</strong></div><div><span>Cloud / visibility</span><strong>${escapeHtml(g.fogRisk || "--")}</strong></div><div><span>Asheville spread</span><strong>${Number.isFinite(Number(g.localTempSpread)) ? `${Math.round(Number(g.localTempSpread))}°` : "--"}</strong></div></div><a class="product-link" href="/hiking.html">Open full Hiking Guidance →</a></section>`;
      const age = Date.now() - Date.parse(payload.generatedAt);
      const stale = !Number.isFinite(age) || age > 90 * 60000 || age < -5 * 60000;
      target.insertAdjacentHTML("afterbegin", `<section class="panel product-status"><p class="kicker">Hiking Guide · 828 analysis</p><p>${stale ? "These are last-published conditions, not a current trail report. Check the mountain cameras before heading out." : "Published observations and the existing HikerScore engine—not a separate mobile forecast."}</p><small>${payload.generatedAt ? `Published ${escapeHtml(formatDate(payload.generatedAt))} · ${escapeHtml(formatTime(payload.generatedAt))}` : "Publication time unavailable"}</small></section>`);
      if (stale) target.querySelector(".more-hero .kicker").textContent = "Last published HikerScore";
      const stations = (payload.stations || []).filter(s => Number.isFinite(s.temperatureF)).sort((a,b) => (b.elevationFt || 0) - (a.elevationFt || 0)).slice(0, 4);
      target.insertAdjacentHTML("beforeend", `<section class="panel"><p class="kicker">${stale ? "Last published" : "Reporting"} mountain conditions</p><div class="trail-stations">${stations.map(s => `<div><strong>${escapeHtml(s.name)}</strong><small>${Number.isFinite(s.elevationFt) ? `${Math.round(s.elevationFt).toLocaleString()} ft` : "Elevation unavailable"} · ${escapeHtml(s.conditions || "Sky unavailable")}</small><span>${Math.round(s.temperatureF)}°F · ${Number.isFinite(s.windMph) ? `${Math.round(s.windMph)} mph wind` : "Wind unavailable"}</span></div>`).join("")}</div><p class="body-copy">Station readings describe reporting locations, not every trail or exposed ridge.</p></section><h2 class="camera-section-title">Check the mountain views</h2>${cameraCards(CAMERAS.filter(c => c.mountain))}`);
    } else if (view === "sunset") {
      const sky = await loadSky();
      const timing = sunsetInfo();
      const metrics = sky.metrics || {};
      const image = "https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg";
      target.innerHTML = `<section class="panel more-hero"><p class="kicker">Sunset Radiance</p><h2>${timing.sunset ? `Sunset ${escapeHtml(formatTime(timing.sunset))}` : "Tonight's sky read"}</h2><p>The authoritative Radiance score remains in the existing shared Sunset product while its inline algorithm is prepared for extraction.</p></section><section class="panel"><img class="camera-image" src="${image}?t=${Date.now()}" alt="Live western sky camera view near Asheville" /><div class="more-stats"><div><span>Best viewing window</span><strong>${timing.start ? `${formatTime(timing.start)}–${formatTime(timing.end)}` : "Updating"}</strong></div><div><span>Cloud trend</span><strong>${escapeHtml(String(sky.trend?.overallTrend || "Unknown").replaceAll("_", " "))}</strong></div><div><span>Western cloud read</span><strong>${Number.isFinite(Number(metrics.cloudCoverWest)) ? `${Math.round(Number(metrics.cloudCoverWest))}%` : "Unavailable"}</strong></div><div><span>Sky capture</span><strong>${escapeHtml(sky.captureStatus || "Updating")}</strong></div></div><a class="product-link" href="/828-sunset-radiance.html">Open full Radiance score →</a></section>`;
      target.querySelector(".more-hero p:last-child").textContent = "Keep an eye on the western horizon. The full Sunset Radiance read brings together cloud texture, clearing, moisture and timing.";
      const cameraImage = target.querySelector(".camera-image");
      cameraImage.remove();
      target.insertAdjacentHTML("beforeend", `<section class="panel product-status"><p class="kicker">828 Weather Direct sky analysis</p><p>${escapeHtml(sky.directionalComparison?.narrative || "The camera read is a snapshot, not a guarantee of sunset color.")}</p><small>Sky analysis ${escapeHtml(formatTime(sky.timestamp))}. Viewing window is a planning guide; color may be brief.</small></section>${cameraCards(CAMERAS.filter(c => c.id === "west"))}`);
      const skyAge = Date.now() - Date.parse(sky.timestamp);
      if (!Number.isFinite(skyAge) || skyAge > 10 * 60000 || sky.captureStatus !== "live") {
        target.querySelector(".more-hero p:last-child").textContent = "The current sky analysis is unavailable or out of date. Check the camera source and the full Radiance read before making plans.";
        target.querySelectorAll(".more-stats strong").forEach((value, index) => { if (index > 0) value.textContent = "Unavailable"; });
      }
    } else if (view === "live") {
      target.innerHTML = `<section class="panel more-hero"><p class="kicker"><span class="pulse-beacon" aria-hidden="true"></span> Live Look</p><h2>See what the sky is doing.</h2><p>Three perspectives on the Asheville sky.</p></section><section class="panel product-status"><p>Tap a view to open its camera source. The Chamber live player loads on request. Image capture times are not verified; a loaded preview may still be old.</p></section>${cameraCards()}`;
    } else {
      const article = state.article;
      target.innerHTML = article?.link ? `<a class="panel editorial-card" href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(article.ogImage || "/images/828-brand-card.png")}" alt="${escapeHtml(article.title || "828 Weather Update")} cover art" /><span class="editorial-body"><span class="kicker">Latest 828 Weather Update</span><strong class="panel-title">${escapeHtml(article.title || "828 Weather Update")}</strong><span class="body-copy">${escapeHtml(articleExcerpt(article.description))}</span><span class="editorial-meta">${escapeHtml(formatDate(article.pubDate, { year: "numeric" }))} · Read on Substack →</span></span></a>` : `<div class="empty-state">The latest 828 Weather Update is temporarily unavailable. <a href="https://timothyballisty.substack.com" target="_blank" rel="noopener noreferrer">Open the publication</a>.</div>`;
    }
    bindCameraFailures(target);
  } catch (error) {
    console.warn(`${view} detail unavailable`, error);
    target.innerHTML = `<div class="empty-state error-note">This product is temporarily unavailable. Please try again shortly.</div>`;
  }
}

async function loadRegional() {
  const selectedDay = state.activeDay;
  const date = new Date(`${todayKey()}T12:00:00Z`);
  if (selectedDay === "tomorrow") date.setUTCDate(date.getUTCDate() + 1);
  const key = date.toISOString().slice(0, 10);
  $("#regionalSummary").textContent = "Loading published regional forecast…";
  $("#regionalCanvas").hidden = true;
  $("#regionalDay").textContent = `${selectedDay === "tomorrow" ? "Tomorrow" : "Today"} · noon–3 PM`;
  try {
    const data = await fetchJson(routeUrl(`mobile/feelscore-map&date=${key}`), { ttl: 5 * 60 * 1000 });
    if (state.activeDay !== selectedDay || data.forecastDate !== key) return;
    drawRegionalMap($("#regionalCanvas"), data);
    const asheville = data.points.reduce((best, p) => !best || (p.lat - ASHEVILLE.lat) ** 2 + (p.lon - ASHEVILLE.lon) ** 2 < (best.lat - ASHEVILLE.lat) ** 2 + (best.lon - ASHEVILLE.lon) ** 2 ? p : best, null);
    $("#regionalSummary").textContent = `Near Asheville: ${MAP_LABELS[asheville.finalCategory] || "Unshaded"}. Updated ${formatTime(data.generatedAt)} · ${formatDate(data.forecastDate + "T12:00:00Z")}.`;
  } catch {
    if (state.activeDay === selectedDay) $("#regionalSummary").textContent = selectedDay === "tomorrow" ? "Tomorrow's published map is not available yet. Check back after the next regional update." : "The published map is temporarily unavailable. Try again or open the full Southeast map.";
  }
}

function navigate(destination, { updateHash = true } = {}) {
  if (!$("#screen-" + destination)) destination = "home";
  $$(".screen").forEach((screen) => { const active = screen.dataset.screen === destination; screen.hidden = !active; screen.classList.toggle("is-active", active); });
  $$("[data-destination]", $(".bottom-nav")).forEach((button) => { const active = button.dataset.destination === destination; button.classList.toggle("is-active", active); if (active) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current"); });
  if (updateHash) history.replaceState(null, "", `#${destination}`);
  window.scrollTo({ top: 0, behavior: "instant" });
  if (destination === "feelscore") loadRegional().catch((error) => console.warn("Regional FEELSCORE unavailable", error));
  if (destination === "live") {
    const target = $("#liveLookContent");
    target.innerHTML = `<section class="panel more-hero"><h2>See what the sky is doing.</h2><p>Three perspectives on the Asheville sky.</p></section>${cameraCards()}`;
    bindCameraFailures(target);
  }
  $("#mainContent").focus({ preventScroll: true });
}

async function loadCore({ force = false, announce = false } = {}) {
  // Independent loading keeps historical lookup from delaying the dashboard.
  fetchJson(routeUrl("tempest/temperature-comparison"), { ttl: 5 * 60 * 1000, force })
    .then(renderTemperatureComparison).catch(() => renderTemperatureComparison(null));
  const refreshButton = $("#refreshButton");
  refreshButton.classList.add("is-spinning");
  $("#headerStatus").textContent = "Updating";
  const requests = [
    fetchJson(routeUrl(`weather&type=hourly&lat=${ASHEVILLE.lat}&lon=${ASHEVILLE.lon}`), { ttl: 3 * 60 * 1000, force }),
    fetchJson(routeUrl("alerts/latest"), { ttl: 60 * 1000, force }),
    fetchJson(routeUrl("forecast/latest"), { ttl: 60 * 1000, force }),
    fetchJson(routeUrl("tidbits/pulse-feed"), { ttl: 60 * 1000, force }),
    fetchJson(routeUrl("substack-articles"), { ttl: 30 * 60 * 1000, force })
  ];
  const [weather, alerts, forecast, pulse, article] = await Promise.allSettled(requests);
  if (weather.status === "fulfilled") { state.weather = weather.value; renderCurrent(); renderFeelScore(); renderSunsetContext(); } else console.warn("Weather unavailable", weather.reason);
  if (alerts.status === "fulfilled") renderAlerts(alerts.value); else renderAlerts({ alerts: [] });
  if (forecast.status === "fulfilled") state.forecast = forecast.value;
  renderForecast();
  renderFeelScore();
  if (pulse.status === "fulfilled") state.pulse = pulse.value;
  renderPulse();
  if (article.status === "fulfilled") state.article = article.value;
  renderArticle();
  loadHiking(force).catch((error) => console.warn("Hiking summary unavailable", error));
  refreshButton.classList.remove("is-spinning");
  $("#headerStatus").textContent = weather.status === "fulfilled" ? `Updated ${formatTime(Date.now())}` : "Some data unavailable";
  if (announce) showToast(weather.status === "fulfilled" ? "828 weather data refreshed." : "Some weather data could not refresh.");
}

function bindEvents() {
  $$('[data-destination]').forEach((control) => control.addEventListener("click", (event) => { if (control.tagName === "A") event.preventDefault(); navigate(control.dataset.destination); }));
  $$('[data-more-view]').forEach((control) => control.addEventListener("click", () => { navigate("more"); renderMoreView(control.dataset.moreView); }));
  $("#moreBack").addEventListener("click", () => { $("#moreDetail").hidden = true; $("#moreMenu").hidden = false; $(".future-products").hidden = false; });
  $("#refreshButton").addEventListener("click", () => loadCore({ force: true, announce: true }));
  $$('[data-feelscore-day]').forEach((button) => button.addEventListener("click", () => {
    state.activeDay = button.dataset.feelscoreDay;
    loadRegional();
    $$('[data-feelscore-day]').forEach((item) => { const active = item === button; item.classList.toggle("is-active", active); item.setAttribute("aria-pressed", String(active)); });
    renderFeelScoreDetail();
  }));
  window.addEventListener("hashchange", () => navigate(location.hash.slice(1), { updateHash: false }));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") loadCore(); });
}

async function init() {
  $("#todayLabel").textContent = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(new Date());
  if (previewStates) $("#previewBanner").hidden = false;
  bindEvents();
  navigate(location.hash.slice(1) || "home", { updateHash: false });
  await loadCore();
  clearInterval(refreshTimer);
  const previewInterval = ["127.0.0.1", "localhost"].includes(location.hostname) ? 2 * 60 * 1000 : 60 * 1000;
  refreshTimer = setInterval(() => { if (document.visibilityState === "visible") loadCore(); }, previewInterval);
}

init().catch((error) => {
  console.error("Mobile prototype failed to initialize", error);
  $("#headerStatus").textContent = "Unable to update";
  showToast("The prototype could not finish loading. Try refreshing.");
});
