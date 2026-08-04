import { NOWCAST_CONFIG } from "./config.js";
import { fetchNwsAlerts, fetchNwsBundle, fetchTempestObservation } from "./clients.js";
import { buildMockData, MOCK_SCENARIOS } from "./mocks.js";
import {
  calculateOverallStatus,
  classifyRainState,
  detectAlertChanges,
  detectForecastChanges,
  detectObservationChanges,
  sourceHealthState
} from "./logic.js";
import { buildDraft } from "./draftBuilder.js";
import {
  getAlertSnapshots,
  getDiagnostics,
  getDrafts,
  getForecasts,
  getHealth,
  getLogs,
  getObservations,
  getStorageStatus,
  logEvent,
  saveAlertSnapshot,
  saveDiagnostics,
  saveDraft,
  saveForecastSnapshot,
  saveObservation,
  updateHealth
} from "./storage.js";

const caches = new Map();
const pending = new Map();

export async function getConsoleData({ scenario = "quiet", force = false, sessionHistory = [], manualSession = false } = {}) {
  const mockEnabled = String(process.env.NOWCAST_MOCK_MODE || "").toLowerCase() === "true";
  const selectedScenario = mockEnabled && MOCK_SCENARIOS.includes(scenario) ? scenario : "quiet";
  const cacheKey = mockEnabled ? `mock:${selectedScenario}` : "live";
  const cached = caches.get(cacheKey);
  if (!force && cached && Date.now() - cached.timestamp < 45_000) return cached.data;
  if (pending.has(cacheKey)) return pending.get(cacheKey);

  const refresh = buildConsoleData({ mockEnabled, scenario: selectedScenario, sessionHistory: normalizeSessionHistory(sessionHistory), manualSession })
    .then(data => {
      caches.set(cacheKey, { timestamp: Date.now(), data });
      return data;
    })
    .finally(() => pending.delete(cacheKey));
  pending.set(cacheKey, refresh);
  return refresh;
}

export async function handleDraftAction(action, body = {}) {
  const drafts = await getDrafts();
  if (["generate", "regenerate"].includes(action)) {
    const dashboard = await getConsoleData({ scenario: body.scenario, force: false });
    const generated = buildDraft({
      observation: dashboard.current,
      rainState: dashboard.rainState,
      changes: dashboard.changes,
      alerts: dashboard.alerts,
      forecast: dashboard.forecast.point,
      now: Date.now(),
      variation: drafts.length
    });
    const draft = {
      id: crypto.randomUUID(),
      generatedAt: generated.generatedAt,
      generatedText: generated.text,
      editedText: null,
      approvedText: null,
      status: "review",
      actionAt: null,
      inputFacts: generated.facts,
      mockScenario: dashboard.mock.enabled ? dashboard.mock.scenario : null
    };
    await saveDraft(draft);
    await logEvent("draft_generation", { draftId: draft.id, factCount: draft.inputFacts.length, mockScenario: draft.mockScenario });
    return draft;
  }

  const id = String(body.id || "");
  const draft = drafts.find(item => item.id === id);
  if (!draft) throw new UserInputError("Draft not found", 404);

  if (action === "edit") {
    draft.editedText = sanitizeDraftText(body.text);
    draft.status = "review";
    draft.actionAt = Date.now();
  } else if (action === "approve") {
    const text = sanitizeDraftText(body.text || draft.editedText || draft.generatedText);
    draft.editedText = text === draft.generatedText ? draft.editedText : text;
    draft.approvedText = text;
    draft.status = "approved";
    draft.actionAt = Date.now();
    await logEvent("draft_approval", { draftId: draft.id });
  } else if (action === "dismiss") {
    draft.status = "dismissed";
    draft.actionAt = Date.now();
    await logEvent("draft_dismissal", { draftId: draft.id });
  } else {
    throw new UserInputError("Unsupported draft action", 400);
  }
  await saveDraft(draft);
  return draft;
}

