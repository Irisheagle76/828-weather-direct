import { NOWCAST_CONFIG } from "./config.js";

const T = NOWCAST_CONFIG.thresholds;

export function circularAngleDifference(from, to) {
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.abs(((to - from + 540) % 360) - 180);
}

export function observationIsStale(observation, now = Date.now()) {
  if (!Number.isFinite(observation?.timestamp)) return true;
  return now - observation.timestamp > T.staleTempestMinutes * 60_000;
}

export function closestObservation(history, minutesAgo, now = Date.now(), toleranceMinutes = 8) {
  const target = now - minutesAgo * 60_000;
  let closest = null;
  let difference = Infinity;
  for (const item of history || []) {
    const candidate = Math.abs(Number(item?.timestamp) - target);
    if (candidate < difference) {
      difference = candidate;
      closest = item;
    }
  }
  return difference <= toleranceMinutes * 60_000 ? closest : null;
}

export function classifyRainState(current, history = [], now = Date.now()) {
  const rate = numberOrNull(current?.rainRateInPerHour);
  if (rate === null) return "Rain data unavailable";

  const measurable = rate >= T.measurableRainInPerHour;
  const graceStart = now - T.rainEndGraceMinutes * 60_000;
  const recent = history.filter(item => item.timestamp >= graceStart && item.timestamp < current.timestamp);
  const recentWet = recent.some(item => numberOrNull(item.rainRateInPerHour) >= T.measurableRainInPerHour);
  const earlier = closestObservation(history, 15, now, 15);
  const earlierRate = numberOrNull(earlier?.rainRateInPerHour);

  if (!measurable && recentWet) return "Rain recently ended";
  if (!measurable) return "Dry";
  if (!recentWet && (earlierRate === null || earlierRate < T.measurableRainInPerHour)) return "Rain beginning";
  if (earlierRate !== null && rate >= Math.max(T.measurableRainInPerHour, earlierRate * 1.5)) return "Rain increasing";
  if (earlierRate !== null && earlierRate >= T.measurableRainInPerHour && rate <= earlierRate * 0.6) return "Rain decreasing";
  return "Rain ongoing";
}

export function detectObservationChanges(current, history = [], now = Date.now()) {
  if (!current) return [];
  const changes = [];
  const comparisons = [15, 30, 60].map(minutes => ({
    minutes,
    previous: closestObservation(history, minutes, current.timestamp || now)
  }));

  for (const { minutes, previous } of comparisons) {
    if (!previous) continue;
    if (minutes === 30) {
      addNumericChange(changes, current, previous, "temperatureF", "Temperature", "°F", T.temperatureF30m, minutes);
      addNumericChange(changes, current, previous, "dewPointF", "Dew point", "°F", T.dewPointF30m, minutes);
      addNumericChange(changes, current, previous, "humidityPct", "Humidity", " percentage points", T.humidityPoints30m, minutes);
      addNumericChange(changes, current, previous, "windSpeedMph", "Sustained wind", " mph", T.sustainedWindMph30m, minutes, true);
      addNumericChange(changes, current, previous, "windGustMph", "Wind gusts", " mph", T.gustMph30m, minutes, true);

      const directionDifference = circularAngleDifference(previous.windDirectionDeg, current.windDirectionDeg);
      if (
        directionDifference !== null &&
        directionDifference >= T.windDirectionDegrees30m &&
        Math.max(previous.windSpeedMph || 0, current.windSpeedMph || 0) >= T.minimumWindMphForDirection
      ) {
        changes.push(makeChange({
          type: "wind-direction",
          label: "Wind direction shifted",
          minutes,
          previousValue: previous.windDirectionDeg,
          currentValue: current.windDirectionDeg,
          difference: directionDifference,
          unit: "°",
          severity: directionDifference >= 90 ? "moderate" : "minor",
          source: current.source,
          detectedAt: now
        }));
      }
    }

    if (minutes === 60) {
      addNumericChange(changes, current, previous, "pressureMb", "Pressure", " mb", T.pressureMb60m, minutes);
    }
  }

  const rainState = classifyRainState(current, history, now);
  const rainSeverity = current.rainRateInPerHour >= T.heavyRainInPerHour ? "high" : "moderate";
  if (["Rain beginning", "Rain recently ended", "Rain increasing", "Rain decreasing"].includes(rainState)) {
    const previous = closestObservation(history, 15, current.timestamp || now, 15);
    changes.push(makeChange({
      type: rainState.toLowerCase().replaceAll(" ", "-"),
      label: rainState,
      minutes: 15,
      previousValue: previous?.rainRateInPerHour ?? null,
      currentValue: current.rainRateInPerHour,
      difference: numberDifference(current.rainRateInPerHour, previous?.rainRateInPerHour),
      unit: " in/hr",
      severity: rainSeverity,
      source: current.source,
      detectedAt: now
    }));
  } else if (current.rainRateInPerHour >= T.heavyRainInPerHour) {
    changes.push(makeChange({ type: "heavy-rain", label: "Heavy rain at station", minutes: 0, previousValue: null, currentValue: current.rainRateInPerHour, difference: null, unit: " in/hr", severity: "high", source: current.source, detectedAt: now }));
  }

  if ((current.lightningCount || 0) > 0) {
    changes.push(makeChange({ type: "lightning", label: "Lightning detected by station", minutes: 0, previousValue: 0, currentValue: current.lightningCount, difference: current.lightningCount, unit: " strikes", severity: "high", source: current.source, detectedAt: now }));
  }
  if (observationIsStale(current, now)) {
    changes.push(makeChange({ type: "stale-observation", label: "Tempest observation is stale", minutes: Math.round((now - current.timestamp) / 60_000), previousValue: null, currentValue: current.timestamp, difference: null, unit: "", severity: "high", source: current.source, detectedAt: now }));
  }
  return deduplicateChanges(changes);
}

