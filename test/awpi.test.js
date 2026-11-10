import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDays, scoreMember, summarize, peakDetails, peakWindows } from '../lib/awpi/engine.js';
import { parseDaily, parseRoni, parseNino, collectSources } from '../lib/awpi/sources.js';
import { buildAssessment, present, getAssessment } from '../lib/awpi/service.js';
import refreshHandler from '../lib/api-routes/awpi/refresh.js';

const now = new Date('2026-11-09T15:00:00Z');
function forecast() {
  const time = Array.from({ length: 336 }, (_, i) => new Date(Date.UTC(2026, 10, 9) + i * 3600000).toISOString().slice(0, 16));
  const hourly = { time };
  for (let i = 0; i < 31; i++) { const suffix = i ? `_member${String(i).padStart(2, '0')}` : ''; hourly[`temperature_2m${suffix}`] = time.map(() => -5); hourly[`precipitation${suffix}`] = time.map(() => .5); hourly[`snowfall${suffix}`] = time.map(() => .2); }
  return { timezone: 'America/New_York', hourly, hourly_units: { temperature_2m: '°C', precipitation: 'mm', snowfall: 'cm' } };
}
test('bounded scores distinguish missing data from genuine zeros', () => {
  assert.deepEqual(scoreMember({ temperatureC: -20, precipitationMm: 100, snowOverlapCm: 20 }), { cold: 100, storm: 100, snow: 100 });
  assert.deepEqual(scoreMember({ temperatureC: 20, precipitationMm: 0, snowOverlapCm: 0 }), { cold: 0, storm: 0, snow: 0 });
  assert.deepEqual(scoreMember({}), { cold: null, storm: null, snow: null });
});
test('actual member data produce a complete 14-day result', () => {
  const days = calculateDays(forecast(), now);
  assert.equal(days.length, 14); assert.equal(days[0].cold, 100); assert.equal(days[0].snow, 100); assert.equal(days[13].date, '2026-11-22'); assert.equal(days[6].confidence, 'Low');
});
test('noncoincident warm snow cannot manufacture snow support', () => {
  const f = forecast(); for (const key in f.hourly) if (key.startsWith('temperature')) f.hourly[key].fill(10);
  assert.equal(calculateDays(f, now)[0].snow, 0);
});
test('missing members, incomplete days and null values are not zero scores', () => {
  const f = forecast(); for (const key in f.hourly) if (key.startsWith('snowfall')) f.hourly[key][4] = null;
  const days = calculateDays(f, now); assert.equal(days[0].snow, null); assert.equal(days[0].cold, 100); assert.equal(summarize(days).snow, null);
  f.hourly.time = f.hourly.time.slice(0, 325); assert.equal(calculateDays(f, now)[13].cold, null);
});
test('wrong units and duplicate timestamps fail closed', () => {
  const f = forecast(); f.hourly_units.temperature_2m = '°F'; assert.throws(() => calculateDays(f, now), /units/);
  f.hourly_units.temperature_2m = '°C'; f.hourly.time[1] = f.hourly.time[0]; assert.throws(() => calculateDays(f, now), /timestamps/);
});
test('future daily observations are excluded and old observations marked stale', () => {
  assert.equal(parseDaily('year,month,day,ao_index_cdas\n2026,11,7,-1\n2026,11,10,5', now).value, -1);
  assert.equal(parseDaily('year,month,day,index\n2025,1,1,2', now).stale, true);
});
test('RONI parser keeps observation period and excludes unfinished seasons', () => {
  const html = '<tr><th>2026</th>' + [0,0,0,0,.5,1,1.4,1.7,2,3].map(v => `<td><span>${v}</span></td>`).join('') + '</tr>';
  const result = parseRoni(html, now); assert.equal(result.value, 2); assert.equal(result.period, '2026 ASO'); assert.equal(result.date, '2026-10-31');
});
test('Niño parser uses anomaly, not SST', () => assert.equal(parseNino('YR MON NINO1 ANOM NINO3 ANOM NINO4 ANOM NINO34 ANOM\n2026 10 25 1 26 2 27 1 28 2.4', now).value, 2.4));
test('failed refresh preserves original timestamps and explicitly marks stale', async () => {
  const previous = { generatedAt: now.toISOString(), days: [{ date: '2026-11-09' }], summary: { cold: 20 } };
  const store = { get: async () => previous, set: async () => assert.fail('must not replace last successful data') };
  const value = await buildAssessment({ now, store, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(value.status, 'stale'); assert.equal(value.generatedAt, previous.generatedAt); assert.equal(value.summary.cold, 20);
});
test('cold start source failure leaves scores unavailable', async () => {
  const value = await buildAssessment({ now, store: { get: async () => null }, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(value.status, 'unavailable'); assert.equal(value.summary.snow, null);
});
test('previous calendar date is stale even within 26 hours', () => assert.equal(present({ generatedAt: '2026-11-09T03:00:00Z', days: [{ date: '2026-11-08' }] }, now).stale, true));
test('unauthenticated refresh is refused', async () => {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(value) { return value; } };
  await refreshHandler({ method: 'POST', headers: {} }, res); assert.equal(res.code, 401);
});
test('failed climate refresh retains the original observation with stale label', async () => {
  const cached = { ao: { status: 'ok', retrievedAt: '2026-11-01T00:00:00Z', data: { value: -1, date: '2026-10-31' } } };
  const result = await collectSources({ now, cached, fetcher: async () => { throw new Error('offline'); } });
  assert.equal(result.ao.data.value, -1); assert.equal(result.ao.status, 'stale'); assert.equal(result.ao.retrievedAt, cached.ao.retrievedAt);
});

test('one-day signal is not diluted by thirteen quiet days', () => {
  const days = Array.from({length:14},(_,i)=>({date:'2026-11-'+String(i+10).padStart(2,'0'),cold:0,storm:0,snow:i===9?80:0,confidence:i<5?'Moderate':'Low'}));
  assert.equal(summarize(days).snow,80);
  const p=peakDetails(days).snow;
  assert.deepEqual(p.dates,['2026-11-19']); assert.equal(p.confidence,'Low'); assert.equal(p.favorableWindows[0].days,1);
  assert.equal(peakWindows(days)[1].snow,80);
});
test('peak ties, separate events, zero and incomplete coverage are explicit', () => {
  const days=[{date:'2026-11-10',cold:80,storm:0,snow:0,confidence:'Moderate'},{date:'2026-11-11',cold:80,storm:0,snow:0,confidence:'Low'},{date:'2026-11-12',cold:0,storm:80,snow:0,confidence:'Low'}];
  const p=peakDetails(days); assert.equal(p.cold.confidence,'Low');assert.equal(p.cold.dates.length,2);assert.equal(p.cold.favorableWindows[0].days,2);assert.equal(p.snow.score,0);assert.deepEqual(p.snow.dates,[]);
  days[1].snow=null;assert.equal(peakDetails(days).snow.score,null);
});

test('expired saved guidance returns before blocked upstream requests finish', async () => {
  const previous = { generatedAt: '2026-11-08T15:00:00Z', days: [{date:'2026-11-08'}], summary:{cold:20}, status:'ready' };
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let scheduled;
  const fetcher = async () => { await gate; throw new Error('offline'); };
  const store = { get: async () => previous };
  try {
    const result = await Promise.race([
      getAssessment({now, store, fetcher, schedule: task => { scheduled = task; }}),
      new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('blocked on upstream')), 500); timer.unref(); })
    ]);
    assert.equal(result.refreshing, true);
    assert.equal(result.stale, true);
    assert.equal(result.generatedAt, previous.generatedAt);
    assert.equal(result.summary.cold, 20);
    assert.ok(scheduled);
  } finally { release(); await scheduled; }
});
test('no saved guidance still waits for the initial calculation', async () => {
  let scheduled = false;
  const result = await getAssessment({ now, store:{get:async()=>null}, fetcher:async()=>{throw new Error('offline');}, schedule:()=>{scheduled=true;} });
  assert.equal(result.status, 'unavailable');
  assert.equal(scheduled, false);
});
