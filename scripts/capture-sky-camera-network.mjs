import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { extractLiveVideo } from '../lib/api-routes/youtube/live.js';

const run = promisify(execFile);
const directory = new URL('../public/sky-camera-observations/', import.meta.url);
await mkdir(directory, { recursive: true });
const chamberStream = 'https://svrhearst.videstra.live/hls_output/674b5cf0-55b3-49e2-a8da-bb57ce2ece92_8UIJMXTyGjrwwXziaJUoFLf9hWifZbKVtWF5D__kswZPhLz4beUpNJK7w4Fgl8eu/index.m3u8';
async function get(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  return response;
}
await Promise.all(['east-asheville-east', 'chamber-southwest'].map(async (source) => {
  const attemptedAt = new Date().toISOString();
  let manifest;
  try {
    let buffer, observedAt, videoId, timestampBasis = 'received';
    if (source === 'east-asheville-east') {
      const html = await (await get('https://www.youtube.com/@tballisty/live')).text();
      const live = extractLiveVideo(html);
      if (!live) console.log('YouTube source diagnostics', JSON.stringify({bytes:html.length, player:html.includes('ytInitialPlayerResponse'), liveNow:html.includes('\"isLiveNow\":true'), matches:html.match(/.{0,25}(?:isLiveNow|liveBroadcastDetails|LOGIN_REQUIRED|videoId|channelId|canonical).{0,150}/g)?.slice(0,12)}));
      if (!live) throw new Error('Current live broadcast could not be verified');
      videoId = live.videoId;
      const response = await get(`https://i.ytimg.com/vi/${videoId}/maxresdefault_live.jpg?t=${Date.now()}`);
      const modified = Date.parse(response.headers.get('last-modified') || '');
      if (Number.isFinite(modified) && (Date.now() - modified > 15 * 60_000 || modified > Date.now() + 60_000)) throw new Error('Thumbnail timestamp is stale');
      observedAt = Number.isFinite(modified) ? new Date(modified).toISOString() : attemptedAt;
      timestampBasis = Number.isFinite(modified) ? 'source' : 'received';
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      // Capture a current HLS frame outside the serverless request path.
      const result = await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-rw_timeout', '20000000', '-live_start_index', '-1', '-i', chamberStream, '-frames:v', '1', '-vf', 'scale=1280:-2', '-f', 'image2pipe', '-vcodec', 'mjpeg', 'pipe:1'], { encoding: 'buffer', timeout: 45000, maxBuffer: 12 * 1024 * 1024 });
      buffer = result.stdout;
      observedAt = attemptedAt;
    }
    if (buffer.length < 10000 || buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('Invalid camera JPEG');
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    // Do not relabel an unchanged capture with a new observation time.
    const previous = await readFile(new URL(`${source}.json`, directory), 'utf8').then(JSON.parse).catch(() => null);
    if (previous?.sha256 === sha256 && previous.observedAt) observedAt = previous.observedAt;
    await writeFile(new URL(`${source}.jpg`, directory), buffer);
    manifest = { source, status: 'ok', observedAt, timestampBasis, attemptedAt, sha256, ...(videoId ? { videoId } : {}) };
  } catch (error) {
    manifest = { source, status: 'unavailable', attemptedAt, reason: error.message };
  }
  await writeFile(new URL(`${source}.json`, directory), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`${source}: ${manifest.status}`);
}));
