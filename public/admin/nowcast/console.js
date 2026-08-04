const $ = selector => document.querySelector(selector);
const SESSION_KEY = "828_nowcast_manual_session_v1";
const AUTO_FETCH_MS = 120_000;
const state = { data: null, activeDraft: null, scenario: "quiet", loading: false, session: null };

const sourceLabels = {
  tempest: "Tempest",
  nwsPointForecast: "NWS point forecast",
  nwsHourlyForecast: "NWS hourly forecast",
  nwsAlerts: "NWS alerts",
  observationStorage: "Observation storage",
  draftStorage: "Draft storage"
};

document.addEventListener("DOMContentLoaded", () => {
  state.session = restoreSession();
  bindEvents();
  renderSessionControls();
  if (state.session.active) refresh(true);
  else renderIdle();
  window.setInterval(sessionTick, 30_000);
});

function bindEvents() {
  $("#refreshButton").addEventListener("click", () => refresh(true));
  $("#startSession").addEventListener("click", startSession);
  $("#fetchNow").addEventListener("click", () => refresh(true));
  $("#endSession").addEventListener("click", endSession);
  $("#scenarioSelect").addEventListener("change", event => { state.scenario = event.target.value; if (state.session.active) refresh(true); });
  $("#generateDraft").addEventListener("click", () => draftAction("generate"));
  $("#regenerateDraft").addEventListener("click", () => draftAction("regenerate"));
  $("#saveDraft").addEventListener("click", () => draftAction("edit", { id: state.activeDraft?.id, text: $("#draftEditor").value }));
  $("#approveDraft").addEventListener("click", () => draftAction("approve", { id: state.activeDraft?.id, text: $("#draftEditor").value }));
  $("#dismissDraft").addEventListener("click", () => draftAction("dismiss", { id: state.activeDraft?.id }));
  $("#copyDraft").addEventListener("click", copyDraft);
  $("#copyOpenPulse").addEventListener("click", event => {
    if (!$("#draftEditor").value.trim()) {
      event.preventDefault();
      return toast("Generate a draft before opening Weather Pulse");
    }
    copyDraft();
  });
}

