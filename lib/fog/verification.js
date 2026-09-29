import { FOG_STATIONS } from '../tempest/fog-index.js';
export const LEAD_MS = 3600000;
export const MATCH_TOLERANCE_MS = 600000;
export const SLOT_MS = 300000;
const ids = new Set(FOG_STATIONS.map(s => s.stationId));
export const dayKey = at => new Date(at).toISOString().slice(0, 10);
export const predictionId = (stationId, at) => `${stationId}:${Math.floor(at / SLOT_MS)}`;

export function makePrediction(station, issuedAt) {
  if (!ids.has(station?.stationId) || !station.available || !Number.isFinite(station.observedAt) ||
      issuedAt - station.observedAt > 600000 || station.observedAt > issuedAt + 60000 ||
      !Number.isFinite(station.low) || !Number.isFinite(station.high)) return null;
  return { id: predictionId(station.stationId, issuedAt), stationId: station.stationId,
    issuedAt, targetAt: issuedAt + LEAD_MS, observedAt: station.observedAt,
    version: station.version, low: station.low, high: station.high, coverage: station.coverage,
    parts: station.parts, humidity: station.humidity, missing: station.missing };
}

export function validateLabel(input, now = Date.now()) {
  const s = input || {};
  if (!ids.has(s.stationId)) throw new Error('Select a supported station.');
  if (!['fog', 'no_fog', 'uncertain'].includes(s.outcome)) throw new Error('Select fog, no fog, or uncertain.');
  if (!['direct', 'webcam_review'].includes(s.source)) throw new Error('Select an observation source.');
  const observedAt = Date.parse(s.observedAt);
  if (!Number.isFinite(observedAt) || observedAt > now || now - observedAt > 30 * 86400000)
    throw new Error('Observation time must be in the past 30 days, not the future.');
  if (s.outcome !== 'uncertain' && s.locationConfirmed !== true)
    throw new Error('Confirm that you could see the selected neighborhood at that time, or choose uncertain.');
  const notes = String(s.notes || '').trim();
  if (notes.length > 500) throw new Error('Keep notes within 500 characters.');
  let cameraId = null, frameAt = null;
  if (s.source === 'webcam_review') {
    if (!['downtown-asheville-west', 'north-asheville-south'].includes(s.cameraId)) throw new Error('Select a registered camera.');
    cameraId = s.cameraId;
    frameAt = s.frameAt ? Date.parse(s.frameAt) : null;
    if ((frameAt === null && s.outcome !== 'uncertain') || (frameAt !== null &&
        (!Number.isFinite(frameAt) || frameAt > now || Math.abs(frameAt - observedAt) > 300000)))
      throw new Error('The camera frame time must be within five minutes of the observation and not in the future.');
    if (!notes) throw new Error('Describe the visible landmarks and why this camera supports the observation.');
  }
  // One editable label per station/minute; repeated clicks cannot create extra evidence.
  return { id: `${s.stationId}:${Math.floor(observedAt / 60000)}`, stationId: s.stationId,
    observedAt, outcome: s.outcome, source: s.source, locationConfirmed: s.locationConfirmed === true,
    cameraId, frameAt, notes, reviewedAt: now };
}

export function matchLabels(predictions, labels) {
  return labels.filter(l => l.outcome !== 'uncertain' && l.locationConfirmed).flatMap(label => {
    const candidates = predictions.filter(p => p.stationId === label.stationId &&
      p.issuedAt < label.observedAt && Math.abs(p.targetAt - label.observedAt) <= MATCH_TOLERANCE_MS);
    candidates.sort((a, b) => Math.abs(a.targetAt - label.observedAt) - Math.abs(b.targetAt - label.observedAt) || a.issuedAt - b.issuedAt);
    return candidates.length ? [{ prediction: candidates[0], label }] : [];
  });
}

function episode(at) {
  // Noon-to-noon Asheville episodes keep a single overnight event together.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at - 12 * 3600000));
}
export function skill(pairs, threshold = 61) {
  let hits = 0, misses = 0, falseAlarms = 0, correctNegatives = 0;
  for (const { prediction: p, label: l } of pairs) {
    const yes = p.low >= threshold;
    if (l.outcome === 'fog') yes ? hits++ : misses++;
    else yes ? falseAlarms++ : correctNegatives++;
  }
  const sensitivity = hits + misses ? hits / (hits + misses) : null;
  const specificity = falseAlarms + correctNegatives ? correctNegatives / (falseAlarms + correctNegatives) : null;
  return { samples: pairs.length, hits, misses, falseAlarms, correctNegatives,
    balancedAccuracy: sensitivity === null || specificity === null ? null : (sensitivity + specificity) / 2 };
}

export function verificationReport(predictions, labels) {
  const matched = matchLabels(predictions, labels);
  return FOG_STATIONS.map(station => {
    // Keep versions separate; one preselected (earliest) case per overnight episode.
    const pairs = matched.filter(p => p.label.stationId === station.stationId && p.prediction.version === 'wnc-fog-v1')
      .sort((a, b) => a.label.observedAt - b.label.observedAt);
    const episodes = new Map();
    for (const pair of pairs) { const key = episode(pair.label.observedAt); if (!episodes.has(key)) episodes.set(key, pair); }
    const independent = [...episodes.values()];
    const split = Math.floor(independent.length * 0.7);
    const train = independent.slice(0, split), holdout = independent.slice(split);
    const enough = (rows, minimum) => rows.filter(p => p.label.outcome === 'fog').length >= minimum && rows.filter(p => p.label.outcome === 'no_fog').length >= minimum;
    let candidate = null;
    if (independent.length >= 30 && enough(train, 5) && enough(holdout, 3)) {
      const options = [61, 31, 41, 51, 71, 81].map(threshold => ({ threshold, score: skill(train, threshold).balancedAccuracy }));
      options.sort((a, b) => b.score - a.score);
      const threshold = options[0].threshold;
      const baseline = skill(holdout), proposed = skill(holdout, threshold);
      candidate = { threshold, trainingCases: train.length, holdoutCases: holdout.length,
        baseline, proposed, improvesHoldout: proposed.balancedAccuracy > baseline.balancedAccuracy,
        status: 'Review only; not applied to the live index' };
    }
    const stationLabels = labels.filter(l => l.stationId === station.stationId);
    return { ...station, version: 'wnc-fog-v1', labels: stationLabels.length,
      uncertain: stationLabels.filter(l => l.outcome === 'uncertain').length,
      matchedReports: pairs.length, independentEpisodes: independent.length,
      baseline: skill(independent), direct: skill(independent.filter(p => p.label.source === 'direct')),
      webcam: skill(independent.filter(p => p.label.source === 'webcam_review')), candidate,
      readiness: candidate ? 'Candidate evaluated on later episodes' : 'Need 30 episodes, with at least 5 fog and 5 no-fog training cases plus 3 of each in the later holdout.' };
  });
}
