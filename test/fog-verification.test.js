import test from 'node:test';
import assert from 'node:assert/strict';
import { makePrediction, validateLabel, matchLabels, verificationReport, skill } from '../lib/fog/verification.js';
import { createFogStore } from '../lib/fog/store.js';
import { createVerificationHandler } from '../lib/api-routes/tempest/fog-verification.js';
const now = Date.UTC(2026, 8, 29, 11);
const labelInput = { stationId: '127602', outcome: 'fog', source: 'direct', observedAt: new Date(now).toISOString(), locationConfirmed: true };
const station = { stationId: '127602', available: true, observedAt: now - 60000, version: 'wnc-fog-v1', low: 70, high: 80, coverage: 90, parts: [], missing: ['Rain'], humidity: 98 };
const prediction = { ...makePrediction(station, now), issuedAt: now - 3600000, targetAt: now };
const label = validateLabel(labelInput, now);
function memoryClient() {
  const data = new Map();
  return {
    async hsetnx(k, field, item) { const rows = data.get(k) || {}; if (!(field in rows)) rows[field] = structuredClone(item); data.set(k, rows); },
    async hset(k, rows) { data.set(k, { ...data.get(k), ...structuredClone(rows) }); },
    async hget(k, id) { return data.get(k)?.[id] ?? null; },
    async hgetall(k) { return data.get(k) || null; },
    // @upstash/redis returns an object keyed by requested fields, not an array.
    async hmget(k, ...ids) { return Object.fromEntries(ids.map(id => [id, data.get(k)?.[id] ?? null])); },
    async expireat() {}
  };
}
const response = () => ({ setHeader() {}, status(n) { this.code = n; return this; }, json(data) { this.data = data; return data; } });
test('ground truth requires location, valid past time, and explicit outcomes', () => {
  for (const change of [{ stationId: 'other' }, { observedAt: new Date(now + 1).toISOString() }, { outcome: 'dense_warning' }, { locationConfirmed: false }])
    assert.throws(() => validateLabel({ ...labelInput, ...change }, now));
  assert.equal(validateLabel({ ...labelInput, outcome: 'uncertain', locationConfirmed: false }, now).outcome, 'uncertain');
  assert.equal(label.id, validateLabel({ ...labelInput, notes: 'corrected' }, now).id);
});
test('webcam reviews require camera, actual frame time and landmark evidence', () => {
  const webcam = { ...labelInput, source: 'webcam_review', cameraId: 'north-asheville-south', frameAt: new Date(now).toISOString(), notes: 'Known valley landmarks visible.' };
  assert.equal(validateLabel(webcam, now).source, 'webcam_review');
  assert.equal(validateLabel({ ...webcam, outcome: 'uncertain', locationConfirmed: false, frameAt: null }, now).frameAt, null);
  for (const change of [{ notes: '' }, { cameraId: 'unknown' }, { frameAt: new Date(now - 600000).toISOString() }, { frameAt: new Date(now + 1).toISOString() }])
    assert.throws(() => validateLabel({ ...webcam, ...change }, now));
});
test('verification needs a prediction made about an hour beforehand at the same station', () => {
  assert.equal(matchLabels([prediction], [label]).length, 1);
  for (const change of [{ issuedAt: now, targetAt: now + 3600000 }, { targetAt: now - 600001 }, { stationId: '144737' }])
    assert.equal(matchLabels([{ ...prediction, ...change }], [label]).length, 0);
  assert.equal(matchLabels([prediction], [{ ...label, outcome: 'uncertain' }]).length, 0);
  assert.equal(matchLabels([prediction], []).length, 0);
  const nearest = { ...prediction, id: 'nearest', targetAt: now + 1000 };
  assert.equal(matchLabels([{ ...prediction, targetAt: now - 300000 }, nearest], [label])[0].prediction.id, 'nearest');
});
test('missing outcomes and repeated reports cannot inflate independent sample size', () => {
  const labels = [label, { ...label, id: 'again', observedAt: now + 60000 }, { ...label, id: 'unknown', outcome: 'uncertain' }];
  const r = verificationReport([prediction], labels)[0];
  assert.equal(r.independentEpisodes, 1); assert.equal(r.matchedReports, 2); assert.equal(r.uncertain, 1);
  assert.equal(r.candidate, null); assert.equal(r.baseline.hits, 1);
  assert.equal(verificationReport([{ ...prediction, version: 'different' }], labels)[0].independentEpisodes, 0);
});
test('held-out calibration uses later independent episodes and does not mutate the live model', () => {
  const labels = [], predictions = [];
  for (let i = 0; i < 40; i++) {
    const observedAt = now - (40 - i) * 86400000;
    const fog = i % 2 === 0;
    labels.push({ ...label, id: `l${i}`, observedAt, outcome: fog ? 'fog' : 'no_fog' });
    predictions.push({ ...prediction, id: `p${i}`, issuedAt: observedAt - 3600000, targetAt: observedAt, low: fog ? 55 : 20 });
  }
  const r = verificationReport(predictions, labels)[0];
  assert.equal(r.candidate.trainingCases, 28); assert.equal(r.candidate.holdoutCases, 12);
  assert.equal(r.candidate.threshold, 31); assert.equal(r.candidate.improvesHoldout, true);
  assert.equal(r.candidate.proposed.balancedAccuracy, 1); assert.equal(r.baseline.misses, 20);
  assert.equal(verificationReport(predictions, labels.map(l => ({ ...l, outcome: 'fog' })))[0].candidate, null);
});
test('confusion counts use conservative lower bound and distinguish misses from false alarms', () => {
  const pairs = [
    { prediction: { low: 70 }, label: { outcome: 'fog' } },
    { prediction: { low: 30, high: 90 }, label: { outcome: 'fog' } },
    { prediction: { low: 70 }, label: { outcome: 'no_fog' } },
    { prediction: { low: 20 }, label: { outcome: 'no_fog' } }
  ];
  assert.deepEqual(skill(pairs), { samples: 4, hits: 1, misses: 1, falseAlarms: 1, correctNegatives: 1, balancedAccuracy: 0.5 });
});
test('archive freezes original prediction, supports label correction, and loads older matching slots', async () => {
  const store = createFogStore(memoryClient());
  const issuedAt = now - 10 * 86400000 - 3600000;
  const old = makePrediction({ ...station, observedAt: issuedAt }, issuedAt);
  const saved = await store.savePrediction(old);
  assert.equal((await store.savePrediction({ ...old, low: 1 })).low, saved.low);
  const oldLabel = validateLabel({ ...labelInput, observedAt: new Date(issuedAt + 3600000).toISOString() }, now);
  await store.saveLabel(oldLabel);
  await store.saveLabel({ ...oldLabel, outcome: 'no_fog' });
  const data = await store.load(now);
  assert.equal(data.labels.length, 1); assert.equal(data.labels[0].outcome, 'no_fog');
  assert.equal(data.predictions.length, 1); assert.equal(data.predictions[0].low, 70);
});
test('sampling and label endpoints enforce roles and report persistence failures', async () => {
  const store = createFogStore(memoryClient());
  const handler = createVerificationHandler({ store, clock: () => now, admin: req => !!req.admin,
    sampler: req => !!req.sampler, loadFog: async () => ({ stations: [station] }) });
  let res = response(); await handler({ method: 'POST', query: { action: 'review' }, sampler: true, body: labelInput }, res); assert.equal(res.code, 401);
  res = response(); await handler({ method: 'POST', query: { action: 'sample' }, sampler: true }, res); assert.equal(res.data.saved, 1);
  res = response(); await handler({ method: 'POST', admin: true, body: labelInput }, res); assert.equal(res.data.ok, true);
  res = response(); await handler({ method: 'GET', admin: true }, res); assert.equal(res.data.reports[0].matchedReports, 0);
  const fail = createVerificationHandler({ admin: () => true, store: { async saveLabel() { throw new Error('private details'); } }, clock: () => now });
  res = response(); await fail({ method: 'POST', body: labelInput }, res); assert.equal(res.code, 503); assert.ok(!res.data.error.includes('private'));
});
test('unavailable or stale station readings cannot be archived as forecasts', () => {
  assert.equal(makePrediction({ ...station, observedAt: now - 600001 }, now), null);
  assert.equal(makePrediction({ ...station, available: false }, now), null);
});
