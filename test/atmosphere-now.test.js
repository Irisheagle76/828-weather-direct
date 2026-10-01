import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAtmosphereNow } from '../public/js/intel/atmosphere-now.js';
import { CAMERA_REGISTRY } from '../lib/sky/camera-registry.js';
const now = 1_800_000_000_000;
const station = { timestamp: now, air_temperature: 18, dew_point: 17, relative_humidity: 94, solar_radiation: 0, wind_avg: 2, wind_gust: 5, precipRate: 0 };
test('surface saturation is qualified, not asserted as fog', () => {
  const read = buildAtmosphereNow(station, { now });
  assert.match(read.summary, /close to saturation/);
  assert.match(read.cards[0].detail, /needed to confirm fog/);
});
test('old, future, and missing observations never appear current', () => {
  for (const timestamp of [now - 180001, now + 60001, null]) {
    const read = buildAtmosphereNow({ ...station, timestamp }, { now });
    assert.equal(read.available, false);
    assert.ok(read.cards.every(c => c.value === 'Unavailable'));
  }
});
test('missing measurements are not zero or dry observations', () => {
  const read = buildAtmosphereNow({ timestamp: now }, { now });
  assert.ok(read.cards.slice(0, 4).every(c => c.value === 'Unavailable'));
});
test('rain freshness is independent; lightning takes summary priority', () => {
  const read = buildAtmosphereNow({ ...station, precipRate: 25.4, rainRateObservedAt: now - 200000, lightningStrikeLastAt: now - 60000, lightningStrikeDistance: 10 }, { now });
  assert.equal(read.cards[3].value, 'Unavailable');
  assert.match(read.summary, /lightning/);
  assert.match(read.cards[4].detail, /6.2 miles/);
});
test('nighttime solar reading cannot become a cloud inference', () => {
  const read = buildAtmosphereNow(station, { now, daylight: false });
  assert.equal(read.cards[1].value, '0 W/m²');
  assert.match(read.cards[1].detail, /does not indicate cloud/);
});
test('North Asheville uses the supplied analysis view without invented side bearings', () => {
  const camera = CAMERA_REGISTRY.find(c => c.id === 'north-asheville-south');
  assert.match(camera.snapshotUrl, /1ceufgi3xpyusiox5/);
  assert.deepEqual(camera.orientation, { center: 'south-southeast' });
});
