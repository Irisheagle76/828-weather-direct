import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCwopXml, normalizeCwopRain, fetchCwop } from '../lib/asheville-spread/cwop.js';
import { ASHEVILLE_STATIONS } from '../lib/asheville-spread/stations.js';
import { assessObservation } from '../lib/asheville-spread/quality.js';
const report = (time, fields='') => `<weatherReport><timeReceived>${time}</timeReceived><temperature>60</temperature><humidity>100</humidity><windSpeed>3</windSpeed><barometer>1019</barometer><rain1h>0.06</rain1h>${fields}</weatherReport>`;
const xml = '<station><call>CW7566</call>'+report('20261105001703')+'</station>';
const station = ASHEVILLE_STATIONS.find(s=>s.source.stationId==='CW7566');
test('CWOP XML preserves units, missing values, receipt time and hourly accumulation',()=>{
 const o=normalizeCwopXml(xml,'CW7566');assert.equal(o.temperatureF,60);assert.equal(o.dewPointF,60);assert.equal(o.humidityPct,100);assert.equal(o.windMph,3);assert.equal(o.windGustMph,null);assert.equal(o.seaLevelPressureMb,1019);assert.equal(o.precipitationLastHourIn,.06);assert.equal(o.precipitationRateInHr,null);assert.equal(o.precipitationTodayIn,null);assert.equal(o.timestampBasis,'received');assert.equal(o.observedAt,'2026-11-05T00:17:03.000Z');
});
test('CWOP selects newest timestamp, rejects station mismatch and invalid dates',()=>{
 const unsorted='<call>CW7566</call>'+report('20261105001703')+report('20261105002703')+report('20261105000703');assert.equal(normalizeCwopXml(unsorted,'CW7566').observedAt,'2026-11-05T00:27:03.000Z');assert.throws(()=>normalizeCwopXml(xml,'DW8032'));assert.throws(()=>normalizeCwopXml('<call>CW7566</call>'+report('20260230001703'),'CW7566'));
});
function cache(){const data=new Map();return {get:async k=>data.get(k),set:async(k,v,options)=>{if(options?.nx&&data.has(k))return null;data.set(k,v);return 'OK';}};}
test('CWOP shared cooldown prevents cross-instance and slot-boundary duplicate fetches',async()=>{
 const client=cache();let calls=0;const fetchImpl=async()=>{calls++;return {ok:true,text:async()=>xml};};const now=Date.parse('2026-11-05T00:29:59Z');await fetchCwop(station,{cwopCache:client,fetchImpl,nowMs:now});await fetchCwop(station,{cwopCache:client,fetchImpl,nowMs:now+2000});await fetchCwop(station,{cwopCache:client,fetchImpl,nowMs:now+5000});assert.equal(calls,2);
});
test('CWOP fails closed on shared-cache outage and retains old timestamps on source failure',async()=>{
 let calls=0;await assert.rejects(fetchCwop(station,{cwopCache:{get:async()=>{throw Error('offline')}},fetchImpl:async()=>{calls++;}}),{code:'shared_cache_unavailable'});assert.equal(calls,0);
 const client=cache();const old=normalizeCwopXml(xml,'CW7566');await client.set('observations:cwop:v1:CW7566',{slot:0,observation:old});const result=await fetchCwop(station,{cwopCache:client,nowMs:Date.parse('2026-11-05T03:00Z'),fetchImpl:async()=>({ok:false})});assert.equal(result.observedAt,old.observedAt);assert.equal(assessObservation(result,Date.parse('2026-11-05T03:00Z'),station.freshness).usable,false);
});
test('eight unique CWOP stations have geographic metadata and regional scope',()=>{
 const stations=ASHEVILLE_STATIONS.filter(s=>s.source.provider==='cwop');assert.equal(stations.length,8);assert.equal(ASHEVILLE_STATIONS.length,19);assert.equal(new Set(ASHEVILLE_STATIONS.map(s=>s.id)).size,19);assert.ok(stations.every(s=>s.scope==='corridor'&&s.latitude>35&&s.latitude<36&&s.longitude< -82&&s.elevationFt>1900));
});