async function refresh(force = false) {
  if (state.loading || !state.session.active) return;
  state.loading = true;
  renderSessionControls();
  try {
    const params = new URLSearchParams({ route: "nowcast/current", scenario: state.scenario });
    if (force) params.set("force", "1");
    const response = await fetch(`/api/router?${params}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualSession: true, sessionHistory: state.session.history })
    });
    if (response.status === 401) return window.location.assign(`/admin/login.html?next=${encodeURIComponent(location.pathname)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Console refresh failed");
    state.data = data;
    state.activeDraft = data.drafts?.[0] || null;
    recordSessionObservation(data.current);
    state.session.lastFetch = Date.now();
    persistSession();
    render(data);
    $("#errorBanner").hidden = true;
  } catch (error) {
    $("#errorBanner").textContent = error.message;
    $("#errorBanner").hidden = false;
  } finally {
    state.loading = false;
    renderSessionControls();
  }
}

function render(data) {
  renderMock(data.mock);
  renderStatus(data);
  renderConditions(data.current, data.rainState);
  renderChanges(data.changes || []);
  renderForecast(data.forecast || {}, data.health?.nwsPointForecast);
  renderAlerts(data.alerts || []);
  renderDrafts(data.drafts || []);
  const sessionHistory = data.mock?.enabled ? data.history || [] : [...(state.session.history || [])].sort((a, b) => b.timestamp - a.timestamp);
  renderHistory(sessionHistory, sessionHistory.length);
  renderHealth(data.health || {});
  renderDiagnostics(data.diagnostics || {}, data.logs || []);
  renderSessionControls();
}

function startSession() {
  state.session = {
    id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
    active: true,
    startedAt: Date.now(),
    endedAt: null,
    lastFetch: null,
    history: []
  };
  state.data = null;
  state.activeDraft = null;
  persistSession();
  renderSessionControls();
  refresh(true);
}

function endSession() {
  if (!state.session.active) return;
  state.session.active = false;
  state.session.endedAt = Date.now();
  persistSession();
  renderSessionControls();
  if (state.data) {
    $("#statusHeading").textContent = "Operations session ended";
    $("#statusReason").textContent = "The final collected data and draft remain available for review. No further weather data will be fetched.";
  } else {
    renderIdle();
  }
  toast("Operations session ended");
}

function sessionTick() {
  renderSessionControls();
  if (!state.session.active || state.loading) return;
  if (!state.session.lastFetch || Date.now() - state.session.lastFetch >= AUTO_FETCH_MS) refresh(true);
}

function renderSessionControls() {
  const active = Boolean(state.session?.active);
  $("#startSession").disabled = active || state.loading;
  $("#startSession").textContent = state.session?.endedAt ? "Start New Operations Session" : "Start Operations Session";
  $("#fetchNow").disabled = !active || state.loading;
  $("#fetchNow").textContent = state.loading ? "Fetching…" : "Fetch Now";
  $("#endSession").disabled = !active || state.loading;
  $("#refreshButton").disabled = !active || state.loading;
  $("#refreshButton").textContent = state.loading ? "Fetching…" : "Fetch now";
  $("#sessionHeading").textContent = active ? "Weather Operations is active" : state.session?.endedAt ? "Weather Operations session ended" : "Weather Operations is idle";
  $("#sessionDescription").textContent = active
    ? "The console is collecting data while this page remains open. Automatic fetches occur every two minutes."
    : state.session?.endedAt
      ? "The completed session remains on this device. Start a new session when Asheville weather becomes active again."
      : "Start a session when Asheville weather deserves closer attention. No data is collected while operations are idle.";
  $("#sessionDuration").textContent = active || state.session?.endedAt ? formatSessionDuration((state.session.endedAt || Date.now()) - state.session.startedAt) : "Idle";
  $("#sessionLastFetch").textContent = state.session?.lastFetch ? formatTime(state.session.lastFetch) : "None";
  renderReadiness();
  updateDraftControls();
}

function renderReadiness() {
  const history = state.data?.mock?.enabled ? state.data.history || [] : state.session?.history || [];
  const timestamps = history.map(item => Number(item.timestamp)).filter(Number.isFinite);
  const newest = timestamps.length ? Math.max(...timestamps) : 0;
  const oldest = timestamps.length ? Math.min(...timestamps) : Infinity;
  for (const minutes of [15, 30, 60]) {
    const collectedMinutes = timestamps.length ? Math.floor((newest - oldest) / 60_000) : 0;
    const ready = Number.isFinite(oldest) && collectedMinutes >= minutes;
    const dot = $(`#ready${minutes}`);
    dot.className = `readiness-dot ${ready ? "ready" : state.session.active ? "warming" : ""}`;
    $(`#ready${minutes}Text`).textContent = ready ? "Comparison ready" : state.session.active ? `${Math.max(0, minutes - collectedMinutes)} min remaining` : "Waiting to start";
  }
}

function renderIdle() {
  $("#statusHeading").textContent = state.session?.endedAt ? "Operations session ended" : "Operations idle";
  $("#statusReason").textContent = state.session?.endedAt ? "Start a new session to resume collection." : "Start a manual session to collect current observations and official NWS data.";
  $("#statusMetrics").innerHTML = [["Idle", "Collection"], ["0", "Active flags"], ["0", "NWS alerts"], ["None", "Last update"]].map(([value, label]) => `<div class="status-metric"><strong>${value}</strong><span>${label}</span></div>`).join("");
  $("#conditionsGrid").innerHTML = empty("Start an operations session to fetch current Asheville conditions.");
  $("#changesList").innerHTML = empty("Change monitoring begins when an operations session starts.");
  $("#changeCount").textContent = "0 flags";
  $("#pointForecast").innerHTML = empty("Start an operations session to retrieve the official NWS forecast.");
  $("#hourlyForecast").innerHTML = "";
  $("#alertsList").innerHTML = empty("Start an operations session to check official NWS alerts.");
  $("#alertCount").textContent = "0 active";
  $("#historyTable").innerHTML = `<tr><td colspan="9">No active operations session.</td></tr>`;
  $("#historyCount").textContent = "0 collected";
  $("#healthGrid").innerHTML = empty("Source health will appear after the first manual fetch.");
  $("#diagnosticsGrid").innerHTML = empty("Session diagnostics will appear after collection begins.");
  $("#systemLog").innerHTML = "No session log yet.";
  renderDrafts([]);
  renderSessionControls();
}

function recordSessionObservation(observation) {
  if (!observation?.timestamp) return;
  const oldest = Date.now() - 6 * 60 * 60_000;
  state.session.history = [...(state.session.history || []).filter(item => item.timestamp !== observation.timestamp), observation]
    .filter(item => Number(item.timestamp) >= oldest)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-240);
}

function restoreSession() {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (stored?.id && Array.isArray(stored.history)) return stored;
  } catch {}
  return { id: null, active: false, startedAt: null, endedAt: null, lastFetch: null, history: [] };
}

