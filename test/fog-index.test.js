import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFogIndex, fogHistory } from '../lib/tempest/fog-index.js';
import { createFogHandler } from '../lib/api-routes/tempest/fog.js';
const now = Date.UTC(2026, 8, 29, 9);
const current = { timestamp: now, air_temperature: 12, dew_point: 11.6, relative_humidity: 98, wind_avg: 0.4, station_pressure: 940 };
const history = Array.from({ length: 1440 }, (_, i) => ({ ...current,
  timestamp: now - (1439 - i) * 60000, air_temperature: 17, station_pressure: 937,
  precipAccum: 0.003, reportIntervalMinutes: 1 }));
test('six weighted inputs total 100, with truthful missing-cloud range', () => {
  const full = buildFogIndex(current, { now, history, cloudCover: 10 });
  assert.equal(full.low, 100); assert.equal(full.high, 100); assert.equal(full.coverage, 100);
  const partial = buildFogIndex(current, { now, history });
  assert.equal(partial.low, 95); assert.equal(partial.high, 100); assert.equal(partial.coverage, 95);
  assert.deepEqual(partial.missing, ['Cloud cover']);
});
test('missing history is uncertainty, never dry rain or a fabricated trend', () => {
  const value = buildFogIndex(current, { now });
  assert.equal(value.low, 60); assert.equal(value.high, 100); assert.equal(value.coverage, 60);
  assert.equal(value.band, 'Moderate–High');
  assert.equal(fogHistory(current, history.slice(1)).rain24hIn, null);
  assert.equal(fogHistory(current, history.filter((_, i) => i !== 700)).rain24hIn, null);
  assert.equal(fogHistory(current, history.map(s => ({ ...s, reportIntervalMinutes: 5 }))).rain24hIn, null);
  assert.equal(fogHistory(current, [...history, history[0]]).rain24hIn, fogHistory(current, history).rain24hIn);
});
test('stale, future, missing and invalid observations cannot become low risk', () => {
  for (const change of [{ timestamp: now - 600001 }, { timestamp: now + 60001 }, { wind_avg: null }, { relative_humidity: 101 }, { dew_point: 14 }, { air_temperature: NaN }])
    assert.equal(buildFogIndex({ ...current, ...change }, { now }).available, false);
});
test('dry air and stronger wind constrain radiation-fog bonuses; zero wind is valid', () => {
  assert.ok(buildFogIndex({ ...current, dew_point: 8 }, { now, history, cloudCover: 0 }).high <= 30);
  assert.ok(buildFogIndex({ ...current, wind_avg: 4 }, { now, history, cloudCover: 0 }).high <= 60);
  assert.equal(buildFogIndex({ ...current, wind_avg: 0 }, { now }).parts[1].points, 20);
});
test('trends use same-station pressure and actual timestamp windows', () => {
  const result = fogHistory(current, history);
  assert.equal(result.cooling3hF, 9); assert.equal(result.pressureRise6hHpa, 3);
  assert.equal(fogHistory(current, [{ ...current, timestamp: now - 4 * 3600000 }]).cooling3hF, null);
  assert.equal(fogHistory(current, history.map(s => ({ ...s, station_pressure: null, sea_level_pressure: 1030 }))).pressureRise6hHpa, null);
});
function response() { return { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return data; } }; }
test('endpoint isolates stations, uses dedicated JCC token, caches and tolerates lost history', async () => {
  let calls = 0;
  const handler = createFogHandler({ clock: () => now, env: { TEMPEST_TOKEN: 'primary-secret', JCC_TEMPEST_TOKEN: 'jcc-secret' }, fetcher: async url => {
    calls++;
    if (url.pathname.includes('/stations/')) throw new Error('token=secret');
    const id = url.pathname.split('/').at(-1);
    assert.equal(url.searchParams.get('token'), id === '144737' ? 'jcc-secret' : 'primary-secret');
    return { ok: true, json: async () => ({ status: { status_code: 0 }, station_id: id,
      obs: [{ ...current, air_temperature: id === '144737' ? 16 : 12 }] }) };
  } });
  const res = response(); await handler({ method: 'GET' }, res);
  assert.equal(res.data.stations[0].low, 60); assert.ok(res.data.stations[1].high <= 30);
  assert.ok(!JSON.stringify(res.data).includes('secret'));
  const before = calls; await handler({ method: 'GET' }, response()); assert.equal(calls, before);
  const invalid = response(); await handler({ method: 'POST' }, invalid); assert.equal(invalid.code, 405);
});
test('one station failure leaves the other available, wrong identities are rejected', async () => {
  const handler = createFogHandler({ clock: () => now, env: { TEMPEST_TOKEN: 'secret' }, fetcher: async url => {
    const id = url.pathname.split('/').at(-1);
    return { ok: true, json: async () => ({ status: { status_code: 0 }, station_id: id === '127602' ? 'wrong' : id, obs: [current] }) };
  } });
  const res = response(); await handler({}, res);
  assert.equal(res.data.stations[0].available, false); assert.equal(res.data.stations[1].available, true);
});
test('endpoint integrates raw history and fresh modeled clouds without exposing credentials', async () => {
  const handler = createFogHandler({ clock: () => now, env: { TEMPEST_TOKEN: 'secret' }, fetcher: async url => {
    let data;
    if (url.hostname === 'api.open-meteo.com') {
      assert.equal(url.searchParams.has('token'), false);
      data = { current: { time: now / 1000, cloud_cover: 0 }, current_units: { cloud_cover: '%' } };
    } else if (url.pathname.includes('/observations/device/')) {
      data = { status: { status_code: 0 }, type: 'obs_st', device_id: 42,
        obs: history.map(s => [s.timestamp / 1000, 0, s.wind_avg, 1, 0, 3, s.station_pressure, s.air_temperature, s.relative_humidity, 0, 0, 0, s.precipAccum, 0, 0, 0, 2.5, 1]) };
    } else if (url.pathname.includes('/stations/')) {
      data = { status: { status_code: 0 }, stations: [{ station_id: url.pathname.split('/').at(-1), devices: [{ device_type: 'ST', device_id: 42 }] }] };
    } else data = { status: { status_code: 0 }, station_id: url.pathname.split('/').at(-1), obs: [current] };
    return { ok: true, json: async () => data };
  } });
  const res = response(); await handler({}, res);
  for (const s of res.data.stations) { assert.equal(s.low, 100); assert.equal(s.coverage, 100); }
});
test('stale cloud guidance remains unknown and cached station readings expire', async () => {
  let time = now;
  const handler = createFogHandler({ clock: () => time, env: { TEMPEST_TOKEN: 'secret' }, fetcher: async url => {
    if (url.hostname === 'api.open-meteo.com') return { ok: true, json: async () => ({ current: { time: now / 1000 - 3600, cloud_cover: 0 }, current_units: { cloud_cover: '%' } }) };
    return { ok: true, json: async () => ({ status: { status_code: 0 }, station_id: url.pathname.split('/').at(-1), obs: [{ ...current, timestamp: now - 540000 }] }) };
  } });
  const res = response(); await handler({}, res);
  assert.equal(res.data.stations[0].available, true); assert.ok(res.data.stations[0].missing.includes('Cloud cover'));
  time += 61000;
  await handler({}, res); assert.equal(res.data.stations[0].available, false);
});
test('rain window tolerates station/history clock alignment without inventing missing minutes', () => {
  assert.ok(fogHistory({ ...current, timestamp: now + 58000 }, history).rain24hIn > 0.1);
  assert.equal(fogHistory({ ...current, timestamp: now + 120001 }, history).rain24hIn, null);
});
