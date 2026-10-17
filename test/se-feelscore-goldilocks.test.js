import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyHour, scorePeriod } from '../lib/feelscore/summer-v1.6.js';
import { parseDwmlBatch } from '../lib/feelscore/nws-dwml.js';
import { createHandler } from '../lib/api-routes/se-feelscore.js';
import { buildCategoryLookup, sampleContour } from '../public/js/feelscore-map-field.js';
import { focusedDataset } from '../lib/api-routes/mobile/feelscore-map.js';

const ideal = (overrides = {}) => ({
  temperatureF: 70, dewPointF: 40, windMph: 3, gustMph: 5, skyCoverPct: 4,
  precipProbabilityPct: 0, precipProbabilitySource: 'no-precipitation-weather-code',
  precipExpected: false, thunder: false, thunderProbabilityPct: 0, ...overrides,
});

test('sunny fall weather and an actual hourly PoP both have a path to Goldilocks', () => {
  for (const precipProbabilitySource of ['no-precipitation-weather-code', 'hourly-pop', undefined]) {
    const result = classifyHour(ideal({ precipProbabilitySource }));
    assert.equal(result.category, 5);
    assert.deepEqual(result.reasons.goldilocks.failedChecks, []);
    assert.equal(result.reasons.categoryBeforeGoldilocks, 5);
  }
});

for (const [field, min, max, check] of [
  ['temperatureF', 67, 76, 'temperature'], ['dewPointF', 35, 53, 'dewPoint'],
  ['windMph', 0, 10, 'wind'], ['gustMph', 0, 15, 'gust'],
  ['precipProbabilityPct', 0, 10, 'precipProbability'],
]) {
  test(`Goldilocks ${field} boundaries are inclusive, finite and unrounded`, () => {
    for (const value of [min, max]) assert.equal(classifyHour(ideal({ [field]: value })).category, 5);
    for (const value of [min - 0.01, max + 0.01, null, undefined, NaN]) {
      const result = classifyHour(ideal({ [field]: value }));
      assert.notEqual(result.category, 5);
      assert.ok(result.reasons.goldilocks.failedChecks.includes(check));
    }
  });
}

test('every extra Goldilocks veto is visible even when ordinary ceilings allow 5', () => {
  for (const [overrides, check] of [
    [{ precipProbabilitySource: 'inferred-from-NDFD-weather-coverage' }, 'precipProbabilitySource'],
    [{ precipProbabilitySource: 'weather-unavailable' }, 'precipProbabilitySource'],
    [{ precipExpected: true }, 'noPrecipitation'], [{ thunder: true }, 'noThunder'],
    [{ dewPointF: 54 }, 'dewPoint'], [{ windMph: 11 }, 'wind'], [{ gustMph: 16 }, 'gust'],
  ]) {
    const result = classifyHour(ideal(overrides));
    assert.equal(result.reasons.categoryBeforeGoldilocks, 5);
    assert.equal(result.reasons.goldilocksCap, 4);
    assert.equal(result.category, 4);
    assert.deepEqual(result.reasons.goldilocks.failedChecks, [check]);
  }
});

test('captured Nashville hours were blocked by provenance, not temperature at 2–3 PM', async () => {
  const { point } = JSON.parse(await readFile(new URL('fixtures/feelscore/nashville-2026-10-18.json', import.meta.url)));
  assert.deepEqual(point.hours.map(h => h.category), [3, 4, 4, 4]);
  for (const hour of point.hours.slice(2)) {
    assert.equal(hour.precipProbabilitySource, 'no-precipitation-weather-code');
    assert.deepEqual(hour.reasoning, { temperatureCeiling: 5, dewPointCeiling: 5,
      windModifier: 0, skyModifier: 0, precipCap: 5, thunderCap: 5 });
  }
  const result = scorePeriod(point.hours);
  assert.deepEqual(result.hours.map(h => h.category), [3, 4, 5, 5]);
  assert.deepEqual(result.hours[0].reasoning.goldilocks.failedChecks, ['temperature']);
  assert.deepEqual(result.hours[1].reasoning.goldilocks.failedChecks, ['temperature']);
  assert.equal(result.finalCategory, 4);
  assert.deepEqual(result.aggregation.goldilocks, { qualifyingHours: 2, requiredHours: 4, eligible: false });
});