export function detectAlertChanges(previousAlerts = [], currentAlerts = [], now = Date.now()) {
  const previous = new Map(previousAlerts.map(alert => [alert.id, alert]));
  const current = new Map(currentAlerts.map(alert => [alert.id, alert]));
  const changes = [];

  for (const alert of currentAlerts) {
    const before = previous.get(alert.id);
    if (!before) {
      changes.push(alertChange("new-alert", `New ${alert.event}`, alert, "high", now));
      continue;
    }
    const changed = JSON.stringify(alertComparable(before)) !== JSON.stringify(alertComparable(alert));
    if (!changed) continue;
    let type = "updated-alert";
    let label = `Updated ${alert.event}`;
    if (Date.parse(alert.expires) > Date.parse(before.expires)) { type = "extended-alert"; label = `Extended ${alert.event}`; }
    const rank = severityRank(alert.severity) - severityRank(before.severity);
    if (rank > 0) { type = "upgraded-alert"; label = `Upgraded ${alert.event}`; }
    if (rank < 0) { type = "downgraded-alert"; label = `Downgraded ${alert.event}`; }
    changes.push(alertChange(type, label, alert, rank >= 0 ? "high" : "moderate", now));
  }
  for (const alert of previousAlerts) {
    if (!current.has(alert.id)) {
      const expired = Date.parse(alert.expires) <= now;
      changes.push(alertChange(expired ? "expired-alert" : "cancelled-alert", `${expired ? "Expired" : "Cancelled"} ${alert.event}`, alert, "moderate", now));
    }
  }
  return changes;
}

export function detectForecastChanges(previous, current, now = Date.now()) {
  if (!previous?.periods?.length || !current?.periods?.length) return [];
  const before = previous.periods[0];
  const after = current.periods[0];
  const changes = [];
  addForecastChange(changes, "forecast-temperature", "NWS forecast temperature changed", before.temperatureF, after.temperatureF, T.forecastTemperatureF, "°F", now);
  addForecastChange(changes, "forecast-pop", "NWS precipitation chance changed", before.precipProbabilityPct, after.precipProbabilityPct, T.forecastPopPoints, " percentage points", now);
  addForecastChange(changes, "forecast-wind", "NWS forecast wind increased", before.windSpeedMph, after.windSpeedMph, T.forecastWindMph, " mph", now, true);

  const beforeWet = containsPrecipitation(before.shortForecast, before.detailedForecast);
  const afterWet = containsPrecipitation(after.shortForecast, after.detailedForecast);
  if (beforeWet !== afterWet) {
    changes.push(makeChange({ type: afterWet ? "forecast-wetter" : "forecast-drier", label: afterWet ? "NWS forecast now mentions precipitation" : "NWS forecast no longer mentions precipitation", minutes: 0, previousValue: before.shortForecast, currentValue: after.shortForecast, difference: null, unit: "", severity: "moderate", source: "NWS", detectedAt: now }));
  }
  const beforeHazard = containsHazard(before.shortForecast, before.detailedForecast);
  const afterHazard = containsHazard(after.shortForecast, after.detailedForecast);
  if (beforeHazard !== afterHazard) {
    changes.push(makeChange({ type: afterHazard ? "forecast-hazard-added" : "forecast-hazard-removed", label: afterHazard ? "Hazard wording appeared in NWS forecast" : "Hazard wording disappeared from NWS forecast", minutes: 0, previousValue: before.shortForecast, currentValue: after.shortForecast, difference: null, unit: "", severity: afterHazard ? "high" : "moderate", source: "NWS", detectedAt: now }));
  }
  if (before.startTime !== after.startTime || before.name !== after.name) {
    changes.push(makeChange({ type: "forecast-timing", label: "NWS forecast period timing changed", minutes: 0, previousValue: before.name, currentValue: after.name, difference: null, unit: "", severity: "minor", source: "NWS", detectedAt: now }));
  }
  return changes;
}

