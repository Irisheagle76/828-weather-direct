import test from 'node:test';
import assert from 'node:assert/strict';
import {windReading,pressureReading} from '../public/js/home-observation-format.js';
import {normalizeCurrent} from '../lib/api-routes/tempest/device.js';
test('wind direction, calm and missing observations stay distinct',()=>{
 assert.deepEqual(windReading(4.4,170,7.2),{value:'S 4 mph',detail:'Gust 7 mph'});
 assert.equal(windReading(10,360,20).value,'N 10 mph');
 assert.equal(windReading(0,90,0).value,'Calm');
 assert.deepEqual(windReading(null,null,null),{value:'— mph',detail:'Gust — mph'});
 assert.equal(windReading(10,null,20).value,'— 10 mph');
});
test('barometer never invents steady for an unknown trend or missing pressure',()=>{
 for(const [trend,label] of [['rising','↑ Rising'],['falling','↓ Falling'],['steady','→ Steady']]){
  const current=normalizeCurrent({sea_level_pressure:1026.3,pressure_trend:trend});
  assert.deepEqual(pressureReading(current.pressure*.02953,current.pressure_trend),{value:'30.31 inHg',detail:label});
 }
 assert.equal(pressureReading(30.31,normalizeCurrent({pressure_trend:'unknown'}).pressure_trend).detail,'Trend unavailable');
 assert.deepEqual(pressureReading(null,'steady'),{value:'— inHg',detail:'Trend unavailable'});
});
