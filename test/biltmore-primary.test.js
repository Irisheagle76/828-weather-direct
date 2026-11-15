import test from 'node:test';
import assert from 'node:assert/strict';
import { biltmorePrimary } from '../lib/tempest/biltmore-primary.js';
const now=1800000000000;
test('fresh measured Biltmore observations lead, preserving pressure trend',()=>{
 const obs=biltmorePrimary({timestamp:now-60000,air_temperature:10,pressure:1020,pressure_trend:'rising'}, {timestamp:now,air_temperature:12,wind_avg:0,pressure:null},now);
 assert.equal(obs.stationId,'237451');assert.equal(obs.air_temperature,12);assert.equal(obs.wind_avg,0);assert.equal(obs.pressure,1020);assert.equal(obs.pressure_trend,'rising');
});
test('stale and future Biltmore readings cannot masquerade as current',()=>{
 assert.equal(biltmorePrimary({timestamp:now-11*60000},{timestamp:now+120000},now),null);
 const obs=biltmorePrimary({timestamp:now-11*60000,pressure_trend:'rising',pressure:1020},{timestamp:now,air_temperature:8},now);
 assert.equal(obs.pressure_trend,undefined);assert.equal(obs.pressure,undefined);assert.equal(obs.air_temperature,8);
});