export function sourceHealthState({ lastSuccess, lastAttempt, consecutiveFailures = 0, enabled = true }, delayedMinutes, staleMinutes, now = Date.now()) {
  if (!enabled) return "Disabled";
  if (consecutiveFailures >= T.failedSourceConsecutiveFailures) return "Error";
  if (!lastSuccess) return consecutiveFailures ? "Error" : "Delayed";
  const age = now - Number(lastSuccess);
  if (age > staleMinutes * 60_000) return "Stale";
  if (age > delayedMinutes * 60_000 || (lastAttempt && Number(lastAttempt) > Number(lastSuccess))) return "Delayed";
  return "Healthy";
}

export function calculateOverallStatus({ changes = [], alerts = [], health = {} }) {
  const unhealthy = Object.values(health).some(item => ["Stale", "Error"].includes(item?.status));
  if (unhealthy) return { level: "Data issue", reason: "One or more Phase 1 data sources need attention." };
  if (alerts.length) return { level: "Attention recommended", reason: `${alerts.length} active official NWS alert${alerts.length === 1 ? "" : "s"}.` };
  if (changes.some(item => item.severity === "high")) return { level: "Attention recommended", reason: changes.find(item => item.severity === "high").label };
  if (changes.some(item => item.severity === "moderate")) return { level: "Monitoring", reason: changes.find(item => item.severity === "moderate").label };
  if (changes.length) return { level: "Minor changes", reason: changes[0].label };
  return { level: "Quiet", reason: "No meaningful changes detected in the available Phase 1 data." };
}

function addNumericChange(changes, current, previous, key, label, unit, threshold, minutes, increasesOnly = false) {
  const before = numberOrNull(previous?.[key]);
  const after = numberOrNull(current?.[key]);
  if (before === null || after === null) return;
  const difference = after - before;
  if ((increasesOnly && difference < threshold) || (!increasesOnly && Math.abs(difference) < threshold)) return;
  const direction = difference >= 0 ? "increased" : "decreased";
  changes.push(makeChange({ type: key, label: `${label} ${direction}`, minutes, previousValue: before, currentValue: after, difference, unit, severity: Math.abs(difference) >= threshold * 1.75 ? "moderate" : "minor", source: current.source, detectedAt: Date.now() }));
}

function addForecastChange(changes, type, label, beforeValue, afterValue, threshold, unit, now, increasesOnly = false) {
  const before = numberOrNull(beforeValue);
  const after = numberOrNull(afterValue);
  if (before === null || after === null) return;
  const difference = after - before;
  if ((increasesOnly && difference < threshold) || (!increasesOnly && Math.abs(difference) < threshold)) return;
  changes.push(makeChange({ type, label, minutes: 0, previousValue: before, currentValue: after, difference, unit, severity: "moderate", source: "NWS", detectedAt: now }));
}

function makeChange(change) {
  return { id: `${change.type}:${change.minutes}:${change.detectedAt}`, ...change };
}

function alertChange(type, label, alert, severity, detectedAt) {
  return makeChange({ type, label, minutes: 0, previousValue: null, currentValue: alert.event, difference: null, unit: "", severity, source: "NWS alerts", detectedAt, alertId: alert.id });
}

function alertComparable(alert) {
  return { event: alert.event, severity: alert.severity, urgency: alert.urgency, certainty: alert.certainty, headline: alert.headline, effective: alert.effective, expires: alert.expires, instruction: alert.instruction };
}

function severityRank(value) {
  return ({ Unknown: 0, Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 })[value] || 0;
}

function containsPrecipitation(...values) {
  return /rain|shower|storm|drizzle|snow|sleet|precip/i.test(values.filter(Boolean).join(" "));
}

function containsHazard(...values) {
  return /warning|watch|advisory|hazard|severe|flood|tornado|ice storm/i.test(values.filter(Boolean).join(" "));
}

function numberDifference(after, before) {
  const a = numberOrNull(after);
  const b = numberOrNull(before);
  return a === null || b === null ? null : a - b;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function deduplicateChanges(changes) {
  const seen = new Set();
  return changes.filter(change => {
    const key = `${change.type}:${change.minutes}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
