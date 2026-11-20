import {riverGraph,compactDial,compactTrend} from './dashboard-graphs.js';
import {renderWatershed} from './watershed.js';
import {dashboardModel,finite,freshness} from './dashboard-model.js';
import {compass} from './tempest-card.js';
const $=id=>document.getElementById(id),put=(id,v)=>$(id).textContent=v;
const number=(v,n=2)=>finite(v)?v.toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n}):'—';
const time=t=>t?new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Unavailable';
function value(id,v,unit,n=2){const node=$(id);node.replaceChildren(document.createTextNode(number(v,n)+' '));const small=document.createElement('small');small.textContent=unit;node.append(small);}
function stamp(id,state,t){const age=t?Math.max(0,Math.floor((Date.now()-new Date(t).getTime())/60000)):null;put(id,(state==='current'?'Observed ':state==='stale'?'OUT OF DATE · Last observed ':'UNAVAILABLE · ')+(t?time(t)+(finite(age)?' · '+(age<60?age+' min ago':Math.floor(age/60)+'h '+age%60+'m ago'):''):'No observation'));$(id).dataset.state=state;}
function panel(name,state,attention=false){const p=document.querySelector('.'+name);p.dataset.state=state;p.dataset.attention=String(attention);}
function render(d){
 const m=dashboardModel(d),{o,rain}=m;
 for(const id of ['huntington','jcc']){
  const source=d.stations?.find(station=>station.id===id),obs=source?.observation||{},state=freshness(source,obs.observedAt,600000);
  const reading=v=>state==='unavailable'?null:v;
  value(id+'-temperature',reading(obs.temperatureF),'°F',1);
  for(const [key,field,unit,digits] of [['dew','dewPointF',' °F',1],['humidity','humidityPct','%',0],['wind','windMph',' mph',1],['gust','windGustMph',' mph',1],['rain','precipitationTodayIn',' in',2]])put(id+'-'+key,number(reading(obs[field]),digits)+unit);
  stamp(id+'-stamp',state,obs.observedAt);$('comparison-'+id).dataset.state=state;
 }
 value('stage',m.riverState==='unavailable'?null:m.stage?.v,'ft');
 panel('river',m.riverState,m.riverAttention);
 let state='River reading unavailable';
 if(m.riverState==='stale')state='Delayed reading · check official gauge';
 else if(m.riverState==='current')state=m.riverAttention?(finite(m.cats?.minor)&&m.stage.v>=m.cats.minor?'At or above flood stage':'At or above action stage'):finite(m.cats?.action)?'Below action stage · not an all-clear':'Official thresholds unavailable';
 put('river-state',state);
 put('thresholds',m.cats?'Action '+number(m.cats.action,1)+' ft · Flood '+number(m.cats.minor,1)+' ft':'Official river thresholds unavailable');
 const dialMax=finite(m.cats?.major)?Math.max(16.5,m.cats.major*1.1):16.5;
 $('river-dial').innerHTML=compactDial(m.riverState==='current'?m.stage?.v:null,{max:dialMax,categories:m.cats,label:'River level in feet'});
 $('rain-dial').innerHTML=compactDial(m.rate);
 const hourly=m.delta?.rate*12;
 $('trend-meter').innerHTML=compactTrend(hourly);
 put('trend-caption',finite(hourly)?(hourly>0?'+':'')+number(hourly,1)+' in/hr · Past hour average':'Hourly trend unavailable');
 for(const [id,delta] of [['rise',m.delta],['rise3',m.delta3]])put(id,delta?(delta.value>0?'+':'')+number(delta.value*12,1)+' in':'—');
 put('crest',finite(m.peak)?(m.flat?'Holding near ':'Highest expected: ')+number(m.peak,1)+' ft':'Forecast unavailable or out of date');
 put('crest-time',finite(m.peak)?(m.flat?'No distinct crest in current guidance':time(m.peakAt)):'Check NOAA for current guidance');
 put('forecast-stamp','Issued '+time(m.forecast.issuedTime));
 stamp('river-stamp',m.riverState,m.stage?.t);
 value('flow',m.flowState==='unavailable'?null:m.flow?.v,'ft³/s',0);stamp('flow-stamp',m.flowState,m.flow?.t);panel('flow',m.flowState);
 value('rain-rate',m.rate,'in/hr');panel('rain',m.rainState,m.rate>=.3);
 put('rain-basis',m.rate===null?'Rain-rate data unavailable or out of date':number(rain.sampleMinutes,0)+'-minute average · '+(m.rate>0?'Rain measured':'No rain measured in this interval'));
 for(const [id,key] of [['rain1',1],['rain3',3],['rain6',6],['rain-today','today']]){const result=key==='today'?rain.today:rain.rolling?.[key];put(id,m.rainState==='current'&&result?.coverage>=.999&&finite(result.inches)?number(result.inches)+' in':'—');}
 stamp('rain-stamp',m.rainState,rain.observedAt);
 const w=v=>m.weatherState==='unavailable'?null:v;
 value('temperature',w(o.temperatureF),'°F',1);put('humidity','Humidity '+number(w(o.humidityPct),0)+'%');put('wind',number(w(o.windMph),1)+' mph');put('gust',number(w(o.windGustMph),1)+' mph');put('direction',compass(w(o.windDirectionDeg)));put('dew',number(w(o.dewPointF),1)+' °F');panel('weather',m.weatherState);stamp('weather-stamp',m.weatherState,o.observedAt);
 put('strikes',m.weatherState==='current'?number(o.lightningStrikes1h,0):'—');
 put('distance',m.weatherState==='current'&&m.hasStrike?number(o.lightningStrikeDistanceMi,1)+' mi estimated':'Distance unavailable');
 put('strike-time',m.hasStrike?time(o.lightningStrikeLastAt)+(m.recentStrike?' · Recent':' · Historical detection'):'No detection time supplied');
 panel('lightning',m.weatherState,m.lightningAttention);stamp('lightning-stamp',m.weatherState,o.observedAt);
 const alerts=$('alerts');alerts.replaceChildren();document.querySelector('.alert-strip').dataset.state=m.alertState!=='current'?'unavailable':m.alerts.length?'warning':'current';
 if(m.alertState!=='current')alerts.textContent='Alert feed unavailable or out of date. Check NWS directly.';
 else if(!m.alerts.length)alerts.textContent='No active alerts returned for this location · Checked '+time(d.alerts.fetchedAt);
 for(const a of m.alerts){const detail=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p');summary.textContent=a.event+' · Until '+time(a.expires);p.textContent=a.headline+'\n\n'+(a.description||'');detail.append(summary,p);alerts.append(detail);}
 const now=Date.now();
 $('history-chart').innerHTML=riverGraph(m.points,{start:now-86400000,end:now,categories:m.cats});
 put('history-status', 'Gauge height in feet · '+(m.riverState==='current'?'Latest observation: ':m.riverState.toUpperCase()+' · Last observation: ')+time(m.stage?.t));
 const future=m.forecastState==='current'&&m.forecast.units==='ft'?(m.forecast.points||[]).filter(p=>p.t>=now):[];
 $('forecast-chart').innerHTML=riverGraph(future,{start:now,end:future.at(-1)?.t||now+86400000,categories:m.cats,forecast:true});
 put('graph-forecast-status','Issued '+time(m.forecast.issuedTime)+' · Forecast guidance can change.');
 renderWatershed(d.radar,d.basin);
}
const cameras=[[4222,'Hendersonville Rd at Lodge St.'],[4218,'Biltmore Ave at Meadow Rd'],[4214,'I-40 · Hendersonville Rd ramp']];
for(const [id,name] of cameras){const card=document.createElement('article');card.className='camera';card.innerHTML='<a href="https://www.drivenc.gov/map/Cctv/'+id+'" target="_blank" rel="noopener"><div class="camera-frame"><img id="cam-'+id+'" alt="'+name+' traffic camera" width="640" height="360"><span>Image unavailable · Open DriveNC ↗</span></div><h3>'+name+' ↗</h3></a><small id="cam-time-'+id+'">Awaiting image</small>';$('camera-grid').append(card);}
let cameraAt=0;
function refreshCameras(){if(Date.now()-cameraAt<10000)return;cameraAt=Date.now();for(const [id] of cameras){const img=$('cam-'+id);img.parentElement.classList.remove('loaded');img.onload=()=>{img.parentElement.classList.add('loaded');put('cam-time-'+id,'Retrieved '+time(Date.now())+' · Capture time unknown');};img.onerror=()=>put('cam-time-'+id,'Unavailable · Checked '+time(Date.now()));img.src='https://www.drivenc.gov/map/Cctv/'+id+'?refresh='+cameraAt;}}
let busy=false,lastAttempt=0;
async function refresh(){if(busy||document.hidden||Date.now()-lastAttempt<10000)return;busy=true;lastAttempt=Date.now();$('refresh').disabled=true;put('refresh-status','Updating…');try{const r=await fetch('/api/router?route=biltmore/current',{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();render(await r.json());put('refresh-status','Checked '+new Date().toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',timeZoneName:'short'}));}catch{render({});put('refresh-status','Update failed · Retry available');}finally{busy=false;$('refresh').disabled=false;}}
$('refresh').addEventListener('click',refresh);$('refresh-cameras').addEventListener('click',refreshCameras);refresh();refreshCameras();setInterval(()=>{refresh();if(!document.hidden&&Date.now()-cameraAt>=300000)refreshCameras();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
