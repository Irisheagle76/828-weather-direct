import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {fetchTempestObservation} from '../../lib/observations/providers.js';
import {fetchRainfall,rainConfig} from './rainfall.mjs';
import {VILLAGE_STATION} from './stations.mjs';
import {parseForecast} from '../../public/js/biltmore/forecast.js';
const root = new URL('../../public/',import.meta.url);
// Optional private LAN address; default remains loopback. Never bind all interfaces.
const host = process.argv[2] || '127.0.0.1';
if (!/^(127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})$/.test(host)) throw Error('Use a private IPv4 LAN address or loopback');
const cache = new Map();
async function json(url) { const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'828WeatherDirect Biltmore prototype (https://avlweather.com)'}}); if(!r.ok) throw Error('Upstream unavailable'); return r.json(); }
async function cached(id, ttl, fn) {
  const old=cache.get(id); if(old && Date.now()-old.at<ttl) return old.promise || old.data;
  const promise=Promise.resolve().then(fn).then(value=>{const data={...value,fetchedAt:new Date().toISOString(),unavailable:false}; cache.set(id,{at:Date.now(),data});return data;}).catch(()=>{const data=old?.data?{...old.data,stale:true}:{unavailable:true,fetchedAt:new Date().toISOString()}; cache.set(id,{at:Date.now(),data});return data;});
  cache.set(id,{at:Date.now(),promise,data:old?.data}); return promise;
}
async function payload() {
 const [river,noaa,station,alerts,rainfall,forecast,radar,basin]=await Promise.all([
 cached('river',300000,async()=>{const d=await json('https://waterservices.usgs.gov/nwis/iv/?format=json&sites=03451000&parameterCd=00065,00060&period=P2D&siteStatus=all');const series=code=>{const s=d.value?.timeSeries?.find(s=>s.variable.variableCode.some(c=>c.value===code));return (s?.values?.[0]?.value||[]).filter(p=>Number(p.value)!==Number(s.variable.noDataValue)&&Number.isFinite(Number(p.value))).map(p=>({t:Date.parse(p.dateTime),v:Number(p.value)})).filter(p=>Number.isFinite(p.t)).sort((a,b)=>a.t-b.t);};return {stage:series('00065'),flow:series('00060')};}),
 cached('noaa',3600000,async()=>{const d=await json('https://api.water.noaa.gov/nwps/v1/gauges/bltn7');return {categories:Object.fromEntries(Object.entries(d.flood?.categories||{}).map(([k,v])=>[k,v.stage])),status:d.status};}),
 cached('station',300000,async()=>{const key=process.env.BILTMORE_VILLAGE_API_KEY||process.env.WEATHERFLOW_API_KEY;if(!key) throw Error();const d=await fetchTempestObservation(VILLAGE_STATION,fetch,key);return {observation:d};}),
 cached('alerts',300000,async()=>{const d=await json('https://api.weather.gov/alerts/active?point=35.56510,-82.54016');return {items:(d.features||[]).map(f=>({event:f.properties.event,headline:f.properties.headline,description:f.properties.description,sent:f.properties.sent,expires:f.properties.expires,url:f.id}))};}),
 cached('rainfall',300000,()=>fetchRainfall()),
 cached('forecast',900000,async()=>parseForecast(await json('https://api.water.noaa.gov/nwps/v1/gauges/bltn7/stageflow/forecast'))),
 cached('radar',300000,async()=>{const r=await fetch('https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?request=GetCapabilities&service=wms&version=1.3.0',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const xml=await r.text();const dimension=xml.match(/<Dimension\b[^>]*name="time"[^>]*>([^<]+)<\/Dimension>/i);const times=(dimension?.[1]||'').split(',').map(t=>Date.parse(t)).filter(Number.isFinite).sort((a,b)=>a-b);if(!times.length)throw Error();return {validTime:new Date(times.at(-1)).toISOString()};}),
 cached('basin',86400000,async()=>{const d=await json('https://api.water.usgs.gov/nldi/linked-data/nwissite/USGS-03451000/basin?simplified=true');if(d.type!=='FeatureCollection'||!d.features?.length)throw Error();return {geojson:d};})
 ]);const config=rainConfig();return {river,noaa,station,alerts,forecast,radar,basin,rainfall:{demo:config.demo,name:config.name,...rainfall}};
}
// Local-only server: explicit allowlist; no router/config/production API changes.
const allowed=new Set(['/biltmore.html','/css/biltmore.css','/js/biltmore/page.js','/js/biltmore/rules.js','/js/biltmore/forecast.js','/js/biltmore/watershed.js']);
http.createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(req.method!=='GET'){res.writeHead(405);return res.end();}if(path==='/experimental/biltmore/data'){res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');return res.end(JSON.stringify(await payload()));}if(path==='/favicon.ico'){res.writeHead(204);return res.end();}if(!allowed.has(path)){res.writeHead(404);return res.end('Prototype server only');}res.setHeader('Content-Type',path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'text/html');res.end(await readFile(new URL('.'+path,root)));}catch{res.writeHead(500);res.end('Prototype unavailable');}}).listen(4188,host,()=>console.log(`828 Biltmore: http://${host}:4188/biltmore.html`));
