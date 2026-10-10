import test from 'node:test';
import assert from 'node:assert/strict';
import { getPulseMedia } from '../public/js/intel/pulse-media.js';

test('gallery-only Pulse uses its own first uploaded image', () => {
  assert.deepEqual(getPulseMedia({ mediaUrl: null, gallery: ['https://example.com/current-map.png', 'https://example.com/second.png'] }), { url: 'https://example.com/current-map.png', mediaType: 'image' });
});
test('text-only Pulse has no unrelated camera fallback', () => {
  assert.deepEqual(getPulseMedia({ text: 'Latest thoughts' }), { url: '', mediaType: null });
});
test('explicit post media is retained and video type is recognized', () => {
  assert.deepEqual(getPulseMedia({ mediaUrl: 'https://example.com/update.mp4', mediaType: 'video', gallery: ['https://example.com/map.png'] }), { url: 'https://example.com/update.mp4', mediaType: 'video' });
});
test('unsafe media is skipped in favor of a valid uploaded gallery image', () => {
  assert.equal(getPulseMedia({ mediaUrl: 'javascript:alert(1)', gallery: ['https://example.com/map.png'] }).url, 'https://example.com/map.png');
});
