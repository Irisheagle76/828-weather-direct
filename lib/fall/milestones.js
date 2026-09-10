import { ELEVATION_BANDS } from "../../public/js/fall/config.js";

export const FALL_THRESHOLDS = Object.freeze([40, 36, 32, 28]);
const MIN_EFFECTIVE_WEIGHT = 0.5;
const MIN_CONFIRMATION_GAP_MS = 20 * 60 * 1000;
const MAX_CONFIRMATION_GAP_MS = 3 * 60 * 60 * 1000;

export function fallSeasonYear(now = Date.now()) {
  const parts = easternDateParts(now);
  return parts.month >= 8 && parts.month <= 12 ? parts.year : null;
}

export function createMilestoneArchive(season, now = Date.now()) {
  const timestamp = new Date(now).toISOString();
  return {
    schemaVersion: 1,
    season,
    createdAt: timestamp,
    trackingStartedAt: timestamp,
    updatedAt: timestamp,
    lastEvaluatedAt: null,
    confirmationPolicy: "two-consecutive-samples-or-two-independent-stations",
    bands: ELEVATION_BANDS.map((band) => ({
      elevationBand: band.id,
      label: band.label,
      first40: null,
      first36: null,
      first32: null,
      first28: null,
      pending: {}
    }))
  };
}

export function evaluateMilestones(existing, observations, { now = Date.now(), season = fallSeasonYear(now) } = {}) {
  if (!season) return { archive: existing || null, changed: false, newlyRecorded: [], eligibleObservations: 0, skipped: "outside-fall-season" };
  const archive = normalizeArchive(existing, season, now);
  const timestamp = new Date(now).toISOString();
  const eligible = eligibleObservations(observations, now);
  const newlyRecorded = [];
  let changed = archive.lastEvaluatedAt !== timestamp;

  archive.lastEvaluatedAt = timestamp;
  for (const band of archive.bands) {
    const bandObservations = eligible.filter((observation) => belongsToBand(observation, band.elevationBand));
    for (const threshold of FALL_THRESHOLDS) {
      const key = `first${threshold}`;
      if (band[key]) {
        if (band.pending[key]) {
          delete band.pending[key];
          changed = true;
        }
        continue;
      }

      const crossings = bandObservations
        .filter((observation) => observation.temperatureF <= threshold)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt));
      const stationIds = [...new Set(crossings.map((observation) => observation.stationId))];

      if (stationIds.length >= 2) {
        const event = milestoneEvent(threshold, crossings, timestamp, "two-independent-stations");
        band[key] = event;
        delete band.pending[key];
        newlyRecorded.push({ elevationBand: band.elevationBand, ...event });
        changed = true;
        continue;
      }

      const crossing = crossings[0];
      const pending = band.pending[key];
      if (!crossing) {
        if (pending) {
          delete band.pending[key];
          changed = true;
        }
        continue;
      }

      const gap = pending ? Date.parse(crossing.observedAt) - Date.parse(pending.observedAt) : null;
      if (pending && pending.stationId === crossing.stationId && gap >= MIN_CONFIRMATION_GAP_MS && gap <= MAX_CONFIRMATION_GAP_MS) {
        const event = milestoneEvent(threshold, [pending, crossing], timestamp, "two-consecutive-samples");
        band[key] = event;
        delete band.pending[key];
        newlyRecorded.push({ elevationBand: band.elevationBand, ...event });
        changed = true;
      } else if (!pending || pending.stationId !== crossing.stationId || gap < 0 || gap > MAX_CONFIRMATION_GAP_MS) {
        band.pending[key] = crossing;
        changed = true;
      }
    }
  }

  archive.updatedAt = timestamp;
  return { archive, changed, newlyRecorded, eligibleObservations: eligible.length, skipped: null };
}

export function publicMilestoneArchive(archive) {
  if (!archive) return null;
  return {
    schemaVersion: archive.schemaVersion,
    season: archive.season,
    trackingStartedAt: archive.trackingStartedAt || archive.createdAt,
    updatedAt: archive.updatedAt,
    lastEvaluatedAt: archive.lastEvaluatedAt,
    confirmationPolicy: archive.confirmationPolicy,
    bands: (archive.bands || []).map(({ pending, ...band }) => band)
  };
}

function normalizeArchive(existing, season, now) {
  const fresh = createMilestoneArchive(season, now);
  if (!existing || Number(existing.season) !== Number(season) || !Array.isArray(existing.bands)) return fresh;
  const existingById = new Map(existing.bands.map((band) => [band.elevationBand, band]));
  return {
    ...fresh,
    ...existing,
    schemaVersion: 1,
    season,
    bands: fresh.bands.map((band) => ({ ...band, ...(existingById.get(band.elevationBand) || {}), pending: { ...(existingById.get(band.elevationBand)?.pending || {}) } }))
  };
}

function eligibleObservations(observations, now) {
  return (observations?.anchors || []).map((anchor) => {
    const observedMs = Date.parse(anchor.observedAt);
    return {
      stationId: anchor.id,
      stationName: anchor.name,
      destinationId: anchor.destinationId,
      elevationFeet: finite(anchor.elevationFeet),
      temperatureF: finite(anchor.temperatureF),
      observedAt: Number.isFinite(observedMs) ? new Date(observedMs).toISOString() : null,
      source: anchor.source || null,
      effectiveWeight: finite(anchor.effectiveWeight ?? anchor.weight),
      retrievalMode: anchor.retrievalMode,
      crossStationStatus: anchor.crossStationStatus,
      healthStatus: anchor.health?.status || null,
      healthUsable: anchor.health ? anchor.health.usable === true : true
    };
  }).filter((observation) => {
    const ageMs = now - Date.parse(observation.observedAt);
    return observation.healthUsable && observation.retrievalMode === "live" && observation.crossStationStatus !== "outlier" &&
      observation.effectiveWeight >= MIN_EFFECTIVE_WEIGHT && Number.isFinite(observation.elevationFeet) && Number.isFinite(observation.temperatureF) &&
      Number.isFinite(ageMs) && ageMs >= -5 * 60 * 1000 && ageMs <= MAX_CONFIRMATION_GAP_MS;
  });
}

function belongsToBand(observation, bandId) {
  const elevation = observation.elevationFeet;
  if (bandId === "asheville-valley") return observation.destinationId === "asheville";
  if (observation.destinationId === "asheville") return false;
  if (bandId === "6000-plus") return elevation >= 6000;
  if (bandId === "5000-6000") return elevation >= 5000 && elevation < 6000;
  if (bandId === "4000-5000") return elevation >= 4000 && elevation < 5000;
  if (bandId === "3000-4000") return elevation >= 3000 && elevation < 4000;
  if (bandId === "2000-3000") return elevation >= 2000 && elevation < 3000;
  return false;
}

function milestoneEvent(thresholdF, observations, recordedAt, confirmation) {
  const evidence = observations.map((observation) => ({
    stationId: observation.stationId,
    stationName: observation.stationName,
    observedAt: observation.observedAt,
    temperatureF: observation.temperatureF,
    elevationFeet: observation.elevationFeet,
    source: observation.source
  }));
  const firstObservedAt = evidence.map((item) => item.observedAt).sort()[0];
  return {
    thresholdF,
    date: easternIsoDate(firstObservedAt),
    firstObservedAt,
    confirmedAt: recordedAt,
    lowestTemperatureF: Math.min(...evidence.map((item) => item.temperatureF)),
    confirmation,
    evidence
  };
}

function easternDateParts(value) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(value));
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function easternIsoDate(value) {
  const parts = easternDateParts(value);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
