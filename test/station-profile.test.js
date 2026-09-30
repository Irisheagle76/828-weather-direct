import test from 'node:test';
import assert from 'node:assert/strict';
import { stationProfileCards } from '../public/js/station-profile.js';
const now = Date.now();
const observation = { temperatureF:77.7, dewPointF:54.1, humidityPct:44, windMph:1.3, windGustMph:2.2, windDirectionDeg:279, seaLevelPressureMb:1022.4, precipitationTodayIn:0, observedAt:new Date(now).toISOString() };
test('station profile combines related measurements into four essential cards',()=>{
  const cards=stationProfileCards(observation,now);
  assert.equal(cards.length,4);
  assert.equal(cards[0].kind,'conditions');
  assert.equal(cards[0].value,'77.7°F');
  assert.equal(cards[0].dewPoint,'54.1°F');
  assert.equal(cards[0].humidity,'44%');
  assert.equal(cards[1].value,'1.3 mph from W');
  assert.equal(cards[1].detail,'Gust 2.2 mph');
  assert.equal(cards[3].value,'0.00 in');
});
test('UV and lightning appear only when applicable, excluding old and stale detections',()=>{
  assert.equal(stationProfileCards({...observation,uvIndex:0,lightningStrikeCount:0,lightningStrikeLastAt:now-86400000},now).length,4);
  const live={...observation,uvIndex:6.9,lightningStrikeCount:1,lightningStrikeLastAt:now-60000,lightningStrikeDistanceMi:8};
  assert.equal(stationProfileCards(live,now).length,6);
  assert.equal(stationProfileCards(live,now).at(-1).detail,'Last detected 1 min ago');
  assert.equal(stationProfileCards({...live,observedAt:new Date(now-240000).toISOString()},now).length,5);
});
