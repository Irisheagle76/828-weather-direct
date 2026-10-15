import test from 'node:test';
import assert from 'node:assert/strict';
import { renderComfortCard } from '../public/mobile/comfort-cards.js';
const options={formatTime:()=> '2 PM',escapeHtml:s=>String(s).replaceAll('<','&lt;')};
const bucket={name:'Early afternoon',label:'12–3 PM',min:55,max:69,tempMin:81,tempMax:85,points:[{hour:{timestamp:1,temperatureF:84},score:6.3}],takeaway:'Warm afternoon'};
test('temperature degrees and comfort scale have separate labeled territories',()=>{
 const html=renderComfortCard(bucket,options);
 assert.match(html,/Temperature/);assert.match(html,/81–85<span class="bucket-unit">°F/);
 assert.match(html,/FEELSCORE/);assert.match(html,/55–69<span class="bucket-unit">\/100/);
 assert.match(html,/Outdoor comfort index/);assert.match(html,/Explore hour by hour/);
 assert.match(html,/84°F/);assert.match(html,/63\/100/);
 assert.ok(html.indexOf('bucket-air')<html.indexOf('bucket-comfort'));
});
test('missing readings remain unavailable, and score of zero remains valid',()=>{
 const missing=renderComfortCard({...bucket,min:null,max:null,tempMin:null,tempMax:null,points:[]},options);
 assert.match(missing,/Guidance unavailable/);assert.doesNotMatch(missing,/null|undefined|NaN/);
 const zero=renderComfortCard({...bucket,min:0,max:0,tempMin:0,tempMax:0},options);
 assert.match(zero,/0<span class="bucket-unit">°F/);assert.match(zero,/0<span class="bucket-unit">\/100/);
});
