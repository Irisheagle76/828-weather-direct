import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshDates } from '../scripts/refresh-publish-se-feelscore.mjs';

test('morning refresh publishes both dates; afternoon recovery avoids expired today hours', () => {
  assert.deepEqual(refreshDates(new Date('2026-09-15T10:00:00Z')), ['2026-09-15','2026-09-16']);
  assert.deepEqual(refreshDates(new Date('2026-09-15T18:00:00Z')), ['2026-09-16']);
  assert.deepEqual(refreshDates(new Date('2026-09-15T21:00:00Z')), ['2026-09-16']);
});

test('refresh uses Eastern calendar across UTC midnight and year-end', () => {
  assert.deepEqual(refreshDates(new Date('2026-09-16T01:00:00Z')), ['2026-09-16']);
  assert.deepEqual(refreshDates(new Date('2027-01-01T01:00:00Z')), ['2027-01-01']);
});
