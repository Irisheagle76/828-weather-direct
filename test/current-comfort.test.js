import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateComfort } from '../public/js/intel/comfort.js';
import { buildCurrentComfort, normalizeComfortObservation, comfortScore100 } from '../public/js/intel/current-comfort.js';

const now = Date.parse('2026-10-16T18:40:00Z');
const hourly = [81, 79, 75, 70, 66, 63, 60, 58].map((temperatureF, i) => ({ timestamp: now + (i + 1 / 3) * 3600000, temperatureF, dewpointF: 52, windSpeed: 3, cloudCover: .9 }));
const current = { timestamp: now - 60000, air_temperature: 22, dew_point: 12, wind_avg: 1, rainRate: 0 };

test('Current score uses converted fresh observations, never a period-average snapshot', () => {
  const model = buildCurrentComfort({ current, hourly }, { now });
  assert.equal(model.source, 'observation');
  assert.equal(model.currentHour.temperatureF, 71.6);
  assert.equal(model.currentHour.dewpointF, 53.6);
  assert.equal(model.currentHour.windSpeed, 2.237);
  assert.equal(model.score, Math.round(calculateComfort(model.currentHour).score * 10));
  assert.equal(model.curve.points.find(p => p.isCurrent).score, model.score);
  assert.match(model.copy.weatherNarrative, /81°F at 3 PM to 63°F by 8 PM/);
});

test('Same observation expressed in native Tempest units or normalized Fahrenheit gives the same result', () => {
  const a = buildCurrentComfort({ current, hourly }, { now });
  const b = buildCurrentComfort({ current: normalizeComfortObservation(current), hourly: [...hourly].reverse() }, { now });
  assert.deepEqual({ score: a.score, copy: a.copy, curve: a.curve, best: a.best, nextHours: a.nextHours }, { score: b.score, copy: b.copy, curve: b.curve, best: b.best, nextHours: b.nextHours });
});

test('Stale, missing, future-dated, or incomplete observations fall back to the same nearby forecast', () => {
  for (const observation of [null, { ...current, timestamp: now - 30 * 60000 }, { ...current, timestamp: now + 10 * 60000 }, { ...current, dew_point: null }]) {
    const model = buildCurrentComfort({ current: observation, hourly }, { now });
    assert.equal(model.source, 'forecast');
    assert.equal(model.score, comfortScore100(model.forecastHour));
  }
});

test('Missing readings never turn into freezing air, fake humidity, or an invented 50 score', () => {
  assert.equal(comfortScore100({ temperatureF: null, dewpointF: 50 }), null);
  assert.equal(comfortScore100({ temperatureF: 72, dewpointF: null }), null);
  assert.equal(normalizeComfortObservation({ timestamp: now, air_temperature: null }).temperatureF, null);
  const model = buildCurrentComfort({ hourly: [{ timestamp: now + 3 * 3600000, temperatureF: 70, dewpointF: 50 }] }, { now });
  assert.equal(model.score, null);
  assert.equal(model.source, 'unavailable');
});

test('Humidity may supply a missing dew point without treating an absent value as zero', () => {
  const model = buildCurrentComfort({ current: { timestamp: now, temperatureF: 70, relativeHumidity: 60, windSpeed: 2 } }, { now });
  assert.equal(model.source, 'observation');
  assert.ok(model.currentHour.dewpointF > 50 && model.currentHour.dewpointF < 60);
});

test('Observed rain and lightning override fair-weather wording on every consumer', () => {
  const model = buildCurrentComfort({ current: { ...current, rainRate: 5, lightningStrikeCount: 3, lightningStrikeDistance: 2 }, hourly }, { now });
  assert.equal(model.precipOverride.mode, 'active');
  assert.match(model.copy.headline, /rain|storm/i);
  assert.doesNotMatch(model.copy.weatherNarrative, /Mostly clear skies through/);
});

test('Radar context and observed nearby lightning use the existing storm override', () => {
  const model = buildCurrentComfort({ current: { ...current, lightningStrikeLastAt: now - 60000, lightningStrikeDistance: 2 }, hourly }, { now, storm: { radar: { available: true, ageMinutes: 1, nearestEchoMiles: 1, echoPixels: 8 }, weather: { lightningCount: 3 } } });
  assert.equal(model.precipOverride.radarConfirmedThunderstorm, true);
  assert.match(model.copy.headline, /storm/i);
});

test('Home best window comes from the same sustained curve window, not an isolated peak', () => {
  const model = buildCurrentComfort({ hourly }, { now });
  assert.equal(model.best.window.includes('–'), true);
  assert.equal(model.curve.best.end - model.curve.best.start, 2 * 3600000);
  assert.equal(model.best.detail.includes(String(model.curve.best.peak)), true);
});

test('Asheville clock labels, current score and best window agree across device time zones', () => {
  const original = process.env.TZ;
  try {
    const models = ['America/New_York', 'UTC', 'Asia/Tokyo'].map(zone => {
      process.env.TZ = zone;
      return buildCurrentComfort({ current, hourly }, { now });
    });
    for (const model of models.slice(1)) {
      assert.deepEqual({ score: model.score, copy: model.copy, curve: model.curve, best: model.best }, { score: models[0].score, copy: models[0].copy, curve: models[0].curve, best: models[0].best });
    }
  } finally {
    if (original == null) delete process.env.TZ; else process.env.TZ = original;
  }
});

test('Shared current model forwards daily sunset timing to the forecast icon', () => {
  const sunset = Date.parse('2026-12-16T21:15:00Z');
  const time = sunset + 15 * 60000;
  const model = buildCurrentComfort({ hourly: [{ timestamp: time, temperatureF: 42, dewpointF: 30, cloudCover: .5 }], daily: [{ sunrise: Date.parse('2026-12-16T12:30:00Z'), sunset }] }, { now: time });
  assert.equal(model.copy.emoji, '🌙');
});
