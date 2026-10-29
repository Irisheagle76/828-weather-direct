import {fetchRainfall,rainConfig} from '../../tools/biltmore/rainfall.mjs';
import {COMPARISON_STATIONS,OWNED_STATION} from '../../tools/biltmore/stations.mjs';
import {fetchStationObservation} from '../asheville-spread/providers.js';
import {parseForecast} from '../../public/js/biltmore/forecast.js';
const cache = new Map();
async function json(url) { const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'828WeatherDirect Biltmore prototype (https://avlweather.com)'}}); if(!r.ok) throw Error('Upstream unavailable'); return r.json(); }
async function cached(id, ttl, fn) {
  const old=cache.get(id); if(old && Date.now()-old.at<ttl) return old.promise || old.data;
  const promise=Promise.resolve().then(fn).then(value=>{const data={...value,fetchedAt:new Date().toISOString(),unavailable:false}; cache.set(id,{at:Date.now(),data});return data;}).catch(()=>{const data=old?.data?{...old.data,stale:true}:{unavailable:true,fetchedAt:new Date().toISOString()}; cache.set(id,{at:Date.now(),data});return data;});
  cache.set(id,{at:Date.now(),promise,data:old?.data}); return promise;
}
export async function payload() {
 const [river,noaa,stations,alerts,rainfall,forecast,radar,basin,primary]=await Promise.all([
 cached('river',300000,async()=>{const d=await json('https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03451000&parameterCd=00065,00060&period=P2D&siteStatus=all');const series=code=>{const s=d.value?.timeSeries?.find(s=>s.variable.variableCode.some(c=>c.value===code));return (s?.values?.[0]?.value||[]).filter(p=>Number(p.value)!==Number(s.variable.noDataValue)&&Number.isFinite(Number(p.value))).map(p=>({t:Date.parse(p.dateTime),v:Number(p.value)})).filter(p=>Number.isFinite(p.t)).sort((a,b)=>a.t-b.t);};return {stage:series('00065'),flow:series('00060')};}),
 cached('noaa',3600000,async()=>{const d=await json('https://api.water.noaa.gov/nwps/v1/gauges/bltn7');return {categories:Object.fromEntries(Object.entries(d.flood?.categories||{}).map(([k,v])=>[k,v.stage])),status:d.status};}),
 Promise.all(COMPARISON_STATIONS.map(station=>cached(station.id,300000,async()=>({observation:await fetchStationObservation(station)})).then(data=>({id:station.id,...data})))),
 cached('alerts',300000,async()=>{const d=await json('https://api.weather.gov/alerts/active?point=35.56510,-82.54016');return {items:(d.features||[]).map(f=>({event:f.properties.event,headline:f.properties.headline,description:f.properties.description,sent:f.properties.sent,expires:f.properties.expires,url:f.id}))};}),
 cached('rainfall',300000,()=>fetchRainfall()),
 cached('forecast',900000,async()=>parseForecast(await json('https://api.water.noaa.gov/nwps/v1/gauges/bltn7/stageflow/forecast'))),
 cached('radar',300000,async()=>{const r=await fetch('https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?request=GetCapabilities&service=wms&version=1.3.0',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const xml=await r.text();const dimension=xml.match(/<Dimension\b[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i);const times=(dimension?.[1]||'').split(',').map(t=>Date.parse(t)).filter(Number.isFinite).sort((a,b)=>a-b);if(!times.length)throw Error();return {validTime:new Date(times.at(-1)).toISOString()};}),
 cached('basin',86400000,async()=>{const d=await json('https://api.water.usgs.gov/nldi/linked-data/nwissite/USGS-03451000/basin?simplified=true');if(d.type!=='FeatureCollection'||!d.features?.length)throw Error();return {geojson:d};}),
 cached('primary',60000,async()=>({observation:await fetchStationObservation(OWNED_STATION,{env:{TEMPEST_TOKEN:process.env.BILTMORE_TEMPEST_TOKEN||process.env.TEMPEST_TOKEN}})}))
 ]);const config=rainConfig();return {river,noaa,stations,primary,alerts,forecast,radar,basin,rainfall:{demo:config.demo,name:config.name,...rainfall}};
}
