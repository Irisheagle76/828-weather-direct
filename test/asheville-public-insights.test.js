import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSummary, summaryMeters } from '../public/js/asheville-microscope-public-insights.js';

const station = (id, temperatureF, scope = 'core', precipitationRateInHr = 0) => ({id, name:id, scope, elevationFt:2100 + Number(id.replace(/\D/g,'')) * 50, quality:{usable:true}, observation:{temperatureF, precipitationRateInHr}});

test('public neighborhood summary excludes regional extremes and unusable observations', () => {
  const stations = Array.from({length:8}, (_, index) => station(`core${index}`, 70 + index / 2));
  stations.push(station('regional1', 95, 'corridor'), {...station('bad1', 100), quality:{usable:false}});
  const result = publicSummary({stations});
  assert.equal(result.core.length, 8);
  assert.equal(result.stats.max, 73.5);
  assert.equal(result.index, 0);
});

test('active rain observations remain in temperature summary but not the elevation fit', () => {
  const stations = Array.from({length:8}, (_, index) => station(`core${index}`, 70 + index / 2));
  stations[0].observation.precipitationRateInHr = 0.1;
  const result = publicSummary({stations});
  assert.equal(result.core.length, 8);
  assert.equal(result.dry.length, 7);
  assert.equal(result.trend.sampleCount, 7);
});

test('summary meters use observed ranges and a labeled gap scale', () => {
  const [middle, full, gap] = summaryMeters({ min: 70, q1: 72, q3: 76, max: 80, spread: 10 });
  assert.match(middle, /--meter-start:20\.0%;--meter-width:40\.0%/);
  assert.match(full, /Coolest to warmest reading/);
  assert.match(gap, /--meter-fill:100\.0%/);
  assert.match(gap, /10° scale/);
});

test('summary meters show a single point when all stations agree exactly', () => {
  const [middle, full, gap] = summaryMeters({ min: 75, q1: 75, q3: 75, max: 75, spread: 0 });
  assert.match(middle, /--meter-start:49\.0%;--meter-width:2\.0%/);
  assert.match(full, /avl-flat-meter/);
  assert.match(full, /Same reading at every station/);
  assert.match(gap, /--meter-fill:0\.0%/);
});
