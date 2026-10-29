import test from 'node:test';
import assert from 'node:assert/strict';
import {stationState,compass} from '../public/js/biltmore/tempest-card.js';
const now=Date.parse('2026-10-29T16:00:00Z');
const source=(values={})=>({observation:{observedAt:new Date(now).toISOString(),precipitationRateInHr:0,lightningStrikes1h:0,...values}});
test('heavy rain triggers emphasis without requiring lightning',()=>{assert.equal(stationState(source({precipitationRateInHr:.3}),now).emphasis,true);assert.equal(stationState(source({precipitationRateInHr:.29}),now).emphasis,false);});
test('recent lightning triggers even while dry; historical detection does not',()=>{assert.equal(stationState(source({lightningStrikeLastAt:now-5*60000}),now).emphasis,true);assert.equal(stationState(source({lightningStrikeLastAt:now-86400000}),now).emphasis,false);assert.equal(stationState(source({lightningStrikes1h:2}),now).emphasis,true);});
test('missing, future and stale observations never imply dry conditions or trigger emphasis',()=>{for(const s of [{},source({observedAt:new Date(now-11*60000).toISOString(),precipitationRateInHr:2}),{...source({precipitationRateInHr:2}),stale:true},source({observedAt:new Date(now+120000).toISOString()})]){const x=stationState(s,now);assert.equal(x.emphasis,false);assert.equal(x.rate,null);assert.match(x.title,/unavailable/);}});
test('wind direction wraps and preserves missing values',()=>{assert.equal(compass(360),'N · 0°');assert.equal(compass(225),'SW · 225°');assert.equal(compass(null),'—');});
