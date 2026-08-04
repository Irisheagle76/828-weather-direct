import { kv } from "@vercel/kv";
import { NOWCAST_CONFIG, PHASE1_SOURCE_NAMES } from "./config.js";

const KEYS = Object.freeze({
  observations: "nowcast:phase1:observations",
  forecasts: "nowcast:phase1:forecasts",
  alertSnapshots: "nowcast:phase1:alert-snapshots",
  drafts: "nowcast:phase1:drafts",
  health: "nowcast:phase1:health",
  logs: "nowcast:phase1:logs",
  diagnostics: "nowcast:phase1:diagnostics"
});

const memory = new Map();
let durableStorageAvailable = null;

export function getStorageStatus() {
  return { durable: durableStorageAvailable === true, checked: durableStorageAvailable !== null };
}

export function applyRetention(items, { timestampKey = "timestamp", maxAgeHours, maxItems }, now = Date.now()) {
  const oldest = now - maxAgeHours * 60 * 60_000;
  return [...(items || [])]
    .filter(item => Number(item?.[timestampKey]) >= oldest)
    .sort((a, b) => Number(a[timestampKey]) - Number(b[timestampKey]))
    .slice(-maxItems);
}

export async function getObservations() {
  return getArray(KEYS.observations);
}

export async function saveObservation(observation) {
  if (!observation?.timestamp) return getObservations();
  const history = await getObservations();
  const next = applyRetention(
    [...history.filter(item => item.timestamp !== observation.timestamp), observation],
    { timestampKey: "timestamp", maxAgeHours: NOWCAST_CONFIG.retention.observationsHours, maxItems: NOWCAST_CONFIG.retention.maxObservations }
  );
  await setValue(KEYS.observations, next);
  await logEvent("observation_storage", { timestamp: observation.timestamp, source: observation.source });
  return next;
}

export async function getForecasts() {
  return getArray(KEYS.forecasts);
}

export async function saveForecastSnapshot(forecast) {
  if (!forecast?.updatedAt) return getForecasts();
  const history = await getForecasts();
  const next = applyRetention(
    [...history.filter(item => item.updatedAt !== forecast.updatedAt), forecast],
    { timestampKey: "fetchedAt", maxAgeHours: NOWCAST_CONFIG.retention.forecastsHours, maxItems: NOWCAST_CONFIG.retention.maxForecasts }
  );
  await setValue(KEYS.forecasts, next);
  await logEvent("forecast_storage", { updatedAt: forecast.updatedAt });
  return next;
}

export async function getAlertSnapshots() {
  return getArray(KEYS.alertSnapshots);
}

export async function saveAlertSnapshot(alerts, fetchedAt = Date.now()) {
  const history = await getAlertSnapshots();
  const snapshot = { fetchedAt, alerts };
  const previous = history.at(-1);
  const unchanged = previous && JSON.stringify(previous.alerts) === JSON.stringify(alerts);
  const source = unchanged ? history : [...history, snapshot];
  const next = applyRetention(source, { timestampKey: "fetchedAt", maxAgeHours: NOWCAST_CONFIG.retention.alertsHours, maxItems: NOWCAST_CONFIG.retention.maxAlertSnapshots });
  await setValue(KEYS.alertSnapshots, next);
  return next;
}

export async function getDrafts() {
  return getArray(KEYS.drafts);
}

export async function saveDraft(draft) {
  const drafts = await getDrafts();
  const next = [...drafts.filter(item => item.id !== draft.id), draft]
    .sort((a, b) => a.generatedAt - b.generatedAt)
    .slice(-NOWCAST_CONFIG.retention.maxDrafts);
  await setValue(KEYS.drafts, next);
  return next;
}

export async function getHealth() {
  const stored = await getObject(KEYS.health);
  const defaults = Object.fromEntries(PHASE1_SOURCE_NAMES.map(source => [source, {
    source,
    enabled: true,
    lastSuccess: null,
    lastAttempt: null,
    lastError: null,
    consecutiveFailures: 0
  }]));
  return { ...defaults, ...stored };
}

export async function updateHealth(source, { ok, attemptedAt = Date.now(), error = null, responseTimeMs = null }) {
  const health = await getHealth();
  const previous = health[source] || { source, enabled: true, consecutiveFailures: 0 };
  health[source] = {
    ...previous,
    lastAttempt: attemptedAt,
    lastSuccess: ok ? attemptedAt : previous.lastSuccess || null,
    lastError: ok ? null : sanitizeLogValue(error),
    consecutiveFailures: ok ? 0 : (previous.consecutiveFailures || 0) + 1,
    responseTimeMs
  };
  await setValue(KEYS.health, health);
  await logEvent(ok ? "fetch_success" : "fetch_failure", { source, responseTimeMs, error: ok ? undefined : sanitizeLogValue(error) });
  return health[source];
}

export async function logEvent(event, details = {}) {
  const logs = await getArray(KEYS.logs);
  const entry = { timestamp: Date.now(), event, details: sanitizeDetails(details) };
  await setValue(KEYS.logs, [...logs, entry].slice(-NOWCAST_CONFIG.retention.maxLogs));
  const message = JSON.stringify(entry);
  if (/failure|error/i.test(event)) console.warn(message);
  else console.log(message);
  return entry;
}

export async function getLogs() {
  return getArray(KEYS.logs);
}

export async function getDiagnostics() {
  return getObject(KEYS.diagnostics);
}

export async function saveDiagnostics(diagnostics) {
  await setValue(KEYS.diagnostics, diagnostics);
  return diagnostics;
}

async function getArray(key) {
  const value = await getValue(key);
  return Array.isArray(value) ? value : [];
}

async function getObject(key) {
  const value = await getValue(key);
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function getValue(key) {
  try {
    const value = await kv.get(key);
    if (value !== null && value !== undefined) {
      durableStorageAvailable = true;
      memory.set(key, value);
      return value;
    }
  } catch (error) {
    durableStorageAvailable = false;
    console.warn(JSON.stringify({ event: "storage_fallback", key, error: sanitizeLogValue(error) }));
  }
  return memory.get(key);
}

async function setValue(key, value) {
  memory.set(key, value);
  try {
    await kv.set(key, value);
    durableStorageAvailable = true;
    return { durable: true };
  } catch (error) {
    durableStorageAvailable = false;
    console.warn(JSON.stringify({ event: "storage_failure", key, error: sanitizeLogValue(error) }));
    return { durable: false };
  }
}

function sanitizeDetails(details) {
  return Object.fromEntries(Object.entries(details || {})
    .filter(([key, value]) => value !== undefined && !/token|secret|password|credential|url/i.test(key))
    .map(([key, value]) => [key, typeof value === "number" || typeof value === "boolean" || value === null ? value : sanitizeLogValue(value)]));
}

function sanitizeLogValue(value) {
  const text = String(value?.message || value || "");
  return text.replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, "$1[redacted]").slice(0, 300);
}
