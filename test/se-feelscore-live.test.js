import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getForecastPeriod, validateForecast } from '../public/js/se-feelscore-period.js';
import { createHandler } from '../lib/api-routes/se-feelscore.js';

test('Eastern 3 PM changes Today to Tomorrow, regardless of visitor timezone', () => {
  assert.deepEqual(getForecastPeriod(new Date('2026-09-14T18:59:59Z')), { forecastDate: '2026-09-14', label: 'Today' });
  assert.deepEqual(getForecastPeriod(new Date('2026-09-14T19:00:00Z')), { forecastDate: '2026-09-15', label: 'Tomorrow' });
  assert.deepEqual(getForecastPeriod(new Date('2026-09-15T03:59:59Z')), { forecastDate: '2026-09-15', label: 'Tomorrow' });
  assert.deepEqual(getForecastPeriod(new Date('2026-09-15T04:00:00Z')), { forecastDate: '2026-09-15', label: 'Today' });
});

test('winter, DST transitions and year-end use Eastern calendar rules', () => {
  assert.equal(getForecastPeriod(new Date('2026-01-01T19:59:59Z')).forecastDate, '2026-01-01');
  assert.equal(getForecastPeriod(new Date('2026-01-01T20:00:00Z')).forecastDate, '2026-01-02');
  assert.equal(getForecastPeriod(new Date('2026-03-08T19:00:00Z')).forecastDate, '2026-03-09');
  assert.equal(getForecastPeriod(new Date('2026-11-01T20:00:00Z')).forecastDate, '2026-11-02');
  assert.equal(getForecastPeriod(new Date('2026-12-31T20:00:00Z')).forecastDate, '2027-01-01');
});

function fixture(date = '2026-09-14') {
  return { forecastDate: date, generatedAt: '2026-09-14T10:00:00Z', spacingDegrees: .25,
    analysis: { landPointCount: 1000, missingPointCount: 0 }, bbox: {}, qa: { anchorCities: [] },
    points: Array.from({ length: 1000 }, () => ({ lat: 35, lon: -82, timezone: 'America/New_York', finalCategory: 3,
      hours: [12,13,14,15].map(hour => ({ localTime: `${hour}:00`, validTime: `${date}T${hour}:00:00-04:00` })) })),
  };
}
const now = new Date('2026-09-14T12:00:00Z');
function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, end() { return this; }, json(body) { this.body = body; return this; } };
}

test('validation rejects stale, wrong-day, missing and incorrect local forecast hours', () => {
  assert.equal(validateForecast(fixture(), '2026-09-14', now).points.length, 1000);
  assert.throws(() => validateForecast(fixture(), '2026-09-15', now), /date/);
  const stale = fixture(); stale.generatedAt = '2026-09-10T10:00:00Z';
  assert.throws(() => validateForecast(stale, '2026-09-14', now), /stale/);
  const incomplete = fixture(); incomplete.points[0].finalCategory = null;
  assert.throws(() => validateForecast(incomplete, '2026-09-14', now), /missing/);
  const wrongHour = fixture(); wrongHour.points[0].hours[0].validTime = '2026-09-14T11:00:00-04:00';
  assert.throws(() => validateForecast(wrongHour, '2026-09-14', now), /window/);
});

test('live API reads dated data, caches briefly, and switches at 3 PM', async () => {
  let instant = now, calls = [];
  const handler = createHandler({ clock: () => instant, fetchImpl: async url => {
    calls.push(url); return { ok: true, json: async () => fixture(url.split('/').at(-1).slice(0,10)) };
  } });
  const first = response(); await handler({ query: {} }, first);
  assert.equal(first.code, 200); assert.equal(first.body.displayPeriod, 'Today');
  assert.equal(first.headers['Cache-Control'], 'no-store');
  await handler({ query: {} }, response()); assert.equal(calls.length, 1);
  const unchanged = response(); await handler({ query: { since: first.body.generatedAt } }, unchanged);
  assert.equal(unchanged.code, 204); assert.equal(unchanged.body, undefined);
  instant = new Date('2026-09-14T19:00:00Z');
  const next = response(); await handler({ query: { date: '2026-09-15' } }, next);
  assert.equal(next.code, 200); assert.equal(next.body.displayPeriod, 'Tomorrow');
  assert.match(calls[1], /2026-09-15.json$/);
  const oldRequest = response(); await handler({ query: { date: '2026-09-14' } }, oldRequest);
  assert.equal(oldRequest.code, 409);
});

test('missing published data is unavailable, never silently replaced with an old map', async () => {
  const handler = createHandler({ clock: () => now, fetchImpl: async () => ({ ok: false, status: 404 }) });
  const res = response(); await handler({ query: {} }, res);
  assert.equal(res.code, 503); assert.equal(res.body.forecastDate, '2026-09-14');
});

test('page uses live dated API and refreshes an open or resumed page', async () => {
  const source = await readFile(new URL('../public/js/se-feelscore-page.js', import.meta.url), 'utf8');
  assert.match(source, /route=se-feelscore&date=/);
  assert.doesNotMatch(source, /fetch\('\/data\/feelscore-grid.json/);
  assert.match(source, /setTimeout\(refreshForecast/);
  assert.match(source, /visibilitychange/);
  assert.match(source, /crossedBoundary \? 0/);
});
