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
