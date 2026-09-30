import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../lib/api-routes/weather.js';

test('unified conditions include North Downtown without calling the production station endpoint', async () => {
  const savedFetch = globalThis.fetch;
  const keys = ['TEMPEST_TOKEN','JCC_TEMPEST_TOKEN','TEMPEST_STATION_ID'];
  const saved = keys.map(key => process.env[key]);
  process.env.TEMPEST_TOKEN = 'primary-test';
  process.env.JCC_TEMPEST_TOKEN = 'north-test';
  process.env.TEMPEST_STATION_ID = '123';
  const timestamp = Date.now()/1000;
  globalThis.fetch = async value => {
    const url = new URL(value);
    assert.notEqual(url.hostname,'avlweather.com');
    if (url.hostname === 'api.open-meteo.com') return {ok:false};
    if (url.pathname.endsWith('better_forecast')) return {ok:true,json:async()=>({current_conditions:{timestamp,air_temperature:22,wind_avg:1,precip_rate:0}})};
    const north = url.pathname.endsWith('/144737');
    return {ok:true,json:async()=>({status:{status_code:0},station_id:north?144737:123,obs:[{timestamp,air_temperature:north?20:22,relative_humidity:70,precip_rate:north?5:0,wind_avg:1}]})};
  };
  try {
    let payload;
    await handler({query:{type:'hourly',lat:'35.5951',lon:'-82.5515'}},{status(){return this},json(value){payload=value},setHeader(){}});
    assert.equal(payload.current.air_temperature,22);
    assert.equal(payload.current.precipRate,5);
    assert.equal(payload.current.supplementalStation.name,'North Downtown');
    assert.equal(payload.current.supplementalStation.air_temperature,20);
    assert.equal(payload.current.rainSource.stationId,'144737');
  } finally {
    globalThis.fetch = savedFetch;
    keys.forEach((key,i)=>{ if(saved[i]===undefined)delete process.env[key];else process.env[key]=saved[i]; });
  }
});
