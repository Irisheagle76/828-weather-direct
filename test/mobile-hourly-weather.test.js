import test from 'node:test';
import assert from 'node:assert/strict';
import {hourlyWeather} from '../public/mobile/hourly-weather.js';
import {renderComfortCard} from '../public/mobile/comfort-cards.js';
test('hourly icons cover clear, rain, snow, storms and unavailable weather',()=>{
 assert.equal(hourlyWeather({weatherCode:0}).label,'Clear');
 assert.equal(hourlyWeather({weatherCode:63}).icon,'🌧️');
 assert.equal(hourlyWeather({weatherCode:73}).icon,'🌨️');
 assert.equal(hourlyWeather({weatherCode:95}).icon,'⛈️');
 assert.equal(hourlyWeather({weatherCode:null}).label,'Weather unavailable');
});
test('clear hours use the moon after local sunset and before sunrise',()=>{
 const daily=[{sunrise:Date.parse('2026-10-15T11:35:00Z'),sunset:Date.parse('2026-10-15T22:55:00Z')}];
 assert.equal(hourlyWeather({weatherCode:0,timestamp:Date.parse('2026-10-15T23:00:00Z')},daily).icon,'🌙');
 assert.equal(hourlyWeather({weatherCode:0,timestamp:Date.parse('2026-10-15T17:00:00Z')},daily).icon,'☀️');
});
test('precipitation badge starts at 20 percent and never invents missing probabilities',()=>{
 const bucket={name:'Evening',label:'5–8 PM',min:70,max:80,tempMin:60,tempMax:70,takeaway:'',points:[]};
 const options={formatTime:()=> '6 PM',escapeHtml:String};
 for(const [probability,shown] of [[null,false],[0,false],[.19,false],[.2,true],[.5,true],[40,true]]){
   const html=renderComfortCard({...bucket,points:[{hour:{timestamp:1,temperatureF:65,weatherCode:63,precipProbability:probability},score:7}]},options);
   assert.equal(html.includes('hourly-precip'),shown);
   assert.match(html,/aria-label="Rain"/);
   assert.match(html,/65°F/);
   assert.match(html,/70\/100/);
 }
});
