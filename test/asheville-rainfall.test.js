import test from 'node:test';
import assert from 'node:assert/strict';
import { sumRainIntervals, enrichRainfall } from '../lib/asheville-spread/rainfall.js';
import { normalizeCwopRain } from '../lib/asheville-spread/cwop.js';
const end = Date.parse('2026-11-05T10:00Z');
const hours = Array.from({length:24}, (_,i)=>({end:end-i*3600000,duration:3600000,inches:.1}));
const raw = (fields, stamp='2026-11-05 10:00:00', call='FW9022') => `${stamp},${call}>APRS,TCPXX*:@051000z3531.42N/08239.73W_126/006g013t062${fields}h86b10202.DsVP <br>`;
test('CWOP rain uses lowercase p, keeps zero, and never substitutes midnight or hourly rain',()=>{
 assert.equal(normalizeCwopRain(raw('r005p123P045'),'FW9022',new Date(end).toISOString()).precipitation24HourIn,1.23);
 assert.equal(normalizeCwopRain(raw('r005p000P045'),'FW9022',new Date(end).toISOString()).precipitation24HourIn,0);
 for(const data of [raw('r005P045'),raw('p...'),raw('p123','2026-11-05 08:00:00'),raw('p123','2026-11-05 10:00:00','OTHER')]) assert.equal(normalizeCwopRain(data,'FW9022',new Date(end).toISOString()).precipitation24HourIn,null);
 assert.equal(normalizeCwopRain(raw('p123','2026-11-05 09:55:00')+raw('P045'),'FW9022',new Date(end).toISOString()).precipitation24HourIn,null);
});
test('rain history sums one full non-overlapping day and rejects gaps or missing values',()=>{
 assert.equal(sumRainIntervals(hours).precipitation24HourIn,2.4);
 assert.equal(sumRainIntervals([...hours,...hours]).precipitation24HourIn,2.4);
 assert.equal(sumRainIntervals(hours.slice(1)).precipitation24HourIn,null);
 assert.equal(sumRainIntervals(hours.map((r,i)=>i===8?{...r,inches:null}:r)).precipitation24HourIn,null);
 assert.equal(sumRainIntervals(hours.map(r=>({...r,inches:0}))).precipitation24HourIn,0);
 const minutes=Array.from({length:1440},(_,i)=>({end:end-i*60000,duration:60000,inches:.001}));
 assert.equal(sumRainIntervals(minutes).precipitation24HourIn,1.44);
 assert.equal(sumRainIntervals(minutes.filter((_,i)=>i!==600)).precipitation24HourIn,null);
});
function cache(){const data=new Map();return {get:async k=>data.get(k),set:async(k,v,opts)=>{if(opts?.nx&&data.has(k))return null;data.set(k,v);return 'OK';}};}
test('Tempest history uses interval millimeters and shares collection across callers',async()=>{
 const c=cache();let calls=0;const options={rainfallCache:c,env:{TEMPEST_TOKEN:'test'},nowMs:end,fetchImpl:async url=>{calls++;return {ok:true,json:async()=>String(url).includes('/stations/')?{stations:[{station_id:123,devices:[{device_id:456,device_type:'ST',serial_number:'ST-1',device_meta:{environment:'outdoor'}}]}]}:{device_id:456,type:'obs_st',obs:Array.from({length:1440},(_,i)=>{const r=[];r[0]=(end-i*60000)/1000;r[12]=.0254;r[17]=1;return r;})}};}};
 const s={source:{provider:'tempest',stationId:'123'}},o={temperatureF:60};
 assert.equal((await enrichRainfall(s,o,options)).precipitation24HourIn,1.44);
 assert.equal((await enrichRainfall(s,o,{...options,nowMs:end+1800001})).precipitation24HourIn,1.44);
 assert.equal(calls,2);
});
test('rain history fails closed on cache outage and retains other observations',async()=>{
 let called=false;const o=await enrichRainfall({source:{provider:'nws',stationId:'KAVL'}},{temperatureF:60},{rainfallCache:{get:async()=>{throw Error('offline')}},fetchImpl:async()=>{called=true;}});
 assert.equal(called,false);assert.equal(o.temperatureF,60);assert.equal(o.precipitation24HourIn,null);
});
