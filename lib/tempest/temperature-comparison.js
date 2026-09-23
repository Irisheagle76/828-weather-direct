import { normalizeTempestDeviceObservation } from "./normalize-observation.js";

const MINUTE = 60_000;
const parts = (time) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
}).formatToParts(new Date(time)).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
const wallEpoch = (p) => Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

// Yesterday at the same Asheville clock time, including daylight-saving changes.
export function yesterdayAtSameTime(time) {
  const desired = wallEpoch(parts(time)) - 24 * 60 * MINUTE;
  let result = time - 24 * 60 * MINUTE;
  for (let i = 0; i < 4; i++) result += desired - wallEpoch(parts(result));
  return wallEpoch(parts(result)) === desired ? result : null;
}

export function closestTemperatureObservation(rows, target, tolerance = 5 * MINUTE) {
  if (!Number.isFinite(target)) return null;
  return (Array.isArray(rows) ? rows : []).map(normalizeTempestDeviceObservation)
    .filter(o => Number.isFinite(o.air_temperature) && Number.isFinite(o.timestamp) && Math.abs(o.timestamp - target) <= tolerance)
    .sort((a, b) => Math.abs(a.timestamp - target) - Math.abs(b.timestamp - target))[0] || null;
}

export function buildTemperatureComparison(current, rows, now = Date.now()) {
  if (!Number.isFinite(current?.timestamp) || !Number.isFinite(current?.air_temperature) ||
      Math.abs(now - current.timestamp) > 15 * MINUTE) return { available: false, reason: "current_observation_stale" };
  const target = yesterdayAtSameTime(current.timestamp);
  const yesterday = closestTemperatureObservation(rows, target);
  if (!yesterday) return { available: false, reason: "no_matching_history", targetTimestamp: target };
  return { available: true, source: "tempest_station_observations", current: {
    temperatureF: current.air_temperature * 1.8 + 32, timestamp: current.timestamp
  }, yesterday: { temperatureF: yesterday.air_temperature * 1.8 + 32, timestamp: yesterday.timestamp },
  targetTimestamp: target, differenceF: (current.air_temperature - yesterday.air_temperature) * 1.8 };
}
