import test from 'node:test';
import assert from 'node:assert/strict';
import { comfortExplanation, bestWindowSummary } from '../public/js/intel/feelscore-insight.js';

test('comfort explanation uses actual ingredients and keeps rain visible', () => {
  const inputs = { currentHour: { temperatureF: 68, dewpointF: 57, windSpeed: 2 }, score: 95 };
  const good = comfortExplanation(inputs);
  assert.equal(good.title, 'Why it feels good');
  assert.match(good.text, /Mild temperatures, manageable humidity, and very little wind/);
  assert.doesNotMatch(good.text, /sun|cloud/i);
  const wet = comfortExplanation({ ...inputs, precipOverride: { mode: 'active' } });
  assert.equal(wet.title, 'Why it feels this way');
  assert.match(wet.text, /Rain is affecting outdoor plans/);
  const difficult = comfortExplanation({ currentHour: { temperatureF: 90, dewpointF: 72, windSpeed: 20, windGust: 30 }, score: 40 });
  assert.match(difficult.text, /Hot temperatures, muggy air, and strong gusts/);
  assert.equal(comfortExplanation().text, 'Waiting for current weather readings.');
});

const model = (start, end, peak = 98) => ({ best: { start: Date.parse(start), end: Date.parse(end), peak } });

test('best window labels tomorrow and midnight explicitly using the shared curve peak', () => {
  const now = Date.parse('2026-10-12T22:00:00Z');
  const next = bestWindowSummary(model('2026-10-13T13:00:00Z', '2026-10-13T15:00:00Z'), now);
  assert.equal(next.window, 'Tomorrow, 9 AM–11 AM');
  assert.equal(next.detail, 'Peak FeelScore 98 · Ideal');
  const overnight = bestWindowSummary(model('2026-10-13T03:00:00Z', '2026-10-13T05:00:00Z', 82), now);
  assert.equal(overnight.window, 'Today, 11 PM–Tomorrow 1 AM');
  assert.equal(overnight.detail, 'Peak FeelScore 82 · Pleasant');
  assert.equal(bestWindowSummary(null), null);
});

test('tomorrow remains a calendar date across the fall DST transition', () => {
  const next = bestWindowSummary(model('2026-11-01T14:00:00Z', '2026-11-01T16:00:00Z'), Date.parse('2026-11-01T03:30:00Z'));
  assert.equal(next.window, 'Tomorrow, 9 AM–11 AM');
});
