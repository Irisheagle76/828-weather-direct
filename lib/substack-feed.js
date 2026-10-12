// RSS order is not a contract. Choose by publication time, never an undated or scheduled item.
export function newestPublishedPost(items = [], now = Date.now()) {
  return items
    .map(item => ({ item, time: Date.parse(item.isoDate || item.pubDate || '') }))
    .filter(({ item, time }) => item.title && item.link && Number.isFinite(time) && time <= now)
    .sort((a, b) => b.time - a.time || String(a.item.link).localeCompare(String(b.item.link)))
    [0]?.item || null;
}