test('second-worst-hour needs three qualifying hours; Goldilocks retains four-for-four', () => {
  for (const [temperatures, hourly, finalCategory] of [
    [[66, 66, 70, 70], [4, 4, 5, 5], 4],
    [[66, 70, 70, 70], [4, 5, 5, 5], 4],
    [[70, 70, 70, 70], [5, 5, 5, 5], 5],
    [[56, 60, 66, 66], [2, 3, 4, 4], 3],
  ]) {
    const result = scorePeriod(temperatures.map(temperatureF => ideal({ temperatureF })));
    assert.deepEqual(result.hours.map(h => h.category), hourly);
    assert.equal(result.finalCategory, finalCategory);
    assert.equal(result.aggregation.goldilocks.qualifyingHours, hourly.filter(c => c === 5).length);
    assert.equal(result.aggregation.rule, finalCategory === 5 ? 'goldilocks-four-for-four' : 'second-worst-hour');
  }
});

test('rain, thunder, wind, heat, cold and clouds retain ordinary penalties', () => {
  for (const [overrides, expected] of [
    [{ precipProbabilityPct: 50, precipExpected: true }, 2],
    [{ thunderProbabilityPct: 60, thunder: true }, 1],
    [{ windMph: 22 }, 3], [{ windMph: 31 }, 0],
    [{ temperatureF: 86 }, 1], [{ temperatureF: 91 }, 0],
    [{ temperatureF: 55 }, 1], [{ temperatureF: 51 }, 0],
    [{ dewPointF: 70 }, 0], [{ skyCoverPct: 90 }, 4],
  ]) assert.equal(classifyHour(ideal(overrides)).category, expected, JSON.stringify(overrides));
  assert.equal(scorePeriod([ideal(), ideal(), ideal({ precipProbabilityPct: 40 }), ideal({ precipProbabilityPct: 40 })]).finalCategory, 2);
  assert.equal(scorePeriod([ideal(), ideal(), ideal({ precipExpected: true, precipCoverage: 'likely' }), ideal({ precipExpected: true, precipCoverage: 'likely' })]).finalCategory, 0);
});

const xml = await readFile(new URL('fixtures/feelscore/nashville-2026-10-18.dwml', import.meta.url), 'utf8');
const parse = (source) => parseDwmlBatch(source, [{ lat: 36.25, lon: -86.75 }], '2026-10-18')[0];

test('real DWML normalizes knots to mph without rounding or changing local hours', () => {
  const point = parse(xml);
  assert.deepEqual(point.hours.map(h => h.localTime), ['12:00', '13:00', '14:00', '15:00']);
  assert.equal(point.hours[0].validTime, '2026-10-18T17:00:00.000Z');
  assert.equal(point.hours[0].windMph, 3 * 1.150779448);
  assert.equal(point.hours[0].gustMph, 5 * 1.150779448);
  assert.equal(point.hours[2].precipProbabilitySource, 'no-precipitation-weather-code');
  assert.equal(classifyHour(point.hours[2]).category, 5);
  const mph = parse(xml.replaceAll('units="knots"', 'units="miles/hour"'));
  assert.equal(mph.hours[0].windMph, 3);
  const metric = parse(xml.replaceAll('units="knots"', 'units="meters/second"'));
  assert.equal(metric.hours[0].windMph, 3 * 2.236936292);
  const unknown = parse(xml.replaceAll('units="knots"', 'units="unknown"'));
  assert.equal(unknown.hours[0].windMph, null);
});

