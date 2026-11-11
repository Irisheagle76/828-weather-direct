import test from 'node:test';
import assert from 'node:assert/strict';
import {teaser} from '../public/js/awpi-teaser.js';
test('homepage indicators share the snow peak date rather than mixing maxima',()=>{
 const days=[{date:'2099-11-10',cold:100,storm:0,snow:0,confidence:'Moderate'},{date:'2099-11-11',cold:30,storm:40,snow:60,confidence:'Low'}];
 const result=teaser({days});assert.equal(result.day,days[1]);assert.equal(result.day.cold,30);assert.equal(result.day.storm,40);
});
test('missing scores are unavailable and old guidance has no current-weather headline',()=>{
 assert.equal(teaser({days:[{cold:100,storm:90,snow:null}]}),null);
 const result=teaser({stale:true,days:[{date:'2000-01-01',cold:100,storm:100,snow:100}]});
 assert.match(result.headline,/Previous outlook/);
});
