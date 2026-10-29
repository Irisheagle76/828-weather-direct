// Presentation triggers only; these do not predict flooding or change official alerts.
export const HEAVY_RATE = 0.30;
export function stationState(source={}, now=Date.now()) {
 const o=source.observation||{},age=now-Date.parse(o.observedAt);
 const fresh=!source.unavailable&&!source.stale&&Number.isFinite(age)&&age>=-60000&&age<=10*60000;
 const rate=fresh&&Number.isFinite(o.precipitationRateInHr)?o.precipitationRateInHr:null;
 const strikeAge=now-o.lightningStrikeLastAt;
 const recent=fresh&&Number.isFinite(o.lightningStrikeLastAt)&&o.lightningStrikeLastAt>0&&strikeAge>=0&&strikeAge<=30*60000;
 const active=recent||(fresh&&Number.isFinite(o.lightningStrikes1h)&&o.lightningStrikes1h>0);
 return {fresh,rate,active,emphasis:fresh&&((rate!==null&&rate>=HEAVY_RATE)||active),
  title:!fresh?'Readings unavailable or out of date':rate>=HEAVY_RATE?'Heavy rain at the station':active?'Recent lightning detected':rate>0?'Rain at the station':rate===0?'No rain measured now':'Rain rate unavailable'};
}
export function compass(degrees){
 if(!Number.isFinite(degrees))return '—';
 const d=((degrees%360)+360)%360;
 return ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d/22.5)%16]+' · '+Math.round(d)+'°';
}
const n=(v,d=1)=>Number.isFinite(v)?v.toFixed(d):'—';
export function renderTempest(source){
 const o=source?.observation||{},state=stationState(source),card=document.getElementById('tempest-card');
 card.dataset.emphasis=String(state.emphasis);
 document.getElementById('tempest-status').textContent=state.fresh?'LATEST OBSERVATION':'STALE / UNAVAILABLE';
 document.getElementById('tempest-event-title').textContent=state.title;
 document.getElementById('tempest-rate').textContent=n(state.rate,2)+' in/hr';
 document.getElementById('tempest-event-note').textContent=state.emphasis?'Rain rate and recent lightning deserve attention. Check the river and official alerts below.':'Latest reported station rain rate. Rain intensity can change between updates.';
 document.getElementById('tempest-lightning').textContent=state.fresh?(Number.isFinite(o.lightningStrikes1h)?o.lightningStrikes1h+' strikes detected · past hour':'Past-hour strike count unavailable'):'Lightning observations unavailable or out of date';
 const last=Number.isFinite(o.lightningStrikeLastAt)&&o.lightningStrikeLastAt>0?new Date(o.lightningStrikeLastAt).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):null;
 document.getElementById('tempest-strike-detail').textContent=last?'Last detection: '+last+' · '+n(o.lightningStrikeDistanceMi)+' mi (estimated). Detection is not a storm location.':'No last-detection time supplied. Missing data are not an all-clear.';
 const fields=[['Temperature',n(o.temperatureF)+' °F'],['Dew point',n(o.dewPointF)+' °F'],['Humidity',n(o.humidityPct,0)+'%'],['Barometer · sea level',n(Number.isFinite(o.seaLevelPressureMb)?o.seaLevelPressureMb/33.8638866667:null,2)+' inHg'],['Wind',n(o.windMph)+' mph'],['Wind gust',n(o.windGustMph)+' mph'],['Wind from',compass(o.windDirectionDeg)],['UV index',n(o.uvIndex)],['Rain today · station total',n(o.precipitationTodayIn,2)+' in']];
 const grid=document.getElementById('tempest-readings');grid.replaceChildren(...fields.map(([label,value])=>{const a=document.createElement('div'),l=document.createElement('label'),v=document.createElement('strong');a.className='tempest-metric';l.textContent=label;v.textContent=value;a.append(l,v);return a;}));
}