async function buildConsoleData({ mockEnabled, scenario, sessionHistory, manualSession }) {
  const startedAt = Date.now();
  let observation;
  let history;
  let forecast;
  let hourly;
  let previousForecast;
  let alerts;
  let previousAlerts;
  let componentErrors = {};
  let responseTimes = {};

  if (mockEnabled) {
    const mock = buildMockData(scenario, startedAt);
    ({ observation, history, forecast, hourly, previousForecast, alerts, previousAlerts } = mock);
    componentErrors = { tempest: mock.tempestError, nws: mock.nwsError };
    responseTimes = { tempest: 4, nwsPointForecast: 6, nwsHourlyForecast: 6, nwsAlerts: 3 };
  } else {
    const storedObservations = await getObservations();
    const existingHistory = manualSession ? sessionHistory : mergeObservationHistory(storedObservations, sessionHistory);
    const forecastHistory = await getForecasts();
    const alertHistory = await getAlertSnapshots();
    previousForecast = forecastHistory.at(-1) || null;
    previousAlerts = alertHistory.at(-1)?.alerts || [];

    const [tempestResult, nwsResult, alertResult] = await Promise.all([
      timed("tempest", fetchTempestObservation),
      timed("nws", fetchNwsBundle),
      timed("alerts", fetchNwsAlerts)
    ]);
    responseTimes.tempest = tempestResult.duration;
    responseTimes.nwsPointForecast = nwsResult.duration;
    responseTimes.nwsHourlyForecast = nwsResult.duration;
    responseTimes.nwsAlerts = alertResult.duration;

    observation = tempestResult.value;
    componentErrors.tempest = tempestResult.error;
    const bundle = nwsResult.value;
    forecast = bundle?.point?.data || null;
    hourly = bundle?.hourly?.data || null;
    componentErrors.nwsPointForecast = nwsResult.error || bundle?.point?.error || null;
    componentErrors.nwsHourlyForecast = nwsResult.error || bundle?.hourly?.error || null;
    alerts = alertResult.value || [];
    componentErrors.nwsAlerts = alertResult.error;

    history = existingHistory;
    if (observation) {
      const storedHistory = await saveObservation(observation);
      history = manualSession ? mergeObservationHistory(existingHistory, [observation]) : storedHistory;
    }
    if (forecast) await saveForecastSnapshot(forecast);
    if (!alertResult.error) await saveAlertSnapshot(alerts, startedAt);
  }

  const health = await updateSourceHealth({
    observation, forecast, hourly, alerts,
    componentErrors, responseTimes, attemptedAt: startedAt, mockEnabled
  });
  const rainState = observation ? classifyRainState(observation, history, startedAt) : "Rain data unavailable";
  const observationChanges = observation ? detectObservationChanges(observation, history, startedAt) : [];
  const forecastChanges = forecast ? detectForecastChanges(previousForecast, forecast, startedAt) : [];
  const alertChanges = componentErrors.nwsAlerts ? [] : detectAlertChanges(previousAlerts, alerts, startedAt);
  const sourceChanges = buildSourceChanges(componentErrors, startedAt);
  const changes = [...alertChanges, ...observationChanges, ...forecastChanges, ...sourceChanges]
    .sort((a, b) => severityScore(b.severity) - severityScore(a.severity));
  const status = calculateOverallStatus({ changes, alerts, health });
  const drafts = await getDrafts();
  const logs = await getLogs();
  const previousDiagnostics = await getDiagnostics();
  const completedAt = Date.now();
  const allCoreHealthy = observation && forecast && hourly && !componentErrors.nwsAlerts;
  const diagnostics = {
    build: NOWCAST_CONFIG.version,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    latestRefreshDurationMs: completedAt - startedAt,
    apiResponseTimesMs: responseTimes,
    observationHistoryCount: history.length,
    draftHistoryCount: drafts.length,
    lastSuccessfulFullRefresh: allCoreHealthy ? completedAt : previousDiagnostics.lastSuccessfulFullRefresh || null,
    lastFailedComponent: Object.entries(componentErrors).find(([, error]) => error)?.[0] || null,
    mockMode: mockEnabled,
    retention: `${NOWCAST_CONFIG.retention.observationsHours} hours / ${NOWCAST_CONFIG.retention.maxObservations} observations maximum`
  };
  await saveDiagnostics(diagnostics);

  for (const change of changes) {
    if (change.severity !== "minor") await logEvent("threshold_trigger", { type: change.type, source: change.source, severity: change.severity });
  }

  return {
    generatedAt: completedAt,
    status: { ...status, activeChangeCount: changes.length, activeAlertCount: alerts.length, freshness: overallFreshness(health) },
    current: observation || null,
    rainState,
    changes,
    forecast: { point: forecast || null, hourly: hourly || null },
    alerts,
    history: [...history].sort((a, b) => b.timestamp - a.timestamp).slice(0, 36),
    health,
    drafts: [...drafts].sort((a, b) => b.generatedAt - a.generatedAt).slice(0, 20),
    diagnostics,
    logs: [...logs].sort((a, b) => b.timestamp - a.timestamp).slice(0, 30),
    thresholds: NOWCAST_CONFIG.thresholds,
    mock: { enabled: mockEnabled, scenario: mockEnabled ? scenario : null, scenarios: mockEnabled ? MOCK_SCENARIOS : [] }
  };
}

