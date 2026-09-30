import test from 'node:test';
import assert from 'node:assert/strict';
import { supplementCurrentConditions } from '../lib/tempest/supplement.js';
import { lightningDistanceTrend, stationWeatherSummary, withStationContext, rememberStationObservation } from '../public/js/intel/station-lightning.js';
import { fetchTempest } from '../lib/asheville-spread/providers.js';
import { ASHEVILLE_STATIONS } from '../lib/asheville-spread/stations.js';
import { buildSkyConditionRead } from '../public/js/intel/sky-read.js';
import { fetchTempestObservation } from '../lib/api-routes/storm/current.js';
const now = 1800000000000;
const primary = { timestamp: now, rainRateObservedAt: now, air_temperature: 25, wind_avg: 1, precipRate: 0, lightningStrikeCount: 0, lightningStrikeDistance: 0 };
const jcc = { stationId: '144737', name: 'North Downtown', timestamp: now, rainRateObservedAt: now, air_temperature: 20, wind_avg: 3, solar_radiation: 600, precipRate: 12.7, precipType: 1, lightningStrikeCount: 2, lightningStrikeDistance: 8, lightningStrikeLastAt: now - 10000 };
test('fresh JCC supplements all missing fields and active rain/lightning with station provenance', () => {
  const result = supplementCurrentConditions(primary, jcc, now);
  assert.equal(result.air_temperature,25); assert.equal(result.wind_avg,1);
  assert.equal(result.solar_radiation,600); assert.equal(result.precipRate,12.7);
  assert.equal(result.lightningStrikeDistance,8); assert.equal(result.lightningStrikeLastAt,jcc.lightningStrikeLastAt);
  assert.equal(result.rainSource.name,'North Downtown'); assert.equal(result.lightningSource.name,'North Downtown');
  assert.equal(result.supplementalStation,jcc);
});
test('stale/future stations and zero rain never overwrite active primary rain', () => {
  for (const timestamp of [now-181000,now+61000,null]) assert.equal(supplementCurrentConditions(primary,{...jcc,timestamp},now),primary);
  const wet = {...primary,precipRate:20};
  assert.equal(supplementCurrentConditions(wet,{...jcc,precipRate:0},now).precipRate,20);
  assert.equal(supplementCurrentConditions(primary,{...jcc,precipRate:0},now).precipRate,0);
  assert.equal(supplementCurrentConditions(primary,{...jcc,rainRateObservedAt:now-181000},now).precipRate,0);
});
test('lightning chooses an active distance and preserves nearer primary detections', () => {
  assert.equal(supplementCurrentConditions({...primary,lightningStrikeCount:1,lightningStrikeDistance:3},jcc,now).lightningStrikeDistance,3);
  assert.equal(supplementCurrentConditions(primary,{...jcc,lightningStrikeCount:0,lightningStrikeLastAt:now-1000000},now).lightningStrikeDistance,0);
});
test('distance trend requires distinct recent detections and does not invent movement from repeated strikes', () => {
  const samples = [12,9,6].map((distanceKm,i)=>({at:now-(2-i)*60000,distanceKm}));
  assert.equal(lightningDistanceTrend(samples,now),'decreasing');
  assert.equal(lightningDistanceTrend(samples.map(p=>({...p,distanceKm:20-p.distanceKm})),now),'increasing');
  assert.equal(lightningDistanceTrend([samples[0],samples[0],samples[0]],now),'insufficient data');
  assert.equal(lightningDistanceTrend(samples,now+181000),'insufficient data');
  assert.equal(lightningDistanceTrend(samples.map((p,i)=>({...p,distanceKm:[12,6,9][i]})),now),'variable or steady');
});
test('sky summary attributes local rain and lightning and expires stale evidence', () => {
  assert.match(stationWeatherSummary(jcc,now),/North Downtown.*0.50 in\/hr.*5.0 miles/);
  assert.equal(stationWeatherSummary(jcc,now+181000),'');
});
test('shared sky read includes attributed supplemental rain and lightning context',()=>{
  const timestamp=Date.now();
  const result=buildSkyConditionRead({camera:{metrics:{cloudCoverWest:80,mode:'day'}},weatherContext:{supplementalStation:{...jcc,timestamp,rainRateObservedAt:timestamp,lightningStrikeLastAt:timestamp}}});
  assert.match(result.narrative.detail,/North Downtown weather station is measuring rain/);
  assert.match(result.narrative.detail,/5.0 miles from the station/);
  assert.equal(typeof fetchTempestObservation,'function');
});
test('Microscope JCC uses dedicated direct credentials and normalized metric readings',async()=>{
  const station=ASHEVILLE_STATIONS.find(s=>s.id==='north-downtown');
  assert.equal(station.name,'North Downtown');
  const result=await fetchTempest(station,{env:{JCC_TEMPEST_TOKEN:'test-token'},fetchImpl:async url=>{
    assert.equal(new URL(url).searchParams.get('token'),'test-token');
    return {ok:true,json:async()=>({status:{status_code:0},station_id:144737,obs:[{timestamp:Date.now()/1000,air_temperature:20,precip_rate:12.7}]})};
  }});
  assert.equal(result.temperatureF,68); assert.equal(result.precipitationRateInHr,.5);
});

test('North Downtown supports quiet current conditions, sunlight and moisture reads with attribution', () => {
  const quiet = {...jcc, precipRate:0, lightningStrikeCount:0, lightningStrikeLastAt:null, relative_humidity:65, dew_point:12};
  assert.match(stationWeatherSummary(quiet,now,{surface:'current'}),/North Downtown weather station reports 68°F with 65% humidity/);
  assert.match(stationWeatherSummary(quiet,now),/600 W\/m²/);
  assert.match(stationWeatherSummary({...quiet,solar_radiation:0},now),/local moisture context/);
  assert.match(stationWeatherSummary({...quiet,relative_humidity:96,dew_point:19.5},now),/alone does not confirm fog/);
  assert.match(stationWeatherSummary({...quiet,wind_gust:10},now,{surface:'current'}),/gusts to 22 mph/);
  assert.equal(stationWeatherSummary({...quiet,timestamp:now-181000},now),'');
});
test('station attribution survives a replacement sky narrative and is not duplicated',()=>{
  const narrative={headline:'Night sky',detail:'The camera has limited visibility.'};
  const annotated=withStationContext(narrative,jcc,now);
  assert.match(annotated.detail,/North Downtown weather station/);
  assert.equal(withStationContext(annotated,jcc,now),annotated);
});
test('successive distinct detections contribute a qualified distance trend without the old panel',()=>{
  let result;
  for(let i=0;i<3;i++)result=rememberStationObservation({...jcc,timestamp:now-120000+i*60000,lightningStrikeLastAt:now-120000+i*60000,lightningStrikeDistance:12-i*3},now);
  assert.equal(result.lightningDistanceTrend,'decreasing');
  assert.match(stationWeatherSummary(result,now),/closer to the station; this does not establish storm movement/);
});
