import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLiveVideo } from '../lib/api-routes/youtube/live.js';
const player = () => ({ videoDetails: { channelId: 'UCf88ZzHs8HzzRMMO7OGKmYA', videoId: 'm3ADntEVh2M', title: 'East Asheville Live Stream' }, playabilityStatus: { status: 'OK', playableInEmbed: true }, microformat: { playerMicroformatRenderer: { liveBroadcastDetails: { isLiveNow: true } } } });
const html = p => `<script>var ytInitialPlayerResponse = ${JSON.stringify(p)}; unrelated();</script>`;
test('resolves the current broadcast without relying on a pinned ID', () => {
  const p = player(); p.videoDetails.videoId = 'newLive1234';
  assert.equal(extractLiveVideo(html(p)).videoId, 'newLive1234');
});
test('rejects archives, upcoming streams, other channels and unavailable embeds', () => {
  for (const mutate of [p => p.microformat.playerMicroformatRenderer.liveBroadcastDetails.isLiveNow = false, p => p.microformat.playerMicroformatRenderer.liveBroadcastDetails.endTimestamp = '2026-10-01', p => p.videoDetails.channelId = 'another-channel', p => p.playabilityStatus.status = 'ERROR', p => p.playabilityStatus.playableInEmbed = false]) {
    const p = player(); mutate(p); assert.equal(extractLiveVideo(html(p)), null);
  }
});
test('handles quoted braces and ignores recommendation IDs and malformed responses', () => {
  const p = player(); p.videoDetails.title = 'A "live" view {Asheville}';
  assert.equal(extractLiveVideo(html(p)).title, p.videoDetails.title);
  assert.equal(extractLiveVideo('watch?v=epr3iOfv9FM'), null);
  assert.equal(extractLiveVideo('var ytInitialPlayerResponse = {broken};'), null);
});