export function normalizeSessionHistory(items, now = Date.now()) {
  const oldest = now - 6 * 60 * 60_000;
  return (Array.isArray(items) ? items : [])
    .filter(item => Number.isFinite(Number(item?.timestamp)) && Number(item.timestamp) >= oldest && Number(item.timestamp) <= now + 5 * 60_000)
    .map(item => ({
      timestamp: Number(item.timestamp),
      temperatureF: finiteOrNull(item.temperatureF),
      dewPointF: finiteOrNull(item.dewPointF),
      humidityPct: finiteOrNull(item.humidityPct),
      feelsLikeF: finiteOrNull(item.feelsLikeF),
      windDirectionDeg: finiteOrNull(item.windDirectionDeg),
      windSpeedMph: finiteOrNull(item.windSpeedMph),
      windGustMph: finiteOrNull(item.windGustMph),
      pressureMb: finiteOrNull(item.pressureMb),
      rainRateInPerHour: finiteOrNull(item.rainRateInPerHour),
      rainAccumulationIn: finiteOrNull(item.rainAccumulationIn),
      lightningDistanceMiles: finiteOrNull(item.lightningDistanceMiles),
      lightningCount: finiteOrNull(item.lightningCount),
      uvIndex: finiteOrNull(item.uvIndex),
      solarRadiationWm2: finiteOrNull(item.solarRadiationWm2),
      source: String(item.source || "Manual operations session").slice(0, 80),
      freshness: item.freshness === "stale" ? "stale" : "fresh",
      fetchStatus: item.fetchStatus === "failure" ? "failure" : "success",
      fetchedAt: finiteOrNull(item.fetchedAt) || Number(item.timestamp)
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-240);
}

function mergeObservationHistory(stored, session) {
  const byTimestamp = new Map();
  for (const item of [...(stored || []), ...(session || [])]) {
    if (item?.timestamp) byTimestamp.set(Number(item.timestamp), item);
  }
  return [...byTimestamp.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-1_000);
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function updateSourceHealth({ observation, forecast, hourly, componentErrors, responseTimes, attemptedAt, mockEnabled }) {
  const storageStatus = getStorageStatus();
  const storageOk = storageStatus.checked && storageStatus.durable;
  const updates = [
    ["tempest", Boolean(observation), componentErrors.tempest, responseTimes.tempest],
    ["nwsPointForecast", Boolean(forecast), componentErrors.nwsPointForecast || componentErrors.nws, responseTimes.nwsPointForecast],
    ["nwsHourlyForecast", Boolean(hourly), componentErrors.nwsHourlyForecast || componentErrors.nws, responseTimes.nwsHourlyForecast],
    ["nwsAlerts", !componentErrors.nwsAlerts && !componentErrors.nws, componentErrors.nwsAlerts || componentErrors.nws, responseTimes.nwsAlerts],
    ["observationStorage", storageOk, storageOk ? null : "Vercel KV is unavailable; using non-durable memory fallback", null],
    ["draftStorage", storageOk, storageOk ? null : "Vercel KV is unavailable; using non-durable memory fallback", null]
  ];
  for (const [source, ok, error, responseTimeMs] of updates) {
    await updateHealth(source, { ok, error: error || (ok ? null : `${source} unavailable`), responseTimeMs, attemptedAt });
  }
  const raw = await getHealth();
  const now = Date.now();
  return Object.fromEntries(Object.entries(raw).map(([source, item]) => {
    const limits = healthLimits(source);
    const dataTimestamp = source === "tempest"
      ? observation?.timestamp
      : source === "nwsPointForecast"
        ? forecast?.fetchedAt
        : source === "nwsHourlyForecast"
          ? hourly?.fetchedAt
          : item.lastSuccess;
    let status = sourceHealthState(item, limits.delayed, limits.stale, now);
    if (dataTimestamp && now - dataTimestamp > limits.stale * 60_000) status = "Stale";
    if (process.env.NOWCAST_PREVIEW_MODE === "true" && ["observationStorage", "draftStorage"].includes(source)) {
      status = "Disabled";
    }
    return [source, {
      ...item,
      status,
      dataAgeMs: dataTimestamp ? now - dataTimestamp : null
    }];
  }));
}

function healthLimits(source) {
  if (source === "tempest") return { delayed: 5, stale: NOWCAST_CONFIG.thresholds.staleTempestMinutes };
  if (source === "nwsAlerts") return { delayed: NOWCAST_CONFIG.thresholds.delayedNwsAlertsMinutes, stale: NOWCAST_CONFIG.thresholds.staleNwsAlertsMinutes };
  if (source.startsWith("nws")) return { delayed: NOWCAST_CONFIG.thresholds.delayedNwsForecastMinutes, stale: NOWCAST_CONFIG.thresholds.staleNwsForecastMinutes };
  return { delayed: 5, stale: 15 };
}

async function timed(name, operation) {
  const started = Date.now();
  try {
    return { name, value: await operation(), error: null, duration: Date.now() - started };
  } catch (error) {
    return { name, value: null, error: String(error?.message || error), duration: Date.now() - started };
  }
}

function buildSourceChanges(errors, now) {
  return Object.entries(errors).filter(([, error]) => error).map(([source, error]) => ({ id: `source-failure:${source}:${now}`, type: "source-failure", label: `${source} fetch failed`, minutes: 0, previousValue: null, currentValue: String(error), difference: null, unit: "", severity: "high", source, detectedAt: now }));
}

function overallFreshness(health) {
  const states = Object.values(health).map(item => item.status);
  if (states.some(state => state === "Error")) return "Error";
  if (states.some(state => state === "Stale")) return "Stale";
  if (states.some(state => state === "Delayed")) return "Delayed";
  return "Fresh";
}

function severityScore(value) {
  return ({ minor: 1, moderate: 2, high: 3 })[value] || 0;
}

function sanitizeDraftText(value) {
  const text = String(value || "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (!text) throw new UserInputError("Draft text cannot be empty", 400);
  if (text.length > 1_200) throw new UserInputError("Draft text must be 1,200 characters or fewer", 400);
  return text;
}

export class UserInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
