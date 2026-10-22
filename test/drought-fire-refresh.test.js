import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { seasonalStart, decodeCPCValue, observedDryDays } from '../lib/drought-fire/computeDroughtFireIndex.js';
import { normalizeInputs } from '../lib/drought-fire/normalize.js';
import handler from '../lib/api-routes/drought-fire.js';
import { firePresentation } from '../public/js/visuals/fire-curve.js';

test('season rolls to latest September, including January and September boundaries', () => {
  for (const [date, year] of [['2026-10-22', 2026], ['2026-01-01', 2025], ['2026-09-01', 2026]]) {
    assert.equal(seasonalStart(new Date(date)).toISOString(), `${year}-09-01T12:00:00.000Z`);
  }
});

test('CPC little-endian decoder distinguishes dry, missing, and malformed data', () => {
  const data = new ArrayBuffer(12), view = new DataView(data);
  [0, 125, -999].forEach((v, i) => view.setFloat32(i * 4, v, true));
  assert.equal(decodeCPCValue(data, 0), 0);
  assert.equal(decodeCPCValue(data, 1), 125);
  assert.equal(decodeCPCValue(data, 2), null);
  assert.equal(decodeCPCValue(data, 3), null);
});

test('dry spell uses observed rain and rejects gaps', () => {
  const dates = ['2026-10-20', '2026-10-19', '2026-10-18'].map(d => new Date(d + 'T12:00:00Z'));
  assert.equal(observedDryDays({20261020: 0, 20261019: 0, 20261018: 0.2}, dates), 2);
  assert.throws(() => observedDryDays({20261020: 0}, dates), /incomplete/);
});

test('forecast rain does not suppress current dry windy fire conditions', () => {
  const base = { precipDeficit90d_in: 9, precipDeficitSeasonal_in: 13, soilPercentile: 1, daysSinceRain: 24, tempAnomalyF: 8, rh: 20, windGust: 25, tempF: 90 };
  const current = normalizeInputs(base);
  assert.equal(normalizeInputs({...base, rainNext6hIn: 1, precipProbabilityToday: 0.9}).FRI, current.FRI);
  assert.ok(normalizeInputs({...base, rainTodayIn: 0.35}).FRI <= 28);
});

test('route with unavailable observations returns no score and no stack', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({current: null}) });
  let status, body;
  try {
    await handler({}, {setHeader() {}, status(n) {status=n; return this;}, json(v) {body=v;}});
    assert.equal(status, 503);
    assert.equal(body.FRI, undefined);
    assert.equal(body.stack, undefined);
  } finally { globalThis.fetch = previous; }
});

test('homepage fire card handles live success and failure without canned scores', async () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /DROUGHT_FIRE_MODULE_ENABLED = true/);
  assert.doesNotMatch(html, /DROUGHT_FIRE_FALLBACK/);
  const start = html.indexOf('    function renderDroughtFireCard(');
  const end = html.indexOf('    function htmlToPlainText(', start);
  const texts = {}, card = {hidden:true};
  let fail = false;
  const ctx = vm.createContext({
    document: {querySelector: () => card}, DROUGHT_FIRE_MODULE_ENABLED: true,
    updateText: (id, value) => {texts[id]=value;},
    fireHeadlineFor: () => 'Current conditions', fireSummaryFor: () => 'Current drivers',
    firePresentation, renderFireCurve() {},
    formatInches: n => n.toFixed(1), labelSoilPercentile: () => 'Typical', signedNumber: String,
    console: {warn() {}}, fetchRouteJson: async () => {
      if (fail) throw new Error('offline');
      return { DSS:30, FRI:25, updatedAt:'2026-10-22T12:00:00Z', dataThrough:'20261020', soilDate:'20261020', seasonalStart:'20260901', inputs:{precipDeficit90d_in:-2, precipDeficitSinceSep1_in:-1}, weatherContext:{rh:50,windGust:5,tempF:60} };
    }
  });
  vm.runInContext(html.slice(start,end),ctx);
  await vm.runInContext('hydrateDroughtFireCard()',ctx);
  assert.equal(card.hidden,false);
  assert.equal(texts['#fireThreatValue'],25);
  assert.equal(texts['#fireRain90'],'2.0 above normal');
  assert.equal(texts['#fireTrend'],'Unavailable');
  fail=true;
  await vm.runInContext('hydrateDroughtFireCard()',ctx);
  assert.equal(texts['#fireThreatValue'],'--');
  assert.match(texts['#fireHeadline'],/unavailable/);
});
