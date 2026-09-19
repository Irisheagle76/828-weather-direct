import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateHours,
  classifyHour,
  dewPointCeiling,
  temperatureCeiling,
} from '../lib/feelscore/summer-v1.6.js';

const pleasant = (overrides = {}) => ({
  temperatureF: 74,
  dewPointF: 52,
  windMph: 6,
  gustMph: 10,
  skyCoverPct: 30,
  precipProbabilityPct: 0,
  thunderProbabilityPct: 0,
  precipExpected: false,
  thunder: false,
  ...overrides,
});

test('temperature ranges are evaluated from the best category downward', () => {
  assert.equal(temperatureCeiling(70), 5);
  assert.equal(temperatureCeiling(79), 4);
  assert.equal(temperatureCeiling(82), 3);
  assert.equal(temperatureCeiling(86), 2);
  assert.equal(temperatureCeiling(89), 1);
  assert.equal(temperatureCeiling(91), 0);
});

test('dew point matrix imposes a ceiling and hard fail', () => {
  assert.equal(dewPointCeiling(59, 75), 3);
  assert.equal(dewPointCeiling(64, 82), 1);
  assert.equal(dewPointCeiling(67, 84), 0);
  assert.equal(dewPointCeiling(70, 70), 0);
});

test('goldilocks hour requires every strict input', () => {
  assert.equal(classifyHour(pleasant()).category, 5);
  assert.equal(classifyHour(pleasant({ precipProbabilitySource: 'no-precipitation-weather-code' })).category, 4);
  assert.equal(classifyHour(pleasant({ precipProbabilityPct: null })).category, 4);
  assert.equal(classifyHour(pleasant({ gustMph: 18 })).category, 4);
});

test('second-worst-hour aggregation matches v1.6 rule', () => {
  const hours = [4, 4, 3, 2].map((category) => ({ ...pleasant(), category }));
  assert.equal(aggregateHours(hours).category, 3);
});

test('persistent storm risk caps an otherwise pleasant period', () => {
  const hours = [4, 4, 4, 4].map((category, index) => ({
    ...pleasant(),
    category,
    thunderProbabilityPct: index < 2 ? 60 : 10,
  }));
  assert.equal(aggregateHours(hours).category, 1);
});

test('missing hourly data is not treated as unshaded', () => {
  const hours = [4, 4, null, 3].map((category) => ({ ...pleasant(), category }));
  assert.equal(aggregateHours(hours).category, null);
});
