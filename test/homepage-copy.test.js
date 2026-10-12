import test from 'node:test';
import assert from 'node:assert/strict';
import { rainfallDate, headlineForPulse } from '../public/js/intel/homepage-copy.js';
import { newestPublishedPost } from '../lib/substack-feed.js';

test('rainfall dates distinguish October 11 from November 10 without timezone shifts', () => {
  assert.equal(rainfallDate('20261011'), 'Oct 11, 2026');
  assert.equal(rainfallDate('20261110'), 'Nov 10, 2026');
  assert.equal(rainfallDate('20240229'), 'Feb 29, 2024');
  for (const value of ['20260229', '20261301', '20260431', '', null]) assert.equal(rainfallDate(value), '--');
});

test('generic Pulse titles use the post itself while editorial headlines are preserved', () => {
  assert.equal(headlineForPulse({ title: 'Weather Pulse' }, 'Mist moves through Asheville. Sunshine returns later.'), 'Mist moves through Asheville.');
  assert.equal(headlineForPulse({ title: '828 Weather Pulse' }, 'Rain totals are in.'), 'Rain totals are in.');
  assert.equal(headlineForPulse({ title: 'Winter storm update' }, 'Snow tonight.'), 'Winter storm update');
  assert.equal(headlineForPulse({ headline: 'Watch the ridge winds', title: 'Weather Pulse' }, 'Wind is increasing.'), 'Watch the ridge winds');
  const long = headlineForPulse({}, 'A locally written update '.repeat(20));
  assert.ok(long.length <= 110);
  assert.ok(long.endsWith('…'));
  assert.equal(headlineForPulse(), 'Local weather update');
});

test('newest Substack selection ignores RSS order, undated entries, and scheduled posts', () => {
  const old = { title: 'Spring', link: '/spring', pubDate: '2026-06-04T12:00:00Z' };
  const recent = { title: 'Autumn', link: '/autumn', isoDate: '2026-10-09T12:00:00Z' };
  const future = { title: 'Scheduled', link: '/scheduled', pubDate: '2026-11-01T12:00:00Z' };
  const undated = { title: 'Unknown', link: '/unknown' };
  const now = Date.parse('2026-10-12T12:00:00Z');
  assert.equal(newestPublishedPost([future, old, undated, recent], now), recent);
  assert.equal(newestPublishedPost([recent, old], now), recent);
  assert.equal(newestPublishedPost([undated, future], now), null);
  assert.equal(newestPublishedPost([], now), null);
  assert.equal(newestPublishedPost([{ ...recent, link: '' }, old], now), old);
});
