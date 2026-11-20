// Numeric SVG coordinates only; no external text is interpolated into markup.
export function riverGraph(points,{start,end,categories,forecast=false}={}) {
 const ps=(points||[]).filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.v)&&p.t>=start&&p.t<=end).sort((a,b)=>a.t-b.t);
 if(ps.length<2||!(end>start))return '<p class="graph-empty">'+(forecast?'Current forecast':'River history')+' unavailable</p>';
 const lo=Math.min(...ps.map(p=>p.v)),hi=Math.max(...ps.map(p=>p.v)),pad=Math.max(.1,(hi-lo)*.15),low=Math.max(0,lo-pad),high=hi+pad;
 const x=t=>58+(t-start)/(end-start)*510,y=v=>180-(v-low)/(high-low)*150;
 let body='';
 for(let i=0;i<4;i++){const v=low+(high-low)*i/3,yy=y(v);body+=`<line x1="58" x2="568" y1="${yy}" y2="${yy}" stroke="#cadbe4"/><text x="50" y="${yy+4}" text-anchor="end">${v.toFixed(2)}</text>`;}
 for(let i=0;i<3;i++){const t=start+(end-start)*i/2;body+=`<text x="${x(t)}" y="211" text-anchor="${i===0?'start':i===2?'end':'middle'}">${new Date(t).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric'})}</text>`;}
 for(const [key,label] of [['action','Action'],['minor','Flood']]){const v=categories?.[key];if(Number.isFinite(v)&&v>=low&&v<=high)body+=`<line x1="58" x2="568" y1="${y(v)}" y2="${y(v)}" stroke="#b96b20" stroke-dasharray="5 4"/><text x="566" y="${y(v)-5}" text-anchor="end">${label} ${v.toFixed(1)} ft</text>`;}
 const segments=[];ps.forEach((p,i)=>{if(!i||p.t-ps[i-1].t>(forecast?43200000:1200000))segments.push([]);segments.at(-1).push(p);});
 body+=segments.map(segment=>`<polyline points="${segment.map(p=>`${x(p.t)},${y(p.v)}`).join(' ')}" fill="none" stroke="${forecast?'#7952a7':'#2078ac'}" stroke-width="3" ${forecast?'stroke-dasharray="7 4"':''}/>`+segment.map(p=>`<circle cx="${x(p.t)}" cy="${y(p.v)}" r="2" fill="${forecast?'#7952a7':'#2078ac'}"><title>${p.v.toFixed(2)} ft · ${new Date(p.t).toISOString()}</title></circle>`).join('')).join('');
 return `<svg viewBox="0 0 600 230" role="img" aria-label="${forecast?'Forecast':'Observed'} river gage height in feet, zoomed scale, Eastern time"><text x="58" y="15">Feet · zoomed scale</text>${body}</svg>`;
}
export function compactDial(value,{max=2,categories=null,label='Rain rate'}={}) {
 const valid=Number.isFinite(value),point=v=>{const a=Math.PI*(1-Math.max(0,Math.min(1,v/max)));return [100+78*Math.cos(a),92-78*Math.sin(a)];};
 const arc=(a,b,color)=>{const p=point(a),q=point(b);return `<path d="M ${p.join(' ')} A 78 78 0 ${b-a>max/2?1:0} 1 ${q.join(' ')}" fill="none" stroke="${color}" stroke-width="12"/>`;};
 let bands=arc(0,max,'#a0d9ef');
 if(categories&&[categories.action,categories.minor,categories.moderate,categories.major].every(Number.isFinite)&&0<categories.action&&categories.action<categories.minor&&categories.minor<categories.moderate&&categories.moderate<categories.major&&categories.major<max){const stops=[0,categories.action,categories.minor,categories.moderate,categories.major,max],colors=['#70bce4','#f4de6b','#f5b855','#ed8b5c','#d85870'];bands=colors.map((c,i)=>arc(stops[i],stops[i+1],c)).join('');}
 const p=point(valid?value:0),needle=valid?`<line x1="100" y1="92" x2="${100+(p[0]-100)*.78}" y2="${92+(p[1]-92)*.78}" stroke="#286d99" stroke-width="3"/><circle cx="100" cy="92" r="5" fill="#286d99"/>`:'<text x="100" y="78" text-anchor="middle">Unavailable</text>';
 return `<svg viewBox="0 0 200 116" role="img" aria-label="${label}: ${valid?value.toFixed(2):'unavailable'}. Display scale zero to ${max}.">${bands}${needle}<text x="20" y="113">0</text><text x="180" y="113" text-anchor="end">${max.toFixed(1)}${valid&&value>max?' +':''}</text></svg>`;
}
export function compactTrend(rate) {
 const valid=Number.isFinite(rate),x=100+Math.max(-12,Math.min(12,valid?rate:0))/12*78;
 return `<svg viewBox="0 0 200 60" role="img" aria-label="Hourly river trend: ${valid?rate.toFixed(1)+' inches per hour':'unavailable'}"><text x="22" y="12">−12</text><text x="100" y="12" text-anchor="middle">0</text><text x="178" y="12" text-anchor="end">+12</text><path d="M22 29H100" stroke="#7dcdd9" stroke-width="7"/><path d="M100 29H178" stroke="#efbc69" stroke-width="7"/>${valid?`<circle cx="${x}" cy="29" r="6" fill="#286d99" stroke="white" stroke-width="2"/>`:''}<text x="22" y="53">Falling</text><text x="178" y="53" text-anchor="end">Rising</text></svg>`;
}
