import test from "node:test";
import assert from "node:assert/strict";
import { NOWCAST_CONFIG } from "../lib/nowcast/config.js";
import {
  circularAngleDifference,
  classifyRainState,
  detectAlertChanges,
  detectForecastChanges,
  detectObservationChanges,
  observationIsStale,
  sourceHealthState
} from "../lib/nowcast/logic.js";
import { buildDraft } from "../lib/nowcast/draftBuilder.js";
import { normalizeTempestObservation } from "../lib/nowcast/clients.js";
import { applyRetention } from "../lib/nowcast/storage.js";
import { isMockModeEnabled, normalizeSessionHistory } from "../lib/nowcast/service.js";

const now = Date.UTC(2026, 7, 4, 16, 0, 0);
const obs = (minutesAgo, overrides = {}) => ({
  timestamp: now - minutesAgo * 60_000,
  temperatureF: 70,
  dewPointF: 55,
  humidityPct: 55,
  windDirectionDeg: 350,
  windSpeedMph: 8,
  windGustMph: 12,
  pressureMb: 1018,
  rainRateInPerHour: 0,
  lightningCount: 0,
  source: "Tempest",
  ...overrides
});

function types(changes) { return changes.map(change => change.type); }

test("mock mode can be enabled for local preview", () => {
  assert.equal(isMockModeEnabled({ NOWCAST_MOCK_MODE: "true" }), true);
});

test("mock mode is always disabled in Vercel production", () => {
  assert.equal(isMockModeEnabled({ NOWCAST_MOCK_MODE: "true", VERCEL_ENV: "production" }), false);
});

test("Tempest object observations are normalized", () => {
  const normalized = normalizeTempestObservation({
    timestamp: now / 1_000,
    air_temperature: 20,
    dew_point: 12,
    relative_humidity: 60,
    feels_like: 21,
    wind_avg: 2,
    wind_gust: 4,
    wind_direction: 180,
    sea_level_pressure: 1017,
    precip: 0.1,
    precip_accum_local_day: 2.54,
    lightning_strike_last_distance: 10,
    lightning_strike_count: 2,
    uv: 3,
    solar_radiation: 400
  }, now);

  assert.equal(Math.round(normalized.temperatureF), 68);
  assert.equal(Math.round(normalized.dewPointF * 10) / 10, 53.6);
  assert.equal(Math.round(normalized.windSpeedMph * 10) / 10, 4.5);
  assert.equal(Math.round(normalized.rainRateInPerHour * 100) / 100, 0.24);
  assert.equal(normalized.rainAccumulationIn, 0.1);
  assert.equal(normalized.lightningCount, 2);
});

test("temperature change is detected at 30 minutes", () => {
  const changes = detectObservationChanges(obs(0, { temperatureF: 65 }), [obs(30)], now);
  assert.ok(types(changes).includes("temperatureF"));
});

test("dew-point change is detected at 30 minutes", () => {
  const changes = detectObservationChanges(obs(0, { dewPointF: 59 }), [obs(30)], now);
  assert.ok(types(changes).includes("dewPointF"));
});

test("pressure tendency is detected at 60 minutes", () => {
  const changes = detectObservationChanges(obs(0, { pressureMb: 1015.9 }), [obs(60)], now);
  assert.ok(types(changes).includes("pressureMb"));
});

test("sustained wind and gust increases are detected", () => {
  const changes = detectObservationChanges(obs(0, { windSpeedMph: 17, windGustMph: 23 }), [obs(30)], now);
  assert.ok(types(changes).includes("windSpeedMph"));
  assert.ok(types(changes).includes("windGustMph"));
});

test("circular wind direction difference crosses north correctly", () => {
  assert.equal(circularAngleDifference(350, 10), 20);
  const changes = detectObservationChanges(obs(0, { windDirectionDeg: 45 }), [obs(30, { windDirectionDeg: 350 })], now);
  assert.ok(types(changes).includes("wind-direction"));
});

test("calm wind filters direction changes", () => {
  const changes = detectObservationChanges(obs(0, { windDirectionDeg: 90, windSpeedMph: 2 }), [obs(30, { windDirectionDeg: 350, windSpeedMph: 2 })], now);
  assert.ok(!types(changes).includes("wind-direction"));
});

