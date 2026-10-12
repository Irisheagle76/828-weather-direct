import { pulseTimestamp } from '../pulse-freshness.js';

export function homepageEditorialMode(feed) {
  if (feed?.headquartersPost && feed.headquartersPost.headquartersActive !== false) return 'event';
  if (!feed || feed.fallback || feed.headquarters) return 'quiet';
  const endedAt = pulseTimestamp(feed.eventEndedAt);
  const updatedAt = pulseTimestamp(feed.editedAt || feed.timestamp);
  if (Number.isFinite(endedAt) && (!Number.isFinite(updatedAt) || updatedAt <= endedAt)) return 'quiet';
  return 'pulse';
}
