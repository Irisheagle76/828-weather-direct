import test from 'node:test';
import assert from 'node:assert/strict';
import { ASHEVILLE_STATIONS, ARCHIVED_WU_STATIONS } from '../lib/asheville-spread/stations.js';
import { fetchStationObservation, normalizeNws } from '../lib/asheville-spread/providers.js';
import { buildAshevilleSpread } from '../lib/asheville-spread/service.js';

test('active network omits archived WU stations and fetches KAVL without credentials', async () => {
  assert.equal(ARCHIVED_WU_STATIONS.length, 27);
  assert.equal(ASHEVILLE_STATIONS.length, 6);
  assert.ok(ASHEVILLE_STATIONS.every(s => s.source.provider !== 'wunderground'));
  const airport = ASHEVILLE_STATIONS.find(s => s.source.stationId === 'KAVL');
  await fetchStationObservation(airport, { env: {}, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.weather.gov/stations/KAVL/observations/latest');
    assert.ok(options.headers['user-agent']);
    return { ok: true, json: async () => ({properties:{timestamp:'2026-10-30T12:54:00Z'}}) };
  }});
});

test('NWS conversions preserve missing and rejected measurements', () => {
  const q = (value, unitCode) => ({value, unitCode:`wmoUnit:${unitCode}`});
  const result = normalizeNws({timestamp:'2026-10-30T12:54:00Z',temperature:q(20,'degC'),windSpeed:q(10,'km_h-1'),seaLevelPressure:q(101300,'Pa'),precipitationLastHour:q(25.4,'mm')});
  assert.equal(result.temperatureF,68);
  assert.equal(result.windMph,6.214);
  assert.equal(result.seaLevelPressureMb,1013);
  assert.equal(result.precipitationLastHourIn,1);
  assert.equal(result.dewPointF,null);
  assert.equal(normalizeNws({temperature:q(null,'degC')}).temperatureF,null);
  assert.equal(normalizeNws({temperature:{...q(20,'degC'),qualityControl:'X'}}).temperatureF,null);
  assert.equal(result.precipitationTodayIn,undefined);
});

test('hourly airport stays usable while older rapid-reporting observations expire', async () => {
  const nowMs = Date.parse('2026-10-30T14:00:00Z');
  for (const [minutes,freshness,usable] of [[65,'fresh',true],[90,'delayed',true],[121,'stale',false]]) {
    const called = [];
    const result = await buildAshevilleSpread({nowMs,fetcher:async s => {
      called.push(s.source.provider);
      return {observedAt:new Date(nowMs-minutes*60000).toISOString(),temperatureF:60};
    }});
    assert.ok(!called.includes('wunderground'));
    const airport = result.stations.find(s => s.providerStationId === 'KAVL');
    assert.equal(airport.quality.freshness,freshness);
    assert.equal(airport.quality.usable,usable);
    assert.equal(result.stations.find(s => s.id==='north-downtown').quality.usable,false);
  }
});
