// Raw Tempest rainfall proof of concept. Credentials never leave this server module.
// Future production sensor: set BILTMORE_TEMPEST_STATION_ID and
// BILTMORE_TEMPEST_TOKEN and BILTMORE_TEMPEST_MODE=local in the environment.
export function rainConfig(env=process.env) {
 const local=env.BILTMORE_TEMPEST_MODE==='local';
 return {stationId:local?env.BILTMORE_TEMPEST_STATION_ID:'127602',
  token:env.BILTMORE_TEMPEST_TOKEN || (!local?env.TEMPEST_TOKEN:null),
  name:local?'828 Biltmore Tempest':'Huntington Chase',demo:!local};
}
async function request(path,token,params={},fetcher=fetch){
 const url=new URL('https://swd.weatherflow.com/swd/rest/'+path);url.search=new URLSearchParams({...params,token});
 const r=await fetcher(url,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Tempest source unavailable');
 const d=await r.json();if(d.status?.status_code!==0)throw Error('Tempest response unavailable');return d;
}
let metaCache;
export async function fetchRainfall({env=process.env,fetcher=fetch,now=Date.now()}={}) {
 const config=rainConfig(env);if(!config.token||!config.stationId)throw Error('Tempest credentials or station ID unavailable');
 let meta=metaCache?.id===config.stationId&&now-metaCache.at<3600000?metaCache.value:null;
 if(!meta){meta=await request('stations/'+config.stationId,config.token,{},fetcher);metaCache={id:config.stationId,at:now,value:meta};}
 const station=meta.stations?.find(s=>String(s.station_id)===config.stationId);
 const devices=(station?.devices||[]).filter(d=>d.device_type==='ST'&&d.serial_number);
 if(devices.length!==1)throw Error('A single active Tempest device is required');
 const deviceId=devices[0].device_id;
 const d=await request('observations/device/'+deviceId,config.token,{time_start:Math.floor((now-30*3600000)/1000),time_end:Math.floor(now/1000)},fetcher);
 if(d.type!=='obs_st')throw Error('Unexpected device observation format');
 const intervals=normalizeIntervals(d.obs||[]),last=intervals.at(-1);
 if(!last)throw Error('Tempest history unavailable');
 const timezone=station.timezone||'America/New_York',midnight=localMidnight(last.t,timezone);
 const rolling=Object.fromEntries([1,3,6].map(h=>[h,windowTotal(intervals,last.t-h*3600000,last.t)]));
 const today=windowTotal(intervals,midnight,last.t);
 const hourEnd=Math.floor(last.t/3600000)*3600000;
 const hourly=Array.from({length:24},(_,i)=>{const start=hourEnd-(24-i)*3600000,end=start+3600000,result=windowTotal(intervals,start,end);return {start,t:end,inches:result.inches,coverage:result.coverage};});
 return {demo:config.demo,name:config.name,stationId:config.stationId,timezone,observedAt:new Date(last.t).toISOString(),
  rainRateInHr:last.inches/(last.t-last.start)*3600000,rolling,today,hourly,
  sampleMinutes:(last.t-last.start)/60000,basis:'Raw sensor interval accumulation; not Rain Check adjusted'};
}
export function normalizeIntervals(rows){
 const byTime=new Map();for(const row of rows){
  if(!Number.isFinite(row[0])||!Number.isFinite(row[12])||row[12]<0||!Number.isFinite(row[17])||row[17]<=0||row[17]>60)continue;
  const t=row[0]*1000;byTime.set(t,{t,start:t-row[17]*60000,inches:row[12]/25.4});
 }return [...byTime.values()].sort((a,b)=>a.t-b.t);
}
export function windowTotal(intervals,start,end){
 if(end<=start)return {inches:null,coverage:0};
 const samples=intervals.filter(p=>p.t>start&&p.start<end);let cursor=start,total=0,covered=0,valid=true;
 for(const p of samples){
  const a=Math.max(p.start,start),b=Math.min(p.t,end);
  if(p.start<start||p.t>end||Math.abs(a-cursor)>1000)valid=false;
  covered+=Math.max(0,b-Math.max(a,cursor));cursor=Math.max(cursor,b);total+=p.inches;
 }
 if(Math.abs(cursor-end)>1000)valid=false;
 return {inches:valid?total:null,coverage:Math.min(1,covered/(end-start))};
}
export function localMidnight(t,timezone='America/New_York'){
 const fmt=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=time=>Object.fromEntries(fmt.formatToParts(time).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 const p=parts(t),target=Date.UTC(p.year,p.month-1,p.day);let candidate=target;
 for(let i=0;i<3;i++){const q=parts(candidate),offset=Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute,q.second)-candidate;candidate=target-offset;}
 return candidate;
}
