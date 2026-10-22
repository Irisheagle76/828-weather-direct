import test from 'node:test';
import assert from 'node:assert/strict';
import { autumnWeight } from '../lib/drought-fire/autumn.js';
import { normalizeInputs } from '../lib/drought-fire/normalize.js';
import { buildFireOutlook } from '../lib/drought-fire/outlook.js';

const timestamp = Date.parse('2026-10-22T16:00:00Z');
const base = {precipDeficit90d_in:2.04,precipDeficitSeasonal_in:2.65,soilPercentile:27.46,
  daysSinceRain:9,tempAnomalyF:-18.7,tempF:69.4,rh:20,windGust:18.1,rainTodayIn:0,rainRateInHr:0};
const autumn = overrides => normalizeInputs({...base,timestamp,...overrides});

test('autumn ramps by Eastern calendar date, with no seasonal change outside the window', () => {
  for (const [date, expected] of [['2026-09-30',0],['2026-10-01',0],['2026-10-08',0.5],['2026-10-15',1],['2026-11-30',1],['2026-12-01',1],['2026-12-08',0.5],['2026-12-15',0],['2027-01-01',0]]) {
    assert.equal(autumnWeight(Date.parse(`${date}T12:00:00Z`)),expected);
  }
  assert.equal(autumnWeight(Date.parse('2026-10-02T02:00:00Z')),0);
  assert.equal(autumnWeight(undefined),0);
  assert.equal(autumn({timestamp:Date.parse('2026-07-22T12:00:00Z')}).FRI,normalizeInputs(base).FRI);
});

test('autumn prioritizes humidity/wind while preserving the drought score', () => {
  const legacy=normalizeInputs(base), fall=autumn();
  assert.ok(fall.FRI>legacy.FRI);
  assert.equal(fall.DSS,legacy.DSS);
  assert.ok(Math.abs(fall.components.weatherWeights.humidity-0.6)<1e-10);
  assert.equal(fall.components.weatherWeights.temperature,0);
  assert.equal(autumn({tempF:45}).FRI,autumn({tempF:85}).FRI);
  assert.ok(autumn({rh:15}).FRI>=autumn({rh:30}).FRI);
  assert.ok(autumn({windGust:25}).FRI>=autumn({windGust:10}).FRI);
});

test('dry-spell proxy requires dry air and observed dry days; never changes DSS', () => {
  assert.equal(autumn({daysSinceRain:null}).components.autumnFineFuelPoints,0);
  assert.equal(autumn({daysSinceRain:0}).components.autumnFineFuelPoints,0);
  assert.equal(autumn({rh:80}).components.autumnFineFuelPoints,0);
  assert.equal(autumn({rainTodayIn:0.1}).components.autumnFineFuelPoints,0);
  assert.equal(autumn({rainRateInHr:0.03}).components.autumnFineFuelPoints,0);
  assert.ok(autumn({daysSinceRain:14}).components.autumnFineFuelPoints > autumn({daysSinceRain:2}).components.autumnFineFuelPoints);
  assert.ok(autumn({daysSinceRain:90,rh:5,windGust:60}).components.autumnFineFuelPoints<=12);
});

test('fall is not an automatic rating floor; humid calm and wet weather remain suppressed', () => {
  assert.ok(autumn({rh:93,windGust:2.2,tempF:39}).FRI<20);
  assert.ok(autumn({rainTodayIn:0.35,windGust:30}).FRI<=28);
  assert.ok(autumn({rainRateInHr:0.05,windGust:30}).FRI<=28);
  assert.ok(autumn({precipDeficit90d_in:9,precipDeficitSeasonal_in:13,soilPercentile:1,daysSinceRain:24,rh:15,windGust:30,tempF:50}).FRI>=80);
});

test('hourly outlook uses the same seasonal calibration as the current score and wetting rain cancels the proxy', () => {
  const current={...base,rh:93,windGust:2.2};
  const hourly=Array.from({length:24},(_,i)=>({timestamp:timestamp+(i+1)*3600000,temperatureF:base.tempF,relativeHumidity:20,windGust:18.1,precipAmount:0}));
  const outlook=buildFireOutlook({hourly,current,background:{},now:timestamp});
  assert.equal(outlook.points[0].FRI,normalizeInputs({...current,timestamp}).FRI);
  assert.equal(outlook.points[1].FRI,autumn().FRI);
  assert.equal(outlook.peak.label,'Elevated');
  const wet=buildFireOutlook({hourly:hourly.map((h,i)=>({...h,precipAmount:i===0?0.35:0})),current,background:{},now:timestamp});
  assert.ok(wet.points.slice(1).every(p=>p.FRI<=28));
});
