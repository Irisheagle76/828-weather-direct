import { ELEVATION_BANDS } from "./config.js";

export const HOUR_MS = 3600000;
const datePartsFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" });
const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" });
export const localHour = (timestamp) => Number(hourFormat.format(new Date(timestamp)));
// Noon-to-noon periods keep evening and following morning freezes together.
export function coldPeriod(timestamp) {
  const date = new Date(timestamp);
  const parts = datePartsFormat.formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
  const key = new Date(Date.UTC(values.year, values.month - 1, values.day - (localHour(timestamp) < 12 ? 1 : 0)));
  return key.toISOString().slice(0, 10);
}
export function elevationBand(site) {
  if ((site.destinationId || site.id) === "asheville") return "asheville-valley";
  const elevation = site.elevationFeet;
  if (!Number.isFinite(elevation) || elevation < 2000) return null;
  return elevation >= 6000 ? "6000-plus" : `${Math.floor(elevation / 1000) * 1000}-${(Math.floor(elevation / 1000) + 1) * 1000}`;
}

export function summarizeTemperatureHistory(batches = [], { now = Date.now(), anchors = [] } = {}) {
  const start = now - 14 * 86400000;
  const samples = batches.flatMap((batch) => Array.isArray(batch?.samples) ? batch.samples : []);
  samples.push(...anchors.filter((anchor) => anchor.retrievalMode === "live" && anchor.health?.usable !== false).map((anchor) => ({ ...anchor, stationId: anchor.id, observedTemperatureF: anchor.temperatureF, healthStatus: anchor.health?.status || "unknown" })));
  const unique = new Map();
  for (const sample of samples) {
    const at = Date.parse(sample?.observedAt);
    if (!Number.isFinite(at) || at < start || at > now || !Number.isFinite(sample.observedTemperatureF) ||
      sample.observedTemperatureF < -40 || sample.observedTemperatureF > 110 || !sample.stationId ||
      !Number.isFinite(sample.effectiveWeight) || sample.effectiveWeight < 0.5 || sample.crossStationStatus === "outlier" ||
      !["healthy", "unknown"].includes(sample.healthStatus)) continue;
    unique.set(`${sample.stationId}:${at}`, { ...sample, at });
  }
  return {
    start: new Date(start).toISOString(), end: new Date(now).toISOString(),
    status: unique.size ? "available" : "unavailable",
    bands: ELEVATION_BANDS.map((band) => {
      const values = [...unique.values()].filter((sample) => elevationBand(sample) === band.id);
      const periods = new Set(values.map((sample) => coldPeriod(sample.at)));
      const freezing = new Set(values.filter((sample) => sample.observedTemperatureF <= 32).map((sample) => coldPeriod(sample.at)));
      const hard = new Set(values.filter((sample) => sample.observedTemperatureF <= 28).map((sample) => coldPeriod(sample.at)));
      return {
        id: band.id, samples: values.length, sampledPeriods: periods.size,
        freezePeriods: freezing.size, hardFreezePeriods: hard.size,
        minimumF: values.length ? Math.min(...values.map((sample) => sample.observedTemperatureF)) : null,
        stations: [...new Set(values.map((sample) => sample.stationId))],
        lastObservedAt: values.length ? new Date(Math.max(...values.map((sample) => sample.at))).toISOString() : null
      };
    })
  };
}
