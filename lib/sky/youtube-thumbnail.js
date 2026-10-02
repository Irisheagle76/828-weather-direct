import { extractLiveVideo } from '../api-routes/youtube/live.js';

// Playback can require sign-in while the public watch page still supplies its
// current video's live viewer count and owner. Use only that main-video data;
// recommendations and archived channel-feed entries are never candidates.
export function extractLiveThumbnailVideo(html) {
  const playable = extractLiveVideo(html);
  if (playable) return playable;
  const marker = /(?:var\s+)?ytInitialData\s*=\s*/.exec(html || '');
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; continue; }
    if (c === '"') quoted = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try {
        const data = JSON.parse(html.slice(start, i + 1));
        const contents = data.contents?.twoColumnWatchNextResults?.results?.results?.contents || [];
        const primary = contents.find(item => item.videoPrimaryInfoRenderer)?.videoPrimaryInfoRenderer;
        const owner = contents.find(item => item.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
        const videoId = data.currentVideoEndpoint?.watchEndpoint?.videoId;
        if (primary?.viewCount?.videoViewCountRenderer?.isLive !== true ||
          owner?.navigationEndpoint?.browseEndpoint?.browseId !== 'UCf88ZzHs8HzzRMMO7OGKmYA' ||
          !/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return null;
        return { videoId, title: 'East Asheville Live Stream' };
      } catch { return null; }
    }
  }
  return null;
}
