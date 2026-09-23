import {fetchRainfall} from './rainfall.mjs';
try { const d=await fetchRainfall();console.log(JSON.stringify({name:d.name,stationId:d.stationId,demo:d.demo,observedAt:d.observedAt,sampleMinutes:d.sampleMinutes,rolling:d.rolling,today:d.today,hoursAvailable:d.hourly.filter(p=>p.inches!==null).length})); }
catch {console.log('Tempest demo history unavailable; no credentials logged.');process.exitCode=1;}
