const DEFAULT_HANDLE = "tballisty";
const CHANNEL_ID = "UCf88ZzHs8HzzRMMO7OGKmYA";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache"
};

let memoryCache = null;
const CACHE_MS = 60 * 1000;

export default async function handler(req, res) {
  const now = Date.now();
  if (memoryCache && now - memoryCache.timestamp < CACHE_MS) {
    return send(res, memoryCache.payload);
  }

  const rawHandle = String(req.query?.handle || DEFAULT_HANDLE).replace(/^@/, "");
  const handle = /^[A-Za-z0-9._-]{3,64}$/.test(rawHandle) ? rawHandle : DEFAULT_HANDLE;
  const liveUrl = `https://www.youtube.com/@${handle}/live`;
  const channelEmbedUrl = buildChannelEmbedUrl(req);

  try {
    const response = await fetch(liveUrl, {
      headers: HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    const html = await response.text();
    const videoId = extractVideoId(html);

    if (!response.ok || !videoId) {
      const payload = {
        status: "fallback",
        reason: !response.ok ? `YouTube returned ${response.status}` : "No active video ID found",
        sourceUrl: liveUrl,
        watchUrl: liveUrl,
        channelId: CHANNEL_ID,
        embedUrl: channelEmbedUrl,
        resolvedAt: new Date(now).toISOString()
      };
      memoryCache = { timestamp: now, payload };
      return send(res, payload);
    }

    const payload = {
      status: "live",
      videoId,
      sourceUrl: liveUrl,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      permanentUrl: liveUrl,
      channelId: CHANNEL_ID,
      embedUrl: buildVideoEmbedUrl(req, videoId),
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault_live.jpg`,
      resolvedAt: new Date(now).toISOString()
    };
    memoryCache = { timestamp: now, payload };
    return send(res, payload);
  } catch (error) {
    const payload = {
      status: "fallback",
      reason: error.message,
      sourceUrl: liveUrl,
      watchUrl: liveUrl,
      channelId: CHANNEL_ID,
      embedUrl: channelEmbedUrl,
      resolvedAt: new Date(now).toISOString()
    };
    memoryCache = { timestamp: now, payload };
    return send(res, payload);
  }
}

export function extractVideoId(html) {
  if (typeof html !== "string" || !html) return null;

  const patterns = [
    /"videoId":"([A-Za-z0-9_-]{11})"/g,
    /watch\?v=([A-Za-z0-9_-]{11})/g,
    /\/embed\/([A-Za-z0-9_-]{11})/g
  ];

  const seen = new Set();
  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const videoId = match?.[1];
      if (VIDEO_ID_PATTERN.test(videoId) && !seen.has(videoId)) {
        seen.add(videoId);
        return videoId;
      }
    }
  }

  return null;
}

function buildVideoEmbedUrl(req, videoId) {
  const params = new URLSearchParams({
    playsinline: "1",
    rel: "0",
    autoplay: "1",
    mute: "1",
    origin: getOrigin(req)
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

function buildChannelEmbedUrl(req) {
  const params = new URLSearchParams({
    channel: CHANNEL_ID,
    playsinline: "1",
    rel: "0",
    autoplay: "1",
    mute: "1",
    origin: getOrigin(req)
  });
  return `https://www.youtube.com/embed/live_stream?${params.toString()}`;
}

function getOrigin(req) {
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  const host = req.headers?.["x-forwarded-host"] || req.headers?.host || "avlweather.com";
  return `${proto}://${host}`;
}

function send(res, payload) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.setHeader("X-828-YouTube-Live", payload.status);
  return res.status(200).json(payload);
}