test("rain beginning is detected from dry history", () => {
  assert.equal(classifyRainState(obs(0, { rainRateInPerHour: 0.12 }), [obs(15)], now), "Rain beginning");
  assert.ok(types(detectObservationChanges(obs(0, { rainRateInPerHour: 0.12 }), [obs(15)], now)).includes("rain-beginning"));
});

test("rain end observes configurable grace period", () => {
  const recentWet = [obs(5, { rainRateInPerHour: 0.08 })];
  assert.equal(classifyRainState(obs(0), recentWet, now), "Rain recently ended");
  const oldWet = [obs(NOWCAST_CONFIG.thresholds.rainEndGraceMinutes + 2, { rainRateInPerHour: 0.08 })];
  assert.equal(classifyRainState(obs(0), oldWet, now), "Dry");
});

test("stale observation is detected", () => {
  assert.equal(observationIsStale(obs(11), now), true);
  assert.ok(types(detectObservationChanges(obs(11), [], now)).includes("stale-observation"));
});

test("source health moves through healthy, delayed, stale, and error", () => {
  assert.equal(sourceHealthState({ lastSuccess: now - 60_000, lastAttempt: now - 60_000 }, 5, 10, now), "Healthy");
  assert.equal(sourceHealthState({ lastSuccess: now - 6 * 60_000, lastAttempt: now - 6 * 60_000 }, 5, 10, now), "Delayed");
  assert.equal(sourceHealthState({ lastSuccess: now - 11 * 60_000, lastAttempt: now - 11 * 60_000 }, 5, 10, now), "Stale");
  assert.equal(sourceHealthState({ lastSuccess: now, consecutiveFailures: 3 }, 5, 10, now), "Error");
});

test("new and updated alerts are detected", () => {
  const alert = { id: "a", event: "Flood Warning", severity: "Severe", urgency: "Immediate", certainty: "Likely", headline: "Flood Warning", effective: new Date(now).toISOString(), expires: new Date(now + 60_000).toISOString() };
  assert.ok(types(detectAlertChanges([], [alert], now)).includes("new-alert"));
  const updated = { ...alert, headline: "Updated Flood Warning" };
  assert.ok(types(detectAlertChanges([alert], [updated], now)).includes("updated-alert"));
});

test("forecast PoP and temperature changes are detected", () => {
  const forecast = (temperatureF, precipProbabilityPct) => ({ periods: [{ name: "Tonight", startTime: "2026-08-04T20:00:00Z", temperatureF, precipProbabilityPct, windSpeedMph: 5, shortForecast: "Partly Cloudy", detailedForecast: "Partly cloudy." }] });
  const changes = detectForecastChanges(forecast(70, 10), forecast(66, 40), now);
  assert.ok(types(changes).includes("forecast-temperature"));
  assert.ok(types(changes).includes("forecast-pop"));
});

test("draft generation uses validated values and active alert", () => {
  const result = buildDraft({ observation: obs(0), rainState: "Dry", changes: [], alerts: [{ id: "a", event: "Flood Warning" }], forecast: { periods: [{ name: "Tonight", shortForecast: "Chance Showers", precipProbabilityPct: 40 }] }, now });
  assert.match(result.text, /Asheville/);
  assert.match(result.text, /Flood Warning/);
  assert.match(result.text, /NWS forecast/);
  assert.doesNotMatch(result.text, /Asheville (?:station|point)/i);
});

test("draft handles missing and stale observations without inventing conditions", () => {
  const missing = buildDraft({ observation: null, rainState: "Rain data unavailable", alerts: [], now });
  assert.match(missing.text, /stale or unavailable/);
  assert.doesNotMatch(missing.text, /°F/);
  const stale = buildDraft({ observation: obs(20), rainState: "Dry", alerts: [], now });
  assert.match(stale.text, /confidence is limited/);
});

test("storage retention bounds age and item count", () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ timestamp: now - index * 60 * 60_000 }));
  const retained = applyRetention(items, { maxAgeHours: 5, maxItems: 3 }, now);
  assert.equal(retained.length, 3);
  assert.ok(retained.every(item => item.timestamp >= now - 5 * 60 * 60_000));
});

test("manual session history is bounded and sanitized", () => {
  const items = [
    obs(15, { source: "Tempest", unexpected: "discard me" }),
    obs(500),
    { timestamp: "invalid", temperatureF: 70 }
  ];
  const normalized = normalizeSessionHistory(items, now);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].temperatureF, 70);
  assert.equal("unexpected" in normalized[0], false);
});
