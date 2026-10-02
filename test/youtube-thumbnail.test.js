import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLiveThumbnailVideo } from '../lib/sky/youtube-thumbnail.js';
function page({ live = true, owner = 'UCf88ZzHs8HzzRMMO7OGKmYA', videoId = 'newLive1234' } = {}) {
  return 'var ytInitialData = ' + JSON.stringify({ currentVideoEndpoint: { watchEndpoint: { videoId } }, contents: { twoColumnWatchNextResults: { results: { results: { contents: [
    { videoPrimaryInfoRenderer: { viewCount: { videoViewCountRenderer: { isLive: live } } } },
    { videoSecondaryInfoRenderer: { owner: { videoOwnerRenderer: { navigationEndpoint: { browseEndpoint: { browseId: owner } } } } } }
  ] } } } } }) + ';';
}
test('public main-video metadata verifies a live thumbnail independently of embed playback', () => {
  assert.equal(extractLiveThumbnailVideo(page()).videoId, 'newLive1234');
  assert.equal(extractLiveThumbnailVideo(page({ live: false })), null);
  assert.equal(extractLiveThumbnailVideo(page({ owner: 'someone-else' })), null);
  assert.equal(extractLiveThumbnailVideo(page({ videoId: 'bad' })), null);
  assert.equal(extractLiveThumbnailVideo('var ytInitialData = {bad'), null);
});
