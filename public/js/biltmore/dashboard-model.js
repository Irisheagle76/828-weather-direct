import {change} from './rules.js';
export const finite=Number.isFinite;
export function freshness(source,time,maxAge,now=Date.now()) {
 const t=typeof time==='number'?time:Date.parse(time);
 if(!source||source.unavailable||!finite(t))return 'unavailable';
 return source.stale||now-t>maxAge||t-now>60000?'stale':'current';
}
export function dashboardModel(d={},now=Date.now()) {
 const valid=ps=>(ps||[]).filter(p=>finite(p.t)&&finite(p.v)&&p.t<=now+60000).sort((a,b)=>a.t-b.t);
 const points=valid(d.river?.stage),stage=points.at(-1),flow=valid(d.river?.flow).at(-1),o=d.primary?.observation||{};
 const riverState=freshness(d.river,stage?.t,3600000,now),flowState=freshness(d.river,flow?.t,3600000,now),weatherState=freshness(d.primary,o.observedAt,600000,now);
 const rain=d.rainfall||{},isLocal=rain.stationId==='237451'&&!rain.demo;
 const rainState=isLocal?freshness(rain,rain.observedAt,900000,now):'unavailable';
 const rate=rainState==='current'&&finite(rain.rainRateInHr)&&rain.rainRateInHr>=0?rain.rainRateInHr:null;
 const cats=freshness(d.noaa,d.noaa?.fetchedAt,7200000,now)==='current'?d.noaa.categories:null;
 const delta=riverState==='current'?change(points,1):null,delta3=riverState==='current'?change(points,3):null;
 const forecast=d.forecast||{},forecastState=freshness(forecast,forecast.issuedTime,86400000,now);
 // Future guidance is intentionally not filtered as an observation.
 const fp=(forecast.points||[]).filter(p=>finite(p.t)&&finite(p.v)&&p.t>=now).sort((a,b)=>a.t-b.t);
 const peak=forecastState==='current'&&fp.length?Math.max(...fp.map(p=>p.v)):null;
 const peakAt=finite(peak)?fp.find(p=>p.v===peak).t:null,flat=fp.length>0&&fp.every(p=>p.v===fp[0].v);
 const alertState=freshness(d.alerts,d.alerts?.fetchedAt,900000,now);
 const alerts=alertState==='current'?(d.alerts.items||[]).filter(a=>Date.parse(a.expires)>now):[];
 const strikeTime=o.lightningStrikeLastAt,hasStrike=finite(strikeTime)&&strikeTime>0&&strikeTime<=now+60000;
 const recentStrike=weatherState==='current'&&hasStrike&&now-strikeTime<=1800000;
 return {stage,flow,points,riverState,flowState,o,weatherState,rain,rainState,rate,cats,delta,delta3,forecast,forecastState,peak,peakAt,flat,alertState,alerts,hasStrike,recentStrike,
 riverAttention:riverState==='current'&&finite(cats?.action)&&stage.v>=cats.action,
 lightningAttention:weatherState==='current'&&(recentStrike||(finite(o.lightningStrikes1h)&&o.lightningStrikes1h>0))};
}
