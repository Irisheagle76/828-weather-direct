const CHANNEL_ID = 'UCf88ZzHs8HzzRMMO7OGKmYA';
const LIVE_URL = 'https://www.youtube.com/@tballisty/live';
const CACHE_MS = 60_000;
let memoryCache = null;

// Read only the main player response, never recommended videos or feed archives.
export function extractLiveVideo(html) {
  const marker = /(?:var\s+)?ytInitialPlayerResponse\s*=\s*/g.exec(html || '');
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const player = JSON.parse(html.slice(start, i + 1));
        const video = player.videoDetails;
        const broadcast = player.microformat?.playerMicroformatRenderer?.liveBroadcastDetails;
        if (video?.channelId !== CHANNEL_ID || !/^[A-Za-z0-9_-]{11}$/.test(video?.videoId || '') ||
            player.playabilityStatus?.status !== 'OK' || player.playabilityStatus?.playableInEmbed === false ||
            broadcast?.isLiveNow !== true || broadcast?.endTimestamp) return null;
        return { videoId: video.videoId, title: video.title || 'East Asheville Live Stream' };
      } catch { return null; }
    }
  }
  return null;
}

export default async function handler(req, res) {
  const now = Date.now();
  if (!memoryCache || now - memoryCache.timestamp >= CACHE_MS) {
    let video = null;
    try {
      const response = await fetch(LIVE_URL, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9', 'Cache-Control': 'no-cache' },
        redirect: 'follow', signal: AbortSignal.timeout(12000)
      });
      if (response.ok) video = extractLiveVideo(await response.text());
    } catch { /* Fall back to the channel player; never resurrect an old video. */ }
    memoryCache = { timestamp: now, video };
  }
  const video = memoryCache.video;
  const params = new URLSearchParams({ playsinline: '1', rel: '0', autoplay: '1', mute: '1', origin: 'https://avlweather.com' });
  if (!video) params.set('channel', CHANNEL_ID);
  const payload = {
    status: video ? 'live' : 'fallback',
    ...(video || {}),
    source: video ? 'youtube-live-page' : 'youtube-channel-player',
    sourceUrl: LIVE_URL, permanentUrl: LIVE_URL,
    watchUrl: video ? `https://www.youtube.com/watch?v=${video.videoId}` : LIVE_URL,
    channelId: CHANNEL_ID,
    embedUrl: `https://www.youtube.com/embed/${video?.videoId || 'live_stream'}?${params}`,
    resolvedAt: new Date(memoryCache.timestamp).toISOString()
  };
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  res.setHeader('X-828-YouTube-Live', payload.status);
  return res.status(200).json(payload);
}
