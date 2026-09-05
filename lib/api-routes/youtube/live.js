const DEFAULT_HANDLE = "tballisty";
const CHANNEL_ID = "UCf88ZzHs8HzzRMMO7OGKmYA";
const CHANNEL_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;
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
  let resolverNote = null;

  try {
    let resolved = null;
    try {
      resolved = await resolveFromChannelFeed();
    } catch (error) {
      resolverNote = `Channel feed failed: ${error.message}`;
    }

    if (!resolved) {
      try {
        const response = await fetch(liveUrl, {
          headers: HEADERS,
          redirect: "follow",
          signal: AbortSignal.timeout(12000)
        });
        const html = await response.text();
        const videoId = response.ok ? extractVideoId(html) : null;
        if (videoId && await isExpectedEastAshevilleVideo(videoId)) {
          resolved = {
            videoId,
            title: "East Asheville Live Stream",
            source: "youtube-live-page"
          };
        } else {
          resolverNote = !response.ok
            ? `YouTube live page returned ${response.status}`
            : "No matching East Asheville live video found on YouTube live page";
        }
      } catch (error) {
        resolverNote = error.message;
      }
    }

    if (!resolved?.videoId) {
      const payload = {
        status: "fallback",
        reason: resolverNote || "No active East Asheville live video found",
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
      videoId: resolved.videoId,
      title: resolved.title,
      source: resolved.source,
      sourceUrl: liveUrl,
      watchUrl: `https://www.youtube.com/watch?v=${resolved.videoId}`,
      permanentUrl: liveUrl,
      channelId: CHANNEL_ID,
      embedUrl: buildVideoEmbedUrl(req, resolved.videoId),
      thumbnailUrl: `https://i.ytimg.com/vi/${resolved.videoId}/maxresdefault_live.jpg`,
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

async function resolveFromChannelFeed() {
  const response = await fetch(CHANNEL_FEED_URL, {
    headers: HEADERS,
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) return null;

  const xml = await response.text();
  return extractVideoFromFeed(xml);
}

export function extractVideoFromFeed(xml) {
  if (typeof xml !== "string" || !xml) return null;

  const entries = xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g);
  for (const entryMatch of entries) {
    const entry = entryMatch[1];
    const videoId = entry.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
    const channelId = entry.match(/<yt:channelId>([^<]+)<\/yt:channelId>/)?.[1];
    const title = decodeXml(entry.match(/<title>([^<]*)<\/title>/)?.[1] || "");
    const link = entry.match(/<link\s+rel="alternate"\s+href="([^"]+)"/)?.[1] || "";

    if (
      VIDEO_ID_PATTERN.test(videoId) &&
      channelId === CHANNEL_ID &&
      link.includes("/watch?v=") &&
      isEastAshevilleTitle(title)
    ) {
      return {
        videoId,
        title,
        source: "youtube-channel-feed"
      };
    }
  }

  return null;
}

export function extractVideoId(html) {
  if (typeof html !== "string" || !html) return null;

  const preferredPatterns = [
    /<link\s+rel=["']canonical["']\s+href=["']https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})["']/i,
    /<meta\s+property=["']og:url["']\s+content=["']https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})["']/i,
    /"canonicalUrl":"https:\/\/www\.youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})"/i,
    /"externalVideoId":"([A-Za-z0-9_-]{11})"/i,
    /"embed":\{"iframeUrl":"https:\/\/www\.youtube\.com\/embed\/([A-Za-z0-9_-]{11})"/i
  ];

  for (const pattern of preferredPatterns) {
    const match = html.match(pattern);
    const videoId = match?.[1];
    if (VIDEO_ID_PATTERN.test(videoId)) {
      return videoId;
    }
  }

  const playerResponseMatch = html.match(/var ytInitialPlayerResponse = (\{.*?\});<\/script>/);
  if (playerResponseMatch?.[1]) {
    try {
      const playerResponse = JSON.parse(playerResponseMatch[1]);
      const videoId =
        playerResponse?.videoDetails?.videoId ||
        playerResponse?.microformat?.playerMicroformatRenderer?.externalVideoId;
      if (VIDEO_ID_PATTERN.test(videoId)) return videoId;
    } catch {
      // Fall through to the conservative final pattern.
    }
  }

  const watchMatch = html.match(/\/watch\?v=([A-Za-z0-9_-]{11})/);
  return VIDEO_ID_PATTERN.test(watchMatch?.[1]) ? watchMatch[1] : null;
}

async function isExpectedEastAshevilleVideo(videoId) {
  if (!VIDEO_ID_PATTERN.test(videoId)) return false;

  try {
    const params = new URLSearchParams({
      url: `https://www.youtube.com/watch?v=${videoId}`,
      format: "json"
    });
    const response = await fetch(`https://www.youtube.com/oembed?${params.toString()}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.author_name === "Timothy Ballisty" && isEastAshevilleTitle(data?.title || "");
  } catch {
    return false;
  }
}

function isEastAshevilleTitle(title) {
  return /east\s+asheville\s+live\s+stream/i.test(String(title || ""));
}

function decodeXml(value) {
  return String(value || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'");
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
