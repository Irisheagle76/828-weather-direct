import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { analyzeHikingStations } from '../lib/hiking/guidance.js';
import { homeHikingPresentation } from '../public/js/hiking-home-card.js';
import { hikingReportState } from '../public/mobile/hiking-data.js';
import { calculateComfort, comfortScoreLabel } from '../public/js/intel/comfort.js';
import { comfortExplanation, bestWindowSummary } from '../public/js/intel/feelscore-insight.js';
import { buildNarrative } from '../lib/drought-fire/narrative.js';

const now = Date.parse('2026-11-22T18:00:00Z');
const station = { id: 'econet-unca', temperatureF: 57, dewPointF: 55, windMph: 0, rainRateInHr: 0, rainTodayIn: 0.23 };
const payload = (stations = [station]) => ({ generatedAt: new Date(now).toISOString(), stations, guidance: analyzeHikingStations(stations, { now }) });

test('desktop and mobile consume the same wet, dry, cold and lightning scores', () => {
  for (const changes of [{}, { dewPointF: 30, rainTodayIn: 0 }, { temperatureF: 30 }, { provider: 'tempest', lightningStrikes1h: 1 }]) {
    const report = payload([{ ...station, ...changes }]);
    const desktop = homeHikingPresentation(report, now);
    assert.equal(desktop.score, report.guidance.hikerScore);
    assert.equal(desktop.score, hikingReportState(report, now).score);
    assert.equal(desktop.headline, report.guidance.overall);
  }
  assert.equal(homeHikingPresentation(payload(), now).score, 68);
});

test('missing, stale, future and failed trail reports cannot retain a favorable score', () => {
  for (const report of [{}, { ...payload(), generatedAt: new Date(now - 46 * 60000).toISOString() }, { ...payload(), generatedAt: new Date(now + 6 * 60000).toISOString() }, payload([{ id: 'econet-unca', temperatureF: 57 }])]) {
    const view = homeHikingPresentation(report, now);
    assert.equal(view.score, null);
    assert.match(view.headline, /unavailable/i);
  }
  for (const field of ['dewPointF', 'windMph', 'rainRateInHr']) {
    const incomplete = { ...station, [field]: null };
    assert.equal(analyzeHikingStations([incomplete]).hikerScore, null);
  }
  const alert = analyzeHikingStations([{ id: 'econet-unca', temperatureF: 57, provider: 'tempest', lightningStrikes1h: 1 }]);
  assert.equal(alert.hikerScore, null);
  assert.equal(alert.hikerScoreLabel, 'Alert');
  assert.match(alert.bestWindow, /Stay off exposed/);
});

test('homepage rendering uses shared presentation and clears failed requests', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="homeHikerScore">--</);
  assert.match(html, /const view = homeHikingPresentation\(data\)/);
  assert.match(html, /catch \(error\) \{\s*renderHomeHikingCard\(\);/);
  const view = homeHikingPresentation({ ...payload(), guidance: { ...payload().guidance, mitchellDrop: -5 } }, now);
  assert.equal(view.mitchellDrop, '5° warmer');
});

test('actual homepage loader renders the API score then clears it on failure or stale data', async () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = html.slice(html.indexOf('    function renderHomeHikingCard('), html.indexOf('    function bestRiverActivity('));
  const fields = {};
  let response = payload();
  const context = vm.createContext({
    homeHikingPresentation: p => homeHikingPresentation(p, now),
    document: { querySelector: () => null },
    updateText: (key, value) => { fields[key] = value; },
    console: { warn() {} },
    fetch: async () => ({ ok: response != null, status: response ? 200 : 503, json: async () => response })
  });
  vm.runInContext(source, context);
  await vm.runInContext('hydrateHomeHikingCard()', context);
  assert.equal(fields['#homeHikerScore'], 68);
  response = null;
  await vm.runInContext('hydrateHomeHikingCard()', context);
  assert.equal(fields['#homeHikerScore'], '--');
  assert.match(fields['#homeHikingHeadline'], /unavailable/);
  response = { ...payload(), generatedAt: new Date(now - 3600000).toISOString() };
  await vm.runInContext('hydrateHomeHikingCard()', context);
  assert.equal(fields['#homeHikerScore'], '--');
});

test('sunshine credit requires exposure evidence and disappears at night', () => {
  const hour = { temperatureF: 57, dewpointF: 55, windSpeed: 0, timestamp: now };
  const score = extra => calculateComfort({ ...hour, ...extra }).score * 10;
  const cloudy = score({ cloudCover: 1 });
  assert.equal(score({}), cloudy);
  assert.equal(score({ cloudCover: 0, solar_radiation: 0 }), cloudy);
  assert.equal(score({ cloudCover: 0 }) - cloudy, 5);
  assert.equal(score({ cloudCover: 1, solar_radiation: 600 }) - cloudy, 5);
  const night = now + 8 * 3600000;
  assert.equal(score({ timestamp: night, solar_radiation: 600 }), score({ timestamp: night, solar_radiation: 0 }));
});

test('damp explanations and score labels agree across engine, card and outlook', () => {
  const currentHour = { temperatureF: 57, dewpointF: 56.8, relativeHumidity: 99, windSpeed: 0, timestamp: now };
  const comfort = calculateComfort(currentHour);
  const score = comfort.score * 10;
  const explanation = comfortExplanation({ currentHour, score });
  assert.match(explanation.text, /damp air close to saturation/);
  assert.doesNotMatch(explanation.text, /manageable humidity/);
  assert.equal(comfort.label, comfortScoreLabel(score));
  const summary = bestWindowSummary({ best: { start: now, end: now + 7200000, peak: score } }, now);
  assert.ok(summary.detail.endsWith(comfort.label));
});

test('wet fire narrative does not claim active heat-driven drying', () => {
  const context = { heatScore: 0.8, wetWeatherScore: 0.55, FRI: 17, DSS: 49 };
  const wet = buildNarrative(context);
  assert.match(wet.headline, /limiting current fire risk/);
  assert.ok(!wet.bullets.some(b => /accelerating drying/.test(b)));
  assert.ok(buildNarrative({ ...context, wetWeatherScore: 0 }).bullets.some(b => /accelerating drying/.test(b)));
});
