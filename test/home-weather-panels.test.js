import test from 'node:test';
import assert from 'node:assert/strict';
import { hourlyWind, clothingDetail, comfortFeel, headsUpAction } from '../public/js/intel/home-weather-panels.js';
import { forecastComfortCopy } from '../public/js/intel/forecast-comfort-context.js';
test('hourly tiles distinguish sustained wind from meaningful gusts without inventing missing values', () => {
  assert.deepEqual(hourlyWind({windSpeed:12,windGust:29}),{speed:12,gust:29});
  assert.deepEqual(hourlyWind({windSpeed:8,windGust:12}),{speed:8,gust:null});
  assert.deepEqual(hourlyWind({}),{speed:null,gust:null});
});
test('comfort clothing and heads-up translate forecast changes into actions', () => {
  assert.match(clothingDetail('Bring a light jacket'),/long-sleeve/);
  assert.equal(comfortFeel({temperatureF:35}).label,'Bundle up');
  assert.equal(comfortFeel({}).label,'Updating');
  assert.match(headsUpAction({text:'Cooling quickly — about 8° over the next 3 hours.'}),/warmer layer/);
});
test('homepage extended outlook includes evening while default six-hour copy stays bounded', () => {
  const now=Date.parse('2026-11-12T15:00:00Z');
  const hourly=Array.from({length:13},(_,i)=>({timestamp:now+(i+1)*3600000,temperatureF:60-i,windSpeed:5,cloudCover:.5,precipProbability:0}));
  hourly[10].windGust=35;
  const short=forecastComfortCopy({hourly,now});
  const full=forecastComfortCopy({hourly,now,horizonHours:14});
  assert.doesNotMatch(short.weatherNarrative,/35 mph/);
  assert.match(full.weatherNarrative,/35 mph/);
});
