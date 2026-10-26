import test from 'node:test';
import assert from 'node:assert/strict';
import { visitorGuidance, visitorSummary } from '../public/js/fall/visitor-guidance.js';
const now = Date.parse('2026-10-25T12:00:00-04:00');
const holding = { primaryCategory: 'Color Preservation', diagnostics: { peakGust: 15, rainIn: .1, minimumF: 38, through: now + 3 * 86400000 } };
test('same gentle forecast gives different late-season trip advice by elevation', () => {
  const valley = visitorGuidance({ elevationFeet: 2100 }, holding, now);
  const ridge = visitorGuidance({ elevationFeet: 6000 }, holding, now);
  assert.match(valley.action, /around town/);
  assert.match(ridge.action, /mountain views/);
  assert.match(ridge.action, /changes earlier/);
  assert.match(valley.evidence, /Oct 28.*15 mph.*0.10 inches.*38°F/);
  assert.doesNotMatch(valley.title, /Retention|Favored/);
});
test('missing or stale assessment does not advise that leaves will last', () => {
  const result = visitorGuidance({ elevationFeet: 2100 }, { primaryCategory: null }, now);
  assert.match(result.explanation, /not enough fresh/);
  assert.equal(result.evidence, 'Weather outlook unavailable.');
});
test('leaf loss forecast gives weather timing and post-event checks without invented urgency', () => {
  const result = visitorGuidance({}, { ...holding, primaryCategory: 'Premature Leaf Drop' }, now);
  assert.match(result.title, /leaves could come down/);
  assert.match(result.action, /timing/);
  assert.match(result.action, /after the weather/);
  assert.doesNotMatch(result.action, /last chance|tomorrow/);
});
test('incomplete rain coverage is not presented as a reliable total', () => {
  const result = visitorGuidance({}, { ...holding, missingInputs: ['Rainfall coverage is incomplete.'] }, now);
  assert.doesNotMatch(result.evidence, /inches/);
});
test('regional summary explains remaining leaves versus bare branches', () => {
  assert.match(visitorSummary([{ consequence: holding }]), /will not bring leaves back/);
  assert.match(visitorSummary([]), /not enough fresh/);
});
