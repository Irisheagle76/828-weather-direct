import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { forecastComfortCopy } from '../public/js/intel/forecast-comfort-context.js';
import { applyPrecipOverrideToNarrative } from '../public/js/intel/precip-override.js';
import { buildCurrentComfort } from '../public/js/intel/current-comfort.js';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const renderer = html.slice(html.indexOf('    function renderLiveFeelScore('), html.indexOf('    function renderNextSix('));
const now = Date.parse('2026-10-16T19:00:00Z');
const hourly = [81, 78, 74, 70, 66, 63, 60].map((temperatureF, i) => ({ timestamp: now + i * 3600000, temperatureF, dewpointF: 50, windSpeed: 3, cloudCover: i < 3 ? .9 : .1 }));

function render(precipOverride = null, hours = hourly) {
  const elements = new Map();
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, { style: { setProperty() {} }, setAttribute() {}, replaceChildren() {}, append() {} });
    return elements.get(selector);
  };
  const context = {
    document: { querySelector: element },
    buildCurrentComfort: (weather, options) => buildCurrentComfort(weather, { ...options, now }),
    latestComfortWeather: null, latestComfortStorm: null, latestPublishedForecast: null,
    forecastComfortCopy: options => forecastComfortCopy({ ...options, now }),
    applyPrecipOverrideToNarrative,
    primaryLiveHour: () => hourly[0], hasFeelScoreInputs: () => true,
    normalizeScore100: x => x, nearTermFeelScore: () => 75, comfortScore100: () => 75,
    scoreLabel: () => 'Pleasant', feelScoreStateEmoji: () => '🙂',
    setText: (selector, text) => { element(selector).textContent = text; },
    feelScoreWearCue: () => ({ emoji: '👕', text: 'Short sleeves' }),
    FEELSCORE_CALIBRATION: { dewpoint: { veryMuggyF: 70 } },
    getHighUvSignal: () => null, cleanSubstackText: text => text,
    buildTemperaturePath: () => ({ slots: [] }), buildTemperatureTakeaway: () => null,
    buildFallbackFeelScoreBullets: () => [],
    hours, precipOverride
  };
  vm.runInNewContext(renderer + '\nrenderLiveFeelScore({score:75, headline:"Old generic headline", narrative:"Old range"}, hours, [], hours[0], hours[0], precipOverride);', context);
  return elements;
}

test('Desktop renders the shared upcoming temperature and sky story while retaining the current score', () => {
  const elements = render();
  assert.equal(elements.get('#liveFeelScoreHeadline').textContent, 'Warm afternoon, cooler evening');
  assert.match(elements.get('#liveFeelScoreSubhead').textContent, /81°F at 3 PM to 60°F by 9 PM.*mostly clear skies/);
  assert.equal(elements.get('#liveFeelScoreValue').textContent, buildCurrentComfort({ hourly, current: hourly[0] }, { now }).score);
});

test('Desktop keeps observed rain and nearby lightning above the forecast outlook', () => {
  const elements = render({ active: true, mode: 'active', headline: 'Rain and lightning now', summary: 'Rain is falling at the station. Lightning is nearby.', bullets: ['Stay inside during lightning.'] });
  assert.equal(elements.get('#liveFeelScoreHeadline').textContent, 'Rain and lightning now');
  assert.match(elements.get('#liveFeelScoreSubhead').textContent, /Rain is falling/);
  assert.equal(elements.get('#liveFeelScoreValue').textContent, buildCurrentComfort({ hourly, current: hourly[0] }, { now }).score);
});

test('Desktop identifies unavailable forecast data instead of replaying an old summary', () => {
  const elements = render(null, []);
  assert.equal(elements.get('#liveFeelScoreHeadline').textContent, 'Comfort outlook updating');
  assert.match(elements.get('#liveFeelScoreSubhead').textContent, /unavailable/);
});
