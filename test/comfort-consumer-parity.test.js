import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildCurrentComfort, COMFORT_REFRESH_MS } from '../public/js/intel/current-comfort.js';
import { applyPrecipOverrideToNarrative } from '../public/js/intel/precip-override.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const web = fs.readFileSync(new URL('../public/mobile/mobile.js', import.meta.url), 'utf8');
const desktop = html.slice(html.indexOf('    function renderLiveFeelScore('), html.indexOf('    function renderNextSix('));
const clients = [['mobile web', web]];
if (process.env.ANDROID_MOBILE_SOURCE) clients.push(['Android', fs.readFileSync(process.env.ANDROID_MOBILE_SOURCE, 'utf8')]);
const now = Date.parse('2026-10-16T18:40:00Z');
const hourly = [81, 78, 74, 70, 66, 63, 60, 58].map((temperatureF, i) => ({ timestamp: now + (i + 1 / 3) * 3600000, temperatureF, dewpointF: 55, windSpeed: 3, cloudCover: .8 }));

function elements() {
  const nodes = new Map();
  const query = selector => {
    if (!nodes.has(selector)) nodes.set(selector, { style: { setProperty() {} }, setAttribute() {}, replaceChildren() {}, append() {}, classList: { remove() {} } });
    return nodes.get(selector);
  };
  return { nodes, query };
}
const shared = (weather, options) => buildCurrentComfort(weather, { ...options, now });
function renderDesktop(weather, storm) {
  const { nodes, query } = elements();
  const model = shared(weather, { storm });
  vm.runInNewContext(desktop + '\nrenderLiveFeelScore({score:50,bullets:[]}, weather.hourly, [], null, null, override);', {
    document: { querySelector: query }, weather, override: model.precipOverride, buildCurrentComfort: shared,
    latestComfortWeather: weather, latestComfortStorm: storm, latestPublishedForecast: null, applyPrecipOverrideToNarrative,
    scoreLabel: () => 'Pleasant', feelScoreStateEmoji: () => '🙂',
    setText: (selector, text) => { query(selector).textContent = text; },
    feelScoreWearCue: () => ({ emoji: '👕', text: 'Short sleeves' }),
    FEELSCORE_CALIBRATION: { dewpoint: { veryMuggyF: 70 } }, getHighUvSignal: () => null,
    buildFallbackFeelScoreBullets: () => [], cleanSubstackText: x => x,
    buildTemperaturePath: () => ({ slots: [] }), buildTemperatureTakeaway: () => null
  });
  return { score: nodes.get('#liveFeelScoreValue').textContent, headline: nodes.get('#liveFeelScoreHeadline').textContent, narrative: nodes.get('#liveFeelScoreSubhead').textContent };
}
function renderMobile(script, weather, storm) {
  const { nodes, query } = elements();
  const code = script.slice(script.indexOf('function renderFeelScore()'), script.indexOf('function renderFeelScoreDetail()'));
  const state = { weather, storm };
  vm.runInNewContext(code + '\nrenderFeelScore();', { $, state, buildCurrentComfort: shared, buildHumanActionIntelFS: () => ({ feelscore: { score: 50 } }),
    renderTrend() {}, renderHours() {}, renderFeelScoreDetail() {}, COMFORT_REFRESH_MS });
  function $(selector) { return query(selector); }
  return { score: nodes.get('#homeScore').textContent, headline: nodes.get('#homeScoreLabel').textContent, narrative: nodes.get('#homeScoreNarrative').textContent };
}

for (const [client, script] of clients) for (const [scenario, current, storm] of [
  ['fresh observations', { timestamp: now, air_temperature: 22, dew_point: 12, wind_avg: 1 }, null],
  ['observed rain', { timestamp: now, air_temperature: 22, dew_point: 12, wind_avg: 1, rainRate: 8 }, null],
  ['nearby storms', { timestamp: now, air_temperature: 22, dew_point: 12, wind_avg: 1, rainRate: 0, lightningStrikeCount: 3, lightningStrikeDistance: 2 }, { radar: { available: true, ageMinutes: 1, nearestEchoMiles: 1, echoPixels: 8 } }],
  ['stale observations', { timestamp: now - 3600000, air_temperature: 0, dew_point: -5 }, null],
  ['missing observations', null, null]
]) test(`Desktop and ${client} render equal scores and weather copy with ${scenario}`, () => {
  const weather = { current, hourly };
  assert.deepEqual(renderMobile(script, weather, storm), renderDesktop(weather, storm));
});
