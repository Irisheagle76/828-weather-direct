import test from 'node:test';
import assert from 'node:assert/strict';
import { getPulseMedia, getEventMedia } from '../public/js/intel/pulse-media.js';

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

test('event supports a primary video alongside uploaded gallery images and videos', () => {
  const items = getEventMedia({ mediaUrl: 'https://example.com/update.mp4', mediaType: 'video', gallery: ['https://example.com/map.png', 'https://res.cloudinary.com/demo/video/upload/clip'] });
  assert.deepEqual(items.map(item => item.mediaType), ['video', 'image', 'video']);
});
test('event does not duplicate a primary video already in its gallery', () => {
  assert.equal(getEventMedia({ mediaUrl: 'https://example.com/update.mp4', gallery: ['https://example.com/update.mp4'] }).length, 1);
});
test('event local media URLs are accepted only for composer preview', () => {
  const post = { mediaUrl: 'blob:https://avlweather.com/preview', mediaType: 'video' };
  assert.equal(getEventMedia(post).length, 0);
  assert.equal(getEventMedia(post, { preview: true })[0].mediaType, 'video');
  assert.equal(getEventMedia({ mediaUrl: 'javascript:alert(1)' }, { preview: true }).length, 0);
});
