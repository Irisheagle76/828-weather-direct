const number = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function windReading(speed, direction, gust) {
 const s=number(speed), d=number(direction), g=number(gust);
 const compass=d!==null&&d>=0&&d<=360?['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(d/22.5)%16]:null;
 return {value:s===null?'— mph':s<0.5?'Calm':[(compass||'—'),Math.round(s),'mph'].join(' '),detail:g===null?'Gust — mph':'Gust '+Math.round(g)+' mph'};
}
export function pressureReading(inHg, trend) {
 const p=number(inHg), labels={rising:'↑ Rising',falling:'↓ Falling',steady:'→ Steady'};
 return {value:p!==null&&p>0?p.toFixed(2)+' inHg':'— inHg',detail:p!==null&&p>0?(labels[String(trend).toLowerCase()]||'Trend unavailable'):'Trend unavailable'};
}