function persistSession() {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(state.session)); } catch {}
}

function renderMock(mock) {
  $("#mockBanner").hidden = !mock?.enabled;
  if (!mock?.enabled) return;
  const select = $("#scenarioSelect");
  select.innerHTML = mock.scenarios.map(item => `<option value="${escapeHtml(item)}" ${item === mock.scenario ? "selected" : ""}>${escapeHtml(titleCase(item))}</option>`).join("");
}

function renderStatus(data) {
  const status = data.status || {};
  $("#statusHeading").textContent = status.level || "Data issue";
  $("#statusReason").textContent = status.reason || "Status unavailable.";
  $("#statusPanel").dataset.status = status.level || "";
  $("#statusMetrics").innerHTML = [
    [status.freshness || "Unknown", "Source freshness"],
    [status.activeChangeCount ?? 0, "Active flags"],
    [status.activeAlertCount ?? 0, "NWS alerts"],
    [formatTime(data.generatedAt), "Console update"]
  ].map(([value, label]) => `<div class="status-metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
}

function renderConditions(current, rainState) {
  $("#rainState").textContent = rainState || "Rain data unavailable";
  $("#rainState").className = `pill ${/unavailable/i.test(rainState || "") ? "error" : /ongoing|beginning|increasing/i.test(rainState || "") ? "monitoring" : "neutral"}`;
  if (!current) {
    $("#conditionsGrid").innerHTML = empty("Tempest conditions are unavailable. Other console sections remain active.");
    return;
  }
  const stale = current.freshness === "stale";
  const fields = [
    ["Temperature", formatNumber(current.temperatureF, "°F")],
    ["Dew point", formatNumber(current.dewPointF, "°F")],
    ["Humidity", formatNumber(current.humidityPct, "%", 0)],
    ["Feels like", formatNumber(current.feelsLikeF, "°F")],
    ["Wind", `${directionLabel(current.windDirectionDeg)} · ${formatNumber(current.windSpeedMph, " mph")}`],
    ["Wind gust", formatNumber(current.windGustMph, " mph")],
    ["Pressure", formatNumber(current.pressureMb, " mb", 1)],
    ["Rain rate", formatNumber(current.rainRateInPerHour, " in/hr", 2)],
    ["Rain today", formatNumber(current.rainAccumulationIn, " in", 2)],
    ["Lightning", current.lightningCount == null ? "Unavailable" : `${current.lightningCount} detected${current.lightningDistanceMiles == null ? "" : ` · ${formatNumber(current.lightningDistanceMiles, " mi")}`}`],
    ["UV index", formatNumber(current.uvIndex, "", 1)],
    ["Solar radiation", formatNumber(current.solarRadiationWm2, " W/m²", 0)]
  ];
  $("#conditionsGrid").innerHTML = fields.map(([label, value]) => `<article class="metric-card ${stale ? "stale" : ""}"><span class="metric-label">${escapeHtml(label)}</span><strong class="metric-value">${escapeHtml(value)}</strong><span class="metric-meta">${escapeHtml(current.source)} · ${formatDateTime(current.timestamp)}${stale ? " · STALE" : ""}</span></article>`).join("");
}

function renderChanges(changes) {
  $("#changeCount").textContent = `${changes.length} flag${changes.length === 1 ? "" : "s"}`;
  if (!changes.length) {
    $("#changesList").innerHTML = empty("No threshold-level changes are active in the available 15-, 30-, or 60-minute comparisons.");
    return;
  }
  $("#changesList").innerHTML = changes.map(change => `<article class="change-row" data-severity="${escapeHtml(change.severity)}"><span class="change-indicator"></span><div class="change-title"><strong>${escapeHtml(change.label)}</strong><span>${escapeHtml(change.source)} · detected ${formatTime(change.detectedAt)}</span></div><div class="change-cell"><span>Period</span><strong>${change.minutes ? `${change.minutes} min` : "Current"}</strong></div><div class="change-cell"><span>Previous</span><strong>${escapeHtml(formatChangeValue(change.previousValue, change.unit))}</strong></div><div class="change-cell"><span>Current</span><strong>${escapeHtml(formatChangeValue(change.currentValue, change.unit))}</strong></div><div class="change-cell"><span>Difference</span><strong>${escapeHtml(formatSigned(change.difference, change.unit))}</strong></div><span class="pill severity-${escapeHtml(change.severity)}">${escapeHtml(titleCase(change.severity))}</span></article>`).join("");
}

function renderForecast(forecast, forecastHealth) {
  $("#forecastFreshness").textContent = forecastHealth?.status || "Unknown";
  $("#forecastFreshness").className = `pill ${(forecastHealth?.status || "neutral").toLowerCase()}`;
  const point = forecast.point;
  if (!point?.periods?.length) {
    $("#pointForecast").innerHTML = empty("The NWS point forecast is unavailable.");
  } else {
    const p = point.periods[0];
    $("#pointForecast").innerHTML = `<p class="eyebrow">${escapeHtml(p.name || "Current period")}</p><h3>${escapeHtml(p.shortForecast || "Forecast wording unavailable")}</h3><div class="forecast-facts"><strong>${escapeHtml(formatNumber(p.temperatureF, "°F", 0))}</strong><span>Wind ${escapeHtml(p.windDirection || "—")} ${escapeHtml(p.windSpeed || "unavailable")}</span><span>Precipitation ${escapeHtml(formatNumber(p.precipProbabilityPct, "%", 0))}</span></div><p>${escapeHtml(p.detailedForecast || "Detailed forecast unavailable.")}</p><span class="subtle">National Weather Service · updated ${formatDateTime(point.updatedAt)}</span>`;
  }
  const hours = forecast.hourly?.periods || [];
  $("#hourlyForecast").innerHTML = hours.length ? hours.slice(0, 6).map(hour => `<article class="hour-card"><span>${formatHour(hour.startTime)}</span><strong>${escapeHtml(formatNumber(hour.temperatureF, "°", 0))}</strong><span>${escapeHtml(hour.shortForecast || "—")}</span><span>PoP ${escapeHtml(formatNumber(hour.precipProbabilityPct, "%", 0))}</span></article>`).join("") : "";
}

function renderAlerts(alerts) {
  $("#alertCount").textContent = `${alerts.length} active`;
  if (!alerts.length) {
    $("#alertsList").innerHTML = empty("No active official NWS alerts are currently in effect for the city of Asheville.");
    return;
  }
  $("#alertsList").innerHTML = alerts.map(alert => `<article class="alert-card"><p class="eyebrow">National Weather Service</p><h3>${escapeHtml(alert.event)}</h3><strong>${escapeHtml(alert.headline || "")}</strong><div class="alert-meta"><span class="pill monitoring">${escapeHtml(alert.severity)}</span><span class="pill neutral">${escapeHtml(alert.urgency)}</span><span class="pill neutral">${escapeHtml(alert.certainty)}</span></div><p class="subtle">Effective ${formatDateTime(alert.effective)} · Expires ${formatDateTime(alert.expires)}<br>${escapeHtml(alert.area || "Affected area unavailable")}</p><details><summary>Official alert text</summary><p>${escapeHtml(alert.description || "No description provided.")}</p>${alert.instruction ? `<p><strong>Instructions:</strong> ${escapeHtml(alert.instruction)}</p>` : ""}${alert.url ? `<a href="${escapeHtml(alert.url)}" target="_blank" rel="noreferrer">Open official source</a>` : ""}</details></article>`).join("");
}

function renderDrafts(drafts) {
  state.activeDraft = drafts[0] || null;
  const draft = state.activeDraft;
  $("#draftEditor").value = draft ? (draft.editedText || draft.generatedText || "") : "";
  $("#draftStatus").textContent = draft ? titleCase(draft.status) : "No draft";
  $("#draftStatus").className = `pill ${draft?.status === "approved" ? "healthy" : draft?.status === "dismissed" ? "error" : "neutral"}`;
  $("#draftMeta").textContent = draft ? `Generated ${formatDateTime(draft.generatedAt)} · ${draft.inputFacts?.length || 0} validated input facts · ${draft.mockScenario ? `mock: ${draft.mockScenario}` : "live inputs"}` : "Draft generation is manual and rule-based. Nothing is published.";
  updateDraftControls();
  $("#draftHistory").innerHTML = drafts.length ? drafts.map(item => `<article class="draft-history-item"><span class="pill ${item.status === "approved" ? "healthy" : item.status === "dismissed" ? "error" : "neutral"}">${escapeHtml(titleCase(item.status))}</span><p>${escapeHtml(item.approvedText || item.editedText || item.generatedText)}</p><span class="subtle">${formatDateTime(item.generatedAt)}${item.actionAt ? ` · action ${formatDateTime(item.actionAt)}` : ""}</span></article>`).join("") : `<p class="subtle">No drafts stored.</p>`;
}

function updateDraftControls() {
  const hasData = Boolean(state.data?.current || state.data?.forecast?.point);
  const hasDraft = Boolean(state.activeDraft);
  $("#generateDraft").disabled = !hasData || state.loading;
  ["#saveDraft", "#copyDraft", "#approveDraft", "#dismissDraft", "#regenerateDraft"].forEach(selector => { $(selector).disabled = !hasDraft || state.loading; });
  $("#draftEditor").disabled = !hasDraft;
  $("#copyOpenPulse").setAttribute("aria-disabled", String(!hasDraft));
}

function renderHistory(history, totalCount) {
  $("#historyCount").textContent = `${totalCount ?? history.length} stored`;
  $("#historyTable").innerHTML = history.length ? history.map(item => `<tr><td>${formatDateTime(item.timestamp)}</td><td>${escapeHtml(formatNumber(item.temperatureF, "°F"))}</td><td>${escapeHtml(formatNumber(item.dewPointF, "°F"))}</td><td>${escapeHtml(formatNumber(item.humidityPct, "%", 0))}</td><td>${escapeHtml(`${directionLabel(item.windDirectionDeg)} ${formatNumber(item.windSpeedMph, " mph")}`)}</td><td>${escapeHtml(formatNumber(item.windGustMph, " mph"))}</td><td>${escapeHtml(formatNumber(item.pressureMb, " mb", 1))}</td><td>${escapeHtml(formatNumber(item.rainRateInPerHour, " in/hr", 2))}</td><td><span class="pill ${item.freshness === "stale" ? "stale" : "healthy"}">${escapeHtml(item.freshness || "unknown")}</span></td></tr>`).join("") : `<tr><td colspan="9">No observation history stored yet.</td></tr>`;
}

function renderHealth(health) {
  $("#healthGrid").innerHTML = Object.entries(health).map(([key, item]) => `<article class="health-card"><div class="health-card-head"><strong>${escapeHtml(sourceLabels[key] || key)}</strong><span class="pill ${(item.status || "neutral").toLowerCase()}">${escapeHtml(item.status || "Unknown")}</span></div><dl><dt>Last success</dt><dd>${formatDateTime(item.lastSuccess)}</dd><dt>Last attempt</dt><dd>${formatDateTime(item.lastAttempt)}</dd><dt>Data age</dt><dd>${formatDuration(item.dataAgeMs)}</dd><dt>Failures</dt><dd>${item.consecutiveFailures || 0}</dd><dt>Last error</dt><dd>${escapeHtml(item.lastError || "None")}</dd></dl></article>`).join("");
}

function renderDiagnostics(diagnostics, logs) {
  const entries = [
    ["Console build", diagnostics.build], ["Environment", diagnostics.environment],
    ["Refresh duration", formatDuration(diagnostics.latestRefreshDurationMs)], ["Observation history", diagnostics.observationHistoryCount],
    ["Draft history", diagnostics.draftHistoryCount], ["Full refresh", formatDateTime(diagnostics.lastSuccessfulFullRefresh)],
    ["Last failed component", diagnostics.lastFailedComponent || "None"], ["Mock mode", diagnostics.mockMode ? "Enabled" : "Disabled"],
    ["Tempest response", formatDuration(diagnostics.apiResponseTimesMs?.tempest)], ["NWS response", formatDuration(diagnostics.apiResponseTimesMs?.nwsPointForecast)],
    ["NWS alerts response", formatDuration(diagnostics.apiResponseTimesMs?.nwsAlerts)], ["Observation retention", diagnostics.retention]
  ];
  $("#diagnosticsGrid").innerHTML = entries.map(([label, value]) => `<div class="diagnostic"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "Unavailable")}</strong></div>`).join("");
  $("#systemLog").innerHTML = logs.length ? logs.map(log => `<div class="log-row">${formatDateTime(log.timestamp)} · ${escapeHtml(log.event)} · ${escapeHtml(JSON.stringify(log.details || {}))}</div>`).join("") : "No log events stored.";
}

async function draftAction(action, extra = {}) {
  if (!state.data) return toast("Start an operations session and fetch data first");
  const buttons = document.querySelectorAll(".draft-toolbar button");
  buttons.forEach(button => button.disabled = true);
  try {
    const response = await fetch("/api/router?route=nowcast/drafts", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, scenario: state.scenario, ...extra }) });
    if (response.status === 401) return window.location.assign(`/admin/login.html?next=${encodeURIComponent(location.pathname)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Draft action failed");
    toast(`${titleCase(action)} complete`);
    if (state.session.active) {
      await refresh(true);
    } else {
      const drafts = [result.draft, ...(state.data?.drafts || []).filter(item => item.id !== result.draft.id)];
      state.data.drafts = drafts;
      renderDrafts(drafts);
    }
  } catch (error) {
    toast(error.message);
  } finally {
    updateDraftControls();
  }
}

