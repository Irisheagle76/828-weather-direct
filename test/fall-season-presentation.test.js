import test from 'node:test';
import assert from 'node:assert/strict';
import { seasonPresentation } from '../public/js/fall/season-presentation.js';
import { estimatePeakTiming } from '../public/js/fall/peak-timing.js';

const sites = [{ name: 'Valley', elevationFeet: 2100 }, { name: 'Summit', elevationFeet: 6000 }, { name: 'Unknown' }];
const peak = estimatePeakTiming({ seasonYear: 2026 });
test('timing window remains current through its final Eastern calendar day', () => {
  assert.equal(seasonPresentation(peak, sites, Date.parse('2026-10-21T03:59:00Z')).pastWindow, false);
  assert.equal(seasonPresentation(peak, sites, Date.parse('2026-10-21T04:00:00Z')).pastWindow, true);
});
test('late-season color suggestions favor lower elevations without changing weather scores', () => {
  const result = seasonPresentation(peak, sites, Date.parse('2026-10-25T16:00:00Z'));
  assert.match(result.heading, /remaining color/);
  assert.match(result.candidates, /Valley/);
  assert.doesNotMatch(result.candidates, /Summit|Unknown/);
  assert.match(result.candidates, /not confirmed color/);
});
test('early season resets with the next season and November never declares observed leaf-off', () => {
  const next = seasonPresentation(estimatePeakTiming({ seasonYear: 2027 }), sites, Date.parse('2027-09-20T16:00:00Z'));
  assert.equal(next.pastWindow, false);
  assert.match(next.candidates, /Summit/);
  const november = seasonPresentation(peak, sites, Date.parse('2026-11-15T16:00:00Z'));
  assert.match(november.heading, /Late-autumn/);
  assert.match(november.intro, /cannot confirm/);
});
