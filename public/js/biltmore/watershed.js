let map,overlay,boundary,lastTime,loading;
function leaflet(){return loading||=new Promise((resolve,reject)=>{
 if(window.L)return resolve(window.L);
 const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
 const script=document.createElement('script');script.src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';script.onload=()=>resolve(window.L);script.onerror=reject;document.head.append(script);
});}
export async function renderWatershed(radar,basin){
 const status=document.getElementById('radar-time'),note=document.getElementById('basin-note');
 const date=t=>new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
 const old=radar?.stale||!radar?.validTime||Date.now()-Date.parse(radar.validTime)>20*60000;
 status.textContent=radar?.validTime?`Radar frame: ${date(radar.validTime)}${old?' · STALE':''} · Checked ${date(radar.fetchedAt)}`:'Radar unavailable · Open official NWS radar below';
 note.textContent=basin?.geojson?`Rain inside the blue outline can drain toward the Swannanoa River at Biltmore. This is the upstream watershed—not an area predicted to flood.${basin.stale?' The outline is a saved copy.':''} Radar colors show the strength of echoes, not measured rainfall totals.`:'The watershed outline is unavailable. This is a regional radar view only—not a map of flooding.';
 try{
 const L=await leaflet();
 if(!map){map=L.map('watershed-map',{scrollWheelZoom:false}).setView([35.62,-82.43],11);
 const key=document.querySelector('.radar-key'),details=document.createElement('details'),summary=document.createElement('summary'),legend=document.createElement('img');summary.textContent='Official radar color scale · dBZ';legend.src='https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?service=WMS&version=1.1.1&request=GetLegendGraphic&format=image/png&layer=conus_bref_qcd';legend.alt='NOAA MRMS reflectivity legend in dBZ';legend.style.maxWidth='100%';legend.onerror=()=>{legend.remove();summary.textContent='Radar legend unavailable';};details.append(summary,legend);key.replaceChildren(details);
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(map);
 L.circleMarker([35.56510,-82.54016],{radius:6,color:'#fff',fillColor:'#db6e2d',fillOpacity:1}).addTo(map).bindTooltip('Biltmore Village / downstream gauge');
 document.getElementById('radar-reset').onclick=()=>boundary?map.fitBounds(boundary.getBounds(),{padding:[16,16]}):map.setView([35.62,-82.43],11);
 }
 if(basin?.geojson&&!boundary){boundary=L.geoJSON(basin.geojson,{style:{color:'#4ba5ff',weight:3,fillOpacity:.03}}).addTo(map);map.fitBounds(boundary.getBounds(),{padding:[16,16]});}
 if(radar?.validTime&&lastTime!==radar.validTime){if(overlay)map.removeLayer(overlay);let failed=false;
 overlay=L.tileLayer.wms('https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows',{layers:'conus_bref_qcd',format:'image/png',transparent:true,version:'1.1.1',time:radar.validTime,opacity:.75,attribution:'NOAA/NWS MRMS radar'}).addTo(map);
 overlay.on('tileerror',()=>{failed=true;status.textContent='Radar imagery unavailable · Open official NWS radar below';});
 overlay.on('load',()=>{if(!failed)status.textContent+= ' · Imagery loaded';});lastTime=radar.validTime;
 }
 }catch{status.textContent='Interactive map unavailable · Open official NWS radar below';}
}