test('nine knots is not nine mph and fails the strict light-wind boundary', () => {
  const windy = parse(xml.replace(/(<wind-speed[^>]*>[\s\S]*?<\/wind-speed>)/g,
    block => block.replace(/<value>\d+<\/value>/g, '<value>9</value>')));
  const result = classifyHour(windy.hours[2]);
  assert.equal(result.category, 4);
  assert.ok(result.reasons.goldilocks.failedChecks.includes('wind'));
});

test('missing or nil NWS weather cannot masquerade as a dry record', () => {
  for (const source of [
    xml.replace(/<weather[\s\S]*?<\/weather>/, ''),
    xml.replaceAll('<weather-conditions/>', '<weather-conditions xsi:nil="true"/>'),
  ]) {
    const hour = parse(source).hours[2];
    assert.equal(hour.precipProbabilityPct, null);
    assert.equal(hour.precipProbabilitySource, 'weather-unavailable');
    assert.equal(classifyHour(hour).category, 4);
  }
});

test('NWS wet coverage, thunder and QPF remain ineligible for Goldilocks', () => {
  for (const type of ['rain', 'thunderstorms']) {
    const wet = parse(xml.replaceAll('<weather-conditions/>',
      `<weather-conditions><value coverage="likely" weather-type="${type}" intensity="light"/></weather-conditions>`));
    const hour = wet.hours[2];
    assert.equal(hour.thunder, type === 'thunderstorms');
    assert.equal(classifyHour(hour).category, 1);
    assert.equal(hour.thunder ? hour.thunderProbabilityPct : hour.precipProbabilityPct, 60);
  }
  const qpf = parse(xml.replace(/(<precipitation[^>]*>[\s\S]*?<\/precipitation>)/g,
    block => block.replace(/<value>[^<]*<\/value>/g, '<value>0.01</value>')));
  const result = classifyHour(qpf.hours[2]);
  assert.equal(qpf.hours[2].precipExpected, true);
  assert.equal(result.category, 4);
  assert.ok(result.reasons.goldilocks.failedChecks.includes('noPrecipitation'));
});

test('NWS scoring survives API serialization and renders a category-5 contour', async () => {
  const scored = scorePeriod(parse(xml).hours.map(h => ({ ...h, temperatureF: 70 })));
  const point = { ...parse(xml), ...scored, timezone: 'America/Chicago', displayValue: 4 };
  const data = { forecastDate: '2026-10-18', generatedAt: '2026-10-17T22:00:00Z',
    spacingDegrees: .25, bbox: { west: -91.5, east: -75, south: 24, north: 39.5 },
    analysis: { landPointCount: 1000, missingPointCount: 0 }, qa: { anchorCities: [] },
    points: Array.from({ length: 1000 }, () => point) };
  const handler = createHandler({ clock: () => new Date('2026-10-17T22:01:00Z'),
    fetchImpl: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(data)) }) });
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  await handler({ query: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.points[0].finalCategory, 5);
  assert.equal(res.body.points[0].hours[0].reasoning.goldilocks.eligible, true);
  const lookup = buildCategoryLookup(res.body.points);
  const contour = sampleContour(point.lon, point.lat, lookup, .25, data.bbox);
  assert.equal(contour.mix[5], 1);
});

test('mobile focus and shared renderer preserve a published Goldilocks point', () => {
  const scored = scorePeriod(Array.from({ length: 4 }, () => ideal()));
  const point = { lat: 35.5, lon: -82.5, ...scored };
  const data = { points: [point], forecastDate: '2026-10-18', generatedAt: 'now',
    bbox: { west: -91.5, east: -75, south: 24, north: 39.5 }, spacingDegrees: .25 };
  const mobile = focusedDataset(data, { features: [{ properties: { NAME: 'North Carolina' } }] });
  assert.equal(mobile.points[0].finalCategory, 5);
  const field = sampleContour(point.lon, point.lat, buildCategoryLookup(mobile.points), .25, mobile.bbox);
  assert.equal(field.mix[5], 1);
});
