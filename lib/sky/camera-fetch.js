import { createHash } from 'node:crypto';
import { extractLiveVideo } from '../api-routes/youtube/live.js';

const MAX_BYTES = 12 * 1024 * 1024;
export async function fetchCameraFrame(camera, { fetchImpl = fetch, now = Date.now() } = {}) {
  const get = async (url) => {
    const response = await fetchImpl(`${url}${url.includes('?') ? '&' : '?'}t=${now}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/jpeg,application/json,text/html' },
      signal: AbortSignal.timeout(10000)
    });
    if (!response.ok) throw new Error(`Camera source returned ${response.status}`);
    return response;
  };
  let snapshotUrl = camera.snapshotUrl, manifest = null;
  if (camera.id === 'east-asheville-east') {
    // Prefer a verified current broadcast. A scheduled capture is the fallback
    // when YouTube denies requests from the serverless host.
    try {
      const page = await get('https://www.youtube.com/@tballisty/live');
      const live = extractLiveVideo(await page.text());
      if (live) snapshotUrl = `https://i.ytimg.com/vi/${live.videoId}/maxresdefault_live.jpg`;
    } catch { /* The verified manifest below remains an independent source. */ }
  }
  if (camera.manifestUrl && snapshotUrl === camera.snapshotUrl) {
    manifest = await (await get(camera.manifestUrl)).json();
    if (manifest.source !== camera.id || manifest.status !== 'ok' || !Number.isFinite(Date.parse(manifest.observedAt))) {
      throw new Error('No verified recent capture');
    }
  }
  const response = await get(snapshotUrl);
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Camera image too large');
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) throw new Error('Camera image too large');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const buffer = Buffer.concat(chunks);
  if (manifest && createHash('sha256').update(buffer).digest('hex') !== manifest.sha256) throw new Error('Camera capture is updating; retry shortly');
  const modified = Date.parse(manifest?.observedAt || response.headers.get('last-modified') || '');
  return { buffer, timestamp: new Date(Number.isFinite(modified) ? modified : now).toISOString(),
    timestampBasis: manifest?.timestampBasis || (Number.isFinite(modified) ? 'source' : 'received'), receivedAt: new Date(now).toISOString() };
}
