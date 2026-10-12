export function getPulseMedia(post = {}) {
  const candidates = [post.mediaUrl, post.image, ...(Array.isArray(post.gallery) ? post.gallery : [])];
  for (const value of candidates) {
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      const url = new URL(value, 'https://avlweather.com');
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      const isVideo = value === post.mediaUrl && post.mediaType === 'video' || /\.(mp4|mov|webm)(?:$|\?)/i.test(value) || value.includes('/video/');
      return { url: value, mediaType: isVideo ? 'video' : 'image' };
    } catch { /* Try the next uploaded image. */ }
  }
  return { url: '', mediaType: null };
}

export function getEventMedia(post = {}, { preview = false } = {}) {
  const entries = [
    { url: post.mediaUrl || post.image, mediaType: post.mediaType },
    ...(Array.isArray(post.gallery) ? post.gallery.slice(0, 12).map(url => ({ url })) : [])
  ];
  const seen = new Set();
  return entries.flatMap(entry => {
    if (typeof entry.url !== 'string' || seen.has(entry.url)) return [];
    try {
      const protocol = new URL(entry.url).protocol;
      if (protocol !== 'https:' && !(preview && ['http:', 'blob:'].includes(protocol))) return [];
      const media = protocol === 'blob:'
        ? { url: entry.url, mediaType: entry.mediaType || 'image' }
        : getPulseMedia({ mediaUrl: entry.url, mediaType: entry.mediaType });
      if (!media.url) return [];
      seen.add(media.url);
      return [media];
    } catch { return []; }
  });
}
