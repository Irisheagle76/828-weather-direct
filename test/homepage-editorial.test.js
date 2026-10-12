import test from 'node:test';
import assert from 'node:assert/strict';
import { homepageEditorialMode } from '../public/js/intel/homepage-editorial.js';

const endedAt = Date.UTC(2026, 9, 11, 12);
test('active event takes precedence even over a newly published regular Pulse', () => {
  assert.equal(homepageEditorialMode({ headquartersPost: { title: 'Flood Watch' }, timestamp: endedAt + 1000 }), 'event');
  assert.equal(homepageEditorialMode({ headquartersPost: { title: 'Flood Watch' }, fallback: true }), 'event');
});
test('event ending does not resurface a pre-event Pulse', () => {
  assert.equal(homepageEditorialMode({ eventEndedAt: endedAt, timestamp: endedAt - 1000 }), 'quiet');
  assert.equal(homepageEditorialMode({ eventEndedAt: endedAt, timestamp: endedAt }), 'quiet');
});
test('publishing or editing a regular Pulse after the event restores normal mode', () => {
  assert.equal(homepageEditorialMode({ eventEndedAt: endedAt, timestamp: endedAt + 1000 }), 'pulse');
  assert.equal(homepageEditorialMode({ eventEndedAt: endedAt, timestamp: endedAt - 1000, editedAt: endedAt + 1000 }), 'pulse');
});
test('normal Pulse shelf retains its usual behavior before any event', () => {
  assert.equal(homepageEditorialMode({ timestamp: endedAt - 86400000 }), 'pulse');
  assert.equal(homepageEditorialMode({ fallback: true }), 'quiet');
  assert.equal(homepageEditorialMode(null), 'quiet');
});
test('inactive headquarters and malformed regular timestamps do not bypass the cutoff', () => {
  assert.equal(homepageEditorialMode({ headquartersPost: { headquartersActive: false }, eventEndedAt: endedAt, timestamp: 'bad' }), 'quiet');
});
