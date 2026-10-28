import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSkyConditionRead } from '../public/js/intel/sky-read.js';
import { generateSkyLanguage } from '../public/js/intel/sky-language.js';

const sunsetAt = '2026-10-27T22:38:00Z';
const sunriseAt = '2026-10-27T11:48:00Z';
function read(now, extras = {}) {
  return buildSkyConditionRead({
    now: Date.parse(now), verbosity: 'narrative',
    weatherContext: { sunriseAt, sunsetAt, cloudCover: 0 },
    camera: { timestamp: now, metrics: { mode: 'day', cloudCoverWest: 0, sunlightDetected: true, sunlightLevel: 'strong' },
      observations: [{ source: 'city-lights', timestamp: now, available: true, quality: 'good', qualityScore: .9,
        confidence: .9, coverageFraction: 0, skyColor: 'blue', sunVisibility: 'mostly_unobstructed' }] },
    ...extras
  });
}
for (const now of ['2026-10-28T01:21:00Z', '2026-10-27T09:21:00Z']) {
  test(`nighttime overrides clear forecasts and bright camera pixels at ${now}`, () => {
    const result = read(now);
    assert.equal(result.label, 'Night');
    assert.equal(result.narrative.headline, 'Night over Asheville');
    assert.equal(result.cloudMetric, '--');
    assert.equal(result.sunlightMetric, 'After sunset');
    assert.equal(result.skyIntel.sunlightDetected, false);
    assert.equal(result.skyState.sunsetStructure.lightCanReachHorizon, false);
    assert.deepEqual(result.skyState.debug.camerasUsed, []);
    assert.ok(result.skyState.cameraViews.every(view => view.status === 'night' && view.coverageFraction === null));
    assert.doesNotMatch(result.narrative.detail, /blue|sunshine|sunlight|clean light/i);
  });
}
test('delayed live narrative cannot override nighttime', () => {
  const result = read('2026-10-28T01:21:00Z', { useLiveNarrative: true,
    liveNarrative: { headline: 'Bright blue sky', detail: 'Sunshine' } });
  assert.equal(result.narrative.headline, 'Night over Asheville');
});
test('night camera remains conservative when forecast timing is unavailable', () => {
  const result = read('2026-10-28T01:21:00Z', { weatherContext: null,
    camera: { timestamp: '2026-10-28T01:21:00Z', metrics: { mode: 'night', cloudCoverWest: 0 } } });
  assert.equal(result.label, 'Night');
  assert.equal(result.cloudMetric, '--');
});
test('daylight and afterglow retain their own descriptions', () => {
  assert.notEqual(read('2026-10-27T17:00:00Z').label, 'Night');
  assert.match(read('2026-10-27T23:00:00Z').narrative.headline, /Last light/);
});
test('language independently rejects daytime claims for a night solar phase', () => {
  const result = generateSkyLanguage({ overall: 'clear', solarRead: { phase: 'night' } }, { verbosity: 'narrative' });
  assert.equal(result.headline, 'Night over Asheville');
});