async function copyDraft() {
  const text = $("#draftEditor").value.trim();
  if (!text) return toast("There is no draft to copy");
  try {
    await navigator.clipboard.writeText(text);
    toast("Draft copied to clipboard");
  } catch {
    $("#draftEditor").select();
    document.execCommand("copy");
    toast("Draft copied to clipboard");
  }
}

function empty(message) { return `<div class="empty-state">${escapeHtml(message)}</div>`; }
function formatNumber(value, suffix = "", decimals = 1) { return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value)) ? `${Number(value).toFixed(decimals)}${suffix}` : "Unavailable"; }
function formatChangeValue(value, unit = "") { return value == null ? "—" : Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${unit}` : String(value); }
function formatSigned(value, unit = "") { return value == null || !Number.isFinite(Number(value)) ? "—" : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}${unit}`; }
function formatDateTime(value) { if (!value) return "Unavailable"; const date = new Date(Number.isFinite(Number(value)) ? Number(value) : value); return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function formatTime(value) { if (!value) return "—"; const date = new Date(Number(value)); return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" }).format(date); }
function formatHour(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date); }
function formatDuration(value) { if (value == null || !Number.isFinite(Number(value))) return "Unavailable"; const ms = Number(value); return ms < 1_000 ? `${Math.round(ms)} ms` : ms < 60_000 ? `${(ms / 1_000).toFixed(1)} sec` : `${Math.round(ms / 60_000)} min`; }
function formatSessionDuration(value) { const minutes = Math.max(0, Math.floor(Number(value || 0) / 60_000)); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`; }
function directionLabel(degrees) { if (!Number.isFinite(Number(degrees))) return "Unavailable"; const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]; return `${labels[Math.round(Number(degrees) / 45) % 8]} ${Math.round(Number(degrees))}°`; }
function titleCase(value) { return String(value || "").replaceAll("-", " ").replace(/\b\w/g, char => char.toUpperCase()); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]); }
function toast(message) { const el = $("#toast"); el.textContent = message; el.classList.add("visible"); window.clearTimeout(toast.timer); toast.timer = window.setTimeout(() => el.classList.remove("visible"), 2_800); }
