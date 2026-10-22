import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveFireSeason, springWeight } from '../lib/drought-fire/seasonal.js';
import { normalizeInputs } from '../lib/drought-fire/normalize.js';
import { buildFireOutlook } from '../lib/drought-fire/outlook.js';
import { fireSeasonNote } from '../public/js/visuals/fire-curve.js';
const at = day=>Date.parse(`${day}T12:00:00Z`);
const input={precipDeficit90d_in:2,precipDeficitSeasonal_in:3,soilPercentile:27,daysSinceRain:9,tempAnomalyF:0,tempF:60,rh:20,windGust:18,rainTodayIn:0,rainRateInHr:0};

test('automatic profiles cover spring, fall, winter and summer including year rollover',()=>{
  for(const [date,profile] of [['2026-01-01','standard'],['2026-03-15','spring'],['2026-04-15','spring'],['2026-05-15','standard'],['2026-07-01','standard'],['2026-10-22','fall'],['2026-12-15','standard'],['2027-03-15','spring']]) {
    assert.equal(resolveFireSeason(at(date)).profile,profile);
  }
  for(const [date,weight] of [['2026-03-01',0],['2026-03-08',0.5],['2026-03-15',1],['2026-04-15',1],['2026-04-30',0.5],['2026-05-15',0]]) assert.equal(springWeight(at(date)),weight);
  assert.equal(springWeight(Date.parse('2026-03-02T02:00:00Z')),0);
  assert.equal(resolveFireSeason(at('2028-02-29')).profile,'standard');
});

test('seasonal transitions never produce a large score jump under identical weather',()=>{
  let previous=null;
  for(let day=0;day<366;day++) {
    const timestamp=Date.UTC(2026,0,1+day,12);
    const score=normalizeInputs({...input,timestamp});
    if(previous) assert.ok(Math.abs(score.FRI-previous.FRI)<=2);
    assert.equal(score.DSS,normalizeInputs(input).DSS);
    const weights=score.components.weatherWeights;
    assert.ok(Math.abs(weights.humidity+weights.wind+weights.temperature-1)<1e-10);
    previous=score;
  }
});

test('override can switch either season without changing weather or bypassing wet suppression',()=>{
  for(const seasonMode of ['fall','spring']) {
    const score=normalizeInputs({...input,timestamp:at('2026-07-01'),seasonMode});
    assert.equal(score.components.season.profile,seasonMode);
    assert.equal(score.components.season.weight,1);
    assert.ok(normalizeInputs({...input,timestamp:at('2026-07-01'),seasonMode,rainTodayIn:0.35}).FRI<=28);
  }
  assert.equal(normalizeInputs({...input,timestamp:at('2026-10-22'),seasonMode:'standard'}).FRI,normalizeInputs(input).FRI);
  assert.throws(()=>resolveFireSeason(at('2026-03-15'),'typo'),/Invalid/);
});

test('spring outlook matches point scoring through a local-date boundary and updates copy',()=>{
  const now=Date.parse('2026-03-14T23:30:00-04:00');
  const hourly=Array.from({length:24},(_,i)=>({timestamp:now+(i+1)*3600000,temperatureF:60,relativeHumidity:20,windGust:18,precipAmount:0}));
  for(const seasonMode of ['auto','fall','spring','standard']) {
    const outlook=buildFireOutlook({current:{...input,seasonMode},background:{},hourly,now});
    for(const p of outlook.points) assert.equal(p.FRI,normalizeInputs({...input,seasonMode,timestamp:p.timestamp}).FRI);
    assert.equal(outlook.season.mode,seasonMode);
    assert.match(fireSeasonNote(outlook),new RegExp(seasonMode==='auto'?'spring':seasonMode));
  }
  assert.doesNotMatch(fireSeasonNote({season:resolveFireSeason(now)}),/leaf fall|profile: fall/);
});
