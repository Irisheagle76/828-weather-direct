import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTemperatureTakeaway } from '../public/js/intel/temperature-takeaway.js';

const slot = (label, temperatureF) => ({ label, hour: { temperatureF } });

test('temperature takeaway follows the displayed forecast and preserves tomorrow timing', () => {
  assert.match(buildTemperatureTakeaway([slot('Now', 70), slot('8 PM', 67), slot('10 PM', 63)]).text, /63° by 10 PM, down 7° from now/);
  assert.match(buildTemperatureTakeaway([slot('Now', 60), slot('Tomorrow 8 AM', 59), slot('Tomorrow 3 PM', 72)]).text, /72° by tomorrow 3 PM, up 12° from now/);
  assert.match(buildTemperatureTakeaway([slot('Now', 70), slot('10 PM', 69)]).text, /close to the temperature now/);
});

test('missing temperatures do not create an outdoor takeaway', () => {
  assert.equal(buildTemperatureTakeaway([]), null);
  assert.equal(buildTemperatureTakeaway([slot('Now', 70)]), null);
  assert.equal(buildTemperatureTakeaway([slot('Now', null), slot('10 PM', 63)]), null);
  assert.equal(buildTemperatureTakeaway([slot('Now', 70), slot('10 PM', null)]), null);
});
