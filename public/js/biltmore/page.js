import {CONFIG,change,concern} from './rules.js';
import {forecastSummary} from './forecast.js';
import {renderWatershed} from './watershed.js';
const el=id=>document.getElementById(id), put=(id,text)=>el(id).textContent=text;
const num=(v,d=2)=>Number.isFinite(v)?v.toFixed(d):'—';
const date=t=>t?new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'unavailable';
const stale=(source,t)=>source?.stale || !t || Date.now()-new Date(t).getTime()>CONFIG.staleMs;
function stamp(id,source,t){put(id,`Last updated: ${date(t)}${source?.unavailable?' · UNAVAILABLE':stale(source,t)?' · STALE / incomplete':' · Source observation'}${source?.fetchedAt?' · Checked '+date(source.fetchedAt):''}`);}
function metrics(id,items){el(id).replaceChildren(...items.map(([label,value])=>{const d=document.createElement('div');d.className='metric';const l=document.createElement('label');l.textContent=label;const s=document.createElement('strong');s.textContent=value;d.append(l,s);return d;}));}
function dial(id,value,max,unit,bands=[],inactive=false){
 const point=f=>[120-86*Math.cos(f*Math.PI),108-86*Math.sin(f*Math.PI)];
 const arc=(a,b,color)=>{const p=point(a),q=point(b);return `<path d="M ${p[0]} ${p[1]} A 86 86 0 0 1 ${q[0]} ${q[1]}" fill="none" stroke="${color}" stroke-width="13"/>`;};
 let svg=`<svg viewBox="0 0 240 155" role="img" aria-label="${inactive?'Unavailable or stale':num(value)+' '+unit} meter; display scale zero to ${num(max)} ${unit}">${arc(0,1,'#2c3c56')}`;
 if(!inactive){let previous=0;for(const [limit,color] of bands){const f=Math.min(1,limit/max);if(f>previous)svg+=arc(previous,f,color);previous=f;}if(previous<1)svg+=arc(previous,1,'#b56a8a');}
 for(let i=0;i<=4;i++){const a=point(i/4),b=[120+(a[0]-120)*.82,108+(a[1]-108)*.82];svg+=`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#aabbd4" stroke-width="1.5"/>`;}
 if(!inactive&&Number.isFinite(value)){const a=point(Math.max(0,Math.min(1,value/max)));svg+=`<line x1="120" y1="108" x2="${120+(a[0]-120)*.68}" y2="${108+(a[1]-108)*.68}" stroke="#edf3ff" stroke-width="3"/><circle cx="120" cy="108" r="6" fill="#edf3ff"/>`;}
 svg+=`<text x="120" y="145" text-anchor="middle" class="dial-value">${inactive?'UNAVAILABLE':num(value)+' '+unit}</text><text x="25" y="126">0</text><text x="215" y="126" text-anchor="end">${num(max,1)}</text></svg>`;el(id).innerHTML=svg;
}
function movement(rate,inactive){
 const maximum=CONFIG.meters.trendMaxFtHr,x=120+Math.max(-1,Math.min(1,(rate||0)/maximum))*92;
 el('trend-meter').innerHTML=`<svg viewBox="0 0 240 155" role="img" aria-label="${inactive?'Unavailable':num(rate*12,1)+' inches per hour'}; falling on left, rising on right; scale minus 12 to plus 12 inches per hour"><path d="M28 62 H212" stroke="#263c59" stroke-width="18" stroke-linecap="round"/><path d="M28 62 H116" stroke="${inactive?'#344257':'#5295ba'}" stroke-width="9"/><path d="M124 62 H212" stroke="${inactive?'#344257':'#c5804c'}" stroke-width="9"/><line x1="120" x2="120" y1="42" y2="82" stroke="#9fb0d1"/>${inactive?'':`<circle cx="${x}" cy="62" r="8" fill="#f1f5ff" stroke="#121a2b" stroke-width="3"/>`}<text x="28" y="99">FALLING</text><text x="212" y="99" text-anchor="end">RISING</text><text x="120" y="145" text-anchor="middle" class="dial-value">${inactive?'UNAVAILABLE':num(rate*12,1)+' inches/hr'}</text><text x="28" y="28">−${maximum*12}</text><text x="120" y="28" text-anchor="middle">0</text><text x="212" y="28" text-anchor="end">+${maximum*12}</text></svg>`;
}
const concernNames={LOW:'Lower concern',MONITOR:'Keep watching',ELEVATED:'Concern increasing',HIGH:'High concern',FLOODING:'Flood-stage reached'};
function concernRail(level){el('concern-meter').replaceChildren(...['LOW','MONITOR','ELEVATED','HIGH','FLOODING'].map((name,i)=>{const span=document.createElement('span');span.textContent=concernNames[name];span.dataset.index=i;span.className=name===level?'active':'';if(name===level)span.setAttribute('aria-current','true');return span;}));}
let cameraChecked=0;
function loadCameras(force=false){
 if(!force&&Date.now()-cameraChecked<CONFIG.refreshMs)return;cameraChecked=Date.now();
 for(const id of [4222,4218]){const img=el('camera-'+id),frame=img.parentElement;frame.classList.remove('loaded');
 img.onload=()=>{frame.classList.add('loaded');put('camera-time-'+id,'Still retrieved '+date(Date.now())+' · Capture time unknown');};
 img.onerror=()=>{frame.classList.remove('loaded');put('camera-time-'+id,'Still unavailable · Checked '+date(Date.now()));};
 img.src=`https://www.drivenc.gov/map/Cctv/${id}?biltmoreRefresh=${Date.now()}`;}
}
// Shared real-time axis. Never interpolate across missing observation gaps.
function chart(id,points,rain=[]){
 const end=Date.now(),start=end-86400000,ps=points.filter(p=>p.t>=start&&p.t<=end);
 if(ps.length<2){put(id,'Recent stage graph unavailable · no complete observation series');return;}
 const lo=Math.min(...ps.map(p=>p.v))-.1,hi=Math.max(...ps.map(p=>p.v))+.1;
 const x=t=>52+(t-start)/86400000*338,y=v=>25+(hi-v)/(hi-lo)*130;
 const paths=[];ps.forEach((p,i)=>{if(i===0||p.t-ps[i-1].t>CONFIG.maxMatchMs)paths.push([]);paths.at(-1).push(`${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`);});
 let markup=`<svg viewBox="0 0 430 215" role="img" aria-label="Swannanoa stage over the last 24 hours in feet. Rainfall archive ${rain.length?'connected':'unavailable'}. Gaps are not filled."><text x="52" y="12">ZOOMED STAGE SCALE</text>`;
 for(let i=0;i<3;i++){const v=lo+(hi-lo)*i/2;markup+=`<line x1="52" x2="390" y1="${y(v)}" y2="${y(v)}" stroke="#2a3c59"/><text x="2" y="${y(v)+4}">${num(v)} ft</text>`;}
 // Future adapter supplies actual interval totals: {t, start, inches}; no zero-fill.
 for(const p of rain.filter(p=>p.t>=start&&p.t<=end&&Number.isFinite(p.inches))){const height=Math.min(100,p.inches*100);markup+=`<rect x="${x(p.start)}" y="${155-height}" width="${Math.max(1,x(p.t)-x(p.start))}" height="${height}" fill="#db6e2d" opacity=".65"/>`;}
 markup+=paths.map(p=>`<polyline points="${p.join(' ')}" fill="none" stroke="#84baff" stroke-width="2.5"/>`).join('');
 for(let i=0;i<=2;i++){const t=start+i*43200000;markup+=`<text x="${x(t)}" y="181" text-anchor="middle">${new Date(t).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})}</text>`;}
 markup+=`<line x1="390" x2="390" y1="14" y2="157" stroke="#e79359" stroke-dasharray="4 4"/><text x="390" y="12" text-anchor="end">NOW</text><text x="52" y="207">Eastern time${rain.length?' · Orange bars show measured rain':id==='stage-chart'?' · River level in feet':' · Rain history unavailable, not zero'}</text></svg>`;
 el(id).innerHTML=markup;
}
function rainChart(rain){
 const hours=rain.hourly||[];if(!hours.length){put('rain-history-chart','Rainfall history unavailable');return;}
 const max=Math.max(.1,...hours.map(p=>p.inches||0)),width=338/24;
 let svg=`<svg viewBox="0 0 430 210" role="img" aria-label="${rain.demo?'Huntington Chase demonstration':'Biltmore'} measured hourly rainfall in inches, missing intervals are hatched"><text x="52" y="14">HOURLY RAINFALL · INCHES</text>`;
 for(let i=0;i<3;i++){const value=max*i/2,y=155-value/max*120;svg+=`<line x1="52" x2="390" y1="${y}" y2="${y}" stroke="#293b57"/><text x="4" y="${y+4}">${num(value)}</text>`;}
 hours.forEach((p,i)=>{const x=52+i*width;if(p.inches===null)svg+=`<text x="${x+width/2}" y="149" text-anchor="middle">×</text>`;else{const h=p.inches/max*120;svg+=h>0?`<rect x="${x+1}" y="${155-h}" width="${width-2}" height="${h}" fill="#e79359"/>`:`<line x1="${x+2}" x2="${x+width-2}" y1="155" y2="155" stroke="#e79359" stroke-width="2"/>`;}});
 for(const i of [0,12,23])svg+=`<text x="${52+(i+.5)*width}" y="179" text-anchor="middle">${new Date(hours[i].t).toLocaleTimeString('en-US',{timeZone:rain.timezone||'America/New_York',hour:'numeric'})}</text>`;
 svg+=`<text x="52" y="204">${rain.demo?'Huntington Chase demo':'Biltmore'} · × missing · No gap filling</text></svg>`;el('rain-history-chart').innerHTML=svg;
}
function render(d){
 renderForecast(d.forecast,d.river?.stage||[],d.noaa?.categories);renderWatershed(d.radar,d.basin);
 const points=d.river?.stage||[],last=points.at(-1),flow=d.river?.flow?.at(-1),c1=change(points,1),c3=change(points,3),c6=change(points,6);
 const obs=d.station?.observation||{},s=obs.observedAt;
 const rain=d.rainfall||{},rainTime=rain.observedAt;
 put('temperature',`${num(obs.temperatureF,1)} °F`);put('weather',`Dew point ${num(obs.dewPointF,1)} °F · Wind ${num(obs.windMph,1)} mph`);
 put('today',`${num(rain.today?.inches)} in`);put('rate',`${num(rain.rainRateInHr)} in/hr · ${rain.sampleMinutes||'—'}-min avg${stale(rain,rainTime)?' · stale / unavailable':''}`);
 put('rain-summary-label',rain.demo?'RAINFALL · HUNTINGTON CHASE DEMO':'RAINFALL · BILTMORE');
 put('rain-meter-label',rain.demo?'RAIN · HUNTINGTON CHASE DEMO':'RAIN RIGHT NOW');
 put('rain-demo-label',rain.demo?'PROOF OF CONCEPT · HUNTINGTON CHASE':'LOCAL SENSOR · 828 BILTMORE');
 put('rain-demo-note',rain.demo?'Real Huntington Chase readings, not Biltmore rainfall. Excluded from Biltmore flood analysis.':'Actual Biltmore sensor readings.');
 put('stage',`${num(last?.v)} ft`);const trend=c1?c1.value>CONFIG.trendToleranceFt?'↑ Rising':c1.value<-CONFIG.trendToleranceFt?'↓ Falling':'→ Nearly steady':'Trend unavailable';
 put('trend',`${trend} · ${c1?num(c1.value*12,1)+' inches in the past hour':'Recent change unavailable'}${stale(d.river,last?.t)?' · Reading out of date':''}`);
 const officialWarning=!d.alerts?.stale&&(d.alerts?.items||[]).some(a=>/^(Flash Flood Warning|Flood Warning)$/.test(a.event)&&Date.parse(a.expires)>Date.now());
 const status=concern({stage:last?.v,categories:d.noaa?.categories,stale:stale(d.river,last?.t)||d.noaa?.stale||d.noaa?.unavailable,delta:c1?.value,officialWarning});
 put('level',concernNames[status.level]);put('analysis',status.text+' Experimental 828 Weather Direct analysis—not an official NWS alert.');
 put('river-explained',stale(d.river,last?.t)?'The river reading is missing or more than an hour old. Check the official gauge before relying on it.':Number.isFinite(categoriesForHelp(d)?.minor)?`${last.v>=d.noaa.categories.minor?'The river has reached the official flood-stage mark.':`The river is ${num(d.noaa.categories.minor-last.v,1)} feet below the official flood-stage mark.`} ${c1?Math.abs(c1.value)<=CONFIG.trendToleranceFt?'It has changed very little in the past hour.':`It has ${c1.value>0?'risen':'fallen'} about ${num(Math.abs(c1.value)*12,1)} inches in the past hour.`:'We do not have enough readings to show the recent change.'} This does not tell us whether every nearby street is dry.`:'Official flood-stage information is unavailable. Check NOAA directly.');
 concernRail(status.level);
 const categories=d.noaa?.categories,stageInactive=stale(d.river,last?.t)||!Number.isFinite(categories?.major)||d.noaa?.stale||d.noaa?.unavailable;
 dial('stage-meter',last?.v,categories?.major,'ft',[[categories?.action,'#467faa'],[categories?.minor,'#d9bd70'],[categories?.moderate,'#dd934d'],[categories?.major,'#c35d66']],stageInactive);
 put('stage-meter-caption',stageInactive?'Reading or official marks out of date':last.v>=categories.minor?'At or above the flood-stage mark':num(categories.minor-last.v,1)+' feet below the flood-stage mark');
 movement(c1?.rate,stale(d.river,last?.t)||!c1);put('trend-meter-caption',stale(d.river,last?.t)?'Reading missing or out of date':trend+' · Average change over the past hour');
 dial('rain-meter',rain.rainRateInHr,CONFIG.meters.rainRateMaxInHr,'in/hr',[[CONFIG.meters.rainRateMaxInHr,'#608fc7']],stale(rain,rainTime)||!Number.isFinite(rain.rainRateInHr));
 put('rain-meter-caption',stale(rain,rainTime)?'Sensor unavailable / stale':`${rain.sampleMinutes}-min sensor average${rain.demo?' · DEMO, NOT BILTMORE':''}`);
 document.body.dataset.mode=['ELEVATED','HIGH','FLOODING'].includes(status.level)?'elevated':'normal';
 put('now-time',`River: ${date(last?.t)}${stale(d.river,last?.t)?' · stale / unavailable':''} · Village weather: ${date(s)} · ${rain.demo?'Demo rain':'Rain'}: ${date(rainTime)}${stale(rain,rainTime)?' · stale / unavailable':''}`);
 metrics('river-metrics',[['RIVER LEVEL',num(last?.v)+' ft'],['WATER FLOW',num(flow?.v,0)+' ft³/s'],['CHANGE · PAST HOUR',num(c1?.value*12,1)+' inches'],['CHANGE · 3 HOURS',num(c3?.value*12,1)+' inches'],['CHANGE · 6 HOURS',num(c6?.value*12,1)+' inches'],['AVERAGE CHANGE / HOUR',num(c1?.rate*12,1)+' inches/hr']]);
 chart('stage-chart',points);chart('response-chart',points,rain.hourly||[]);rainChart(rain);
 put('response-title',rain.demo?'Demo only: rain and river are from different places':rain.hourly?.length?'Rainfall beside the river level':'Rainfall history not connected');
 put('response-text',rain.demo?'Huntington Chase rainfall and the Biltmore gauge are at different locations. This demonstrates time-aligned plotting only, not a rainfall-versus-river-response relationship.':'Time-aligned rainfall and stage do not by themselves establish causation.');
 put('rain-legend',rain.demo?'▥ Rain · Huntington Chase demo':'▥ Rainfall · inches / hour');
 const cats=d.noaa?.categories;put('thresholds',cats?`Official NOAA river marks · Start paying closer attention: ${num(cats.action,1)} ft · Flood stage: ${num(cats.minor,1)} ft · Moderate flooding: ${num(cats.moderate,1)} ft · Major flooding: ${num(cats.major,1)} ft${d.noaa.stale?' · Information may be out of date':''}`:'Official river marks unavailable');
 stamp('river-time',d.river,last?.t);el('river-time').textContent+=` · Discharge: ${date(flow?.t)}${stale(d.river,flow?.t)?' · STALE / unavailable':''}`;
 put('noaa-time',`NOAA metadata checked: ${date(d.noaa?.fetchedAt)}${d.noaa?.stale?' · STALE':''} · Reported gauge category: ${d.noaa?.status?.observed?.floodCategory||'unavailable'} (${date(d.noaa?.status?.observed?.validTime)}) · Not a warning`);
 metrics('rain-metrics',[['HOW HARD IT IS RAINING',num(rain.rainRateInHr)+' in/hr'],['PAST HOUR',num(rain.rolling?.[1]?.inches)+' in'],['PAST 3 HOURS',num(rain.rolling?.[3]?.inches)+' in'],['PAST 6 HOURS',num(rain.rolling?.[6]?.inches)+' in'],['SINCE MIDNIGHT',num(rain.today?.inches)+' in']]);stamp('rain-time',rain,rainTime);stamp('station-time',d.station,s);stamp('response-time',d.river,last?.t);el('response-time').textContent+=` · ${rain.demo?'Demo rain':'Rain'}: ${date(rainTime)}`;
 el('rain-coverage').replaceChildren(...[1,3,6,'today'].map(h=>{const result=h==='today'?rain.today:rain.rolling?.[h],span=document.createElement('span');span.textContent=`${h==='today'?'TODAY':h+'H'} · ${Math.round((result?.coverage||0)*100)}% covered`;if(result?.inches!==null&&Number.isFinite(result?.inches))span.className='complete';return span;}));
 put('station-values',`Temperature ${num(obs.temperatureF,1)} °F · Dew point ${num(obs.dewPointF,1)} °F · Wind ${num(obs.windMph,1)} mph · Gust ${num(obs.gustMph,1)} mph`);
 put('village-access',d.station?.unavailable?'We cannot load this station’s readings right now. The station itself may still be operating.':stale(d.station,s)?'These readings may be out of date · Neighbor’s weather station':'Latest available readings · Neighbor’s weather station');
 put('village-rain',`Station rain today ${num(obs.rainTodayIn)} in · Rate ${num(obs.rainRateInHr)} in/hr · Humidity ${num(obs.humidityPct,0)}%`);
 const alerts=el('alerts');alerts.replaceChildren();if(d.alerts?.unavailable)alerts.textContent='Official alert feed unavailable. Check NWS directly; this is not an all-clear.';else if(!d.alerts?.items?.length)alerts.textContent='No active NWS alerts returned for the Biltmore Village point at last check. Nearby or developing hazards may differ.';
 for(const a of d.alerts?.items||[]){const article=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p');h.textContent=a.event;p.textContent=a.headline+' · Expires '+date(a.expires);article.append(h,p);const details=document.createElement('details'),summary=document.createElement('summary'),description=document.createElement('p');summary.textContent='Read official alert';description.textContent=a.description;details.append(summary,description);article.append(details);alerts.append(article);}
 stamp('alerts-time',d.alerts,d.alerts?.fetchedAt);
}
function renderForecast(f,observed,categories){
 const now=Date.now(),s=forecastSummary(f,now);
 put('forecast-time',`Issued: ${date(f?.issuedTime)}${s.stale?' · STALE':''}${f?.fetchedAt?' · Checked '+date(f.fetchedAt):''}`);
 if(s.unavailable){el('forecast-metrics').replaceChildren();put('forecast-chart','Official future forecast unavailable · Check NOAA directly');put('forecast-note','No forecast is inferred from observed stage.');return;}
 metrics('forecast-metrics',[['HIGHEST LEVEL EXPECTED',num(s.peak,1)+' ft'],['OUTLOOK ENDS',date(s.points.at(-1).t)]]);
 put('forecast-note',`${s.stale?'This forecast may be out of date. Check NOAA for the latest. ':''}${s.flat?'NOAA expects the river level to hold roughly steady.':'NOAA’s highest predicted reading is '+num(s.peak,1)+' feet, around '+date(s.firstPeak)+(s.lastPeak!==s.firstPeak?' through '+date(s.lastPeak):'')+'.'} The dashed line shows what NOAA expects next—not readings that have already happened. Forecasts can change and do not rule out local flooding.`);
 const start=now-86400000,end=s.points.at(-1).t,obs=observed.filter(p=>p.t>=start&&p.t<=now),all=[...obs,...s.points],lo=Math.min(...all.map(p=>p.v))-.2,hi=Math.max(...all.map(p=>p.v))+.2;
 const x=t=>52+(t-start)/(end-start)*338,y=v=>25+(hi-v)/(hi-lo)*130;
 let svg='<svg viewBox="0 0 430 215" role="img" aria-label="Observed river stage in feet followed by a separate dashed official NOAA forecast; Eastern dates"><text x="52" y="12">ZOOMED STAGE SCALE · FT</text>';
 for(let i=0;i<3;i++){const v=lo+(hi-lo)*i/2;svg+=`<line x1="52" x2="390" y1="${y(v)}" y2="${y(v)}" stroke="#293b57"/><text x="3" y="${y(v)+4}">${num(v)}</text>`;}
 for(const [ps,color,gap,dash] of [[obs,'#84baff',CONFIG.maxMatchMs,''],[s.points,'#c5a8ff',12*3600000,'6 4']]){const paths=[];ps.forEach((p,i)=>{if(!i||p.t-ps[i-1].t>gap)paths.push([]);paths.at(-1).push(`${x(p.t)},${y(p.v)}`);});svg+=paths.map(path=>`<polyline points="${path.join(' ')}" fill="none" stroke="${color}" stroke-width="2.5" stroke-dasharray="${dash}"/>`).join('');}
 svg+=`<line x1="${x(now)}" x2="${x(now)}" y1="18" y2="157" stroke="#e79359" stroke-dasharray="3 3"/><text x="${x(now)}" y="177" text-anchor="middle">NOW</text>`;
 for(const t of [start,end])svg+=`<text x="${x(t)}" y="195" text-anchor="${t===start?'start':'end'}">${date(t)}</text>`;
 svg+='</svg>';el('forecast-chart').innerHTML=svg;
}
let busy=false;
async function refresh(){if(busy||document.hidden)return;loadCameras();busy=true;try{const r=await fetch('/experimental/biltmore/data',{signal:AbortSignal.timeout(25000)});if(!r.ok)throw Error();render(await r.json());}catch{render({river:{unavailable:true},noaa:{unavailable:true},station:{unavailable:true},alerts:{unavailable:true}});}finally{busy=false;}}
el('camera-refresh').addEventListener('click',()=>{if(Date.now()-cameraChecked>10000)loadCameras(true);});
function categoriesForHelp(d){return d.noaa?.stale||d.noaa?.unavailable?null:d.noaa?.categories;}
// Plain-language presentation only; no data-source or flood-rule changes.
function accessibleCopy(){
 const title=(id,text)=>el(id).querySelector('h2').textContent=text;
 title('river','How is the river doing?');title('rain','How much rain has fallen?');title('forecast','What might the river do next?');title('watershed','Rain heading toward the river');title('response','Rain and river, side by side');title('stations','Nearby weather stations');title('official','Official weather warnings & alerts');
 const nowLabels=el('now').querySelectorAll('.now-grid>div>label');nowLabels[0].textContent='WEATHER IN THE VILLAGE';nowLabels[2].textContent='RIVER LEVEL AT BILTMORE';nowLabels[3].textContent='SHOULD I PAY CLOSER ATTENTION?';
 const meterLabels=el('now').querySelectorAll('.meter-grid article>label');meterLabels[0].textContent='HOW HIGH IS THE RIVER?';meterLabels[1].textContent='IS IT RISING OR FALLING?';
 const help=document.createElement('p');help.id='river-explained';help.className='public-summary';help.textContent='Checking the latest river reading…';el('river').querySelector('.heading').after(help);
 const guide=document.createElement('p');guide.className='reading-guide';guide.textContent='Think of the gauge as a fixed ruler for the river. The number is not the water’s depth. A rising line means the water is getting higher; the chart zooms in, so small changes can look large.';el('stage-chart').after(guide);
 const safety=document.createElement('p');safety.className='reading-guide';safety.textContent='The meter colors mark official river levels—not safe or unsafe streets. Orange begins at the flood-stage mark. A lower river reading does not rule out flooding from heavy rain.';el('now').querySelector('.meter-grid').after(safety);
 el('river').querySelector('details .note').textContent='River level is measured against a fixed reference point at the gauge. It is not water depth, and it cannot be compared directly with street elevation. USGS readings can be revised. Water flow means the amount of water passing the gauge each second.';
 el('response').querySelector('.legend span').textContent='━ River level · feet';el('forecast').querySelector('.legend span').textContent='━ Already measured';el('forecast').querySelector('.legend b').textContent='┄ Expected next · NOAA';
 el('watershed').querySelector('.heading label').textContent='WHERE UPSTREAM RAIN CAN REACH BILTMORE';el('radar-reset').textContent='Show whole area ↻';
}
accessibleCopy();
refresh();setInterval(refresh,CONFIG.refreshMs);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
