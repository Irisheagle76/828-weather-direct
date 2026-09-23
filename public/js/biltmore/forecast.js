// Official forecast only. Never extrapolate observations or feed demo rain into it.
export const FORECAST_STALE_MS=24*3600000;
export function parseForecast(d){
 if(d.primaryUnits!=='ft'||d.primaryName!=='Stage')throw Error('Unsupported forecast units');
 const points=(d.data||[]).filter(p=>typeof p.primary==='number'&&Number.isFinite(p.primary)&&Number.isFinite(Date.parse(p.validTime))).map(p=>({t:Date.parse(p.validTime),v:p.primary})).sort((a,b)=>a.t-b.t);
 if(!points.length||!Number.isFinite(Date.parse(d.issuedTime)))throw Error('Forecast unavailable');
 return {points,issuedTime:d.issuedTime,units:'ft'};
}
export function forecastSummary(f,now=Date.now()){
 const points=(f?.points||[]).filter(p=>p.t>=now);
 const stale=!!f?.stale||!f?.issuedTime||now-Date.parse(f.issuedTime)>FORECAST_STALE_MS;
 if(!points.length||f?.unavailable)return {unavailable:true,stale};
 const peak=Math.max(...points.map(p=>p.v)),peaks=points.filter(p=>p.v===peak);
 return {points,peak,firstPeak:peaks[0].t,lastPeak:peaks.at(-1).t,flat:points.every(p=>p.v===peak),stale};
}
