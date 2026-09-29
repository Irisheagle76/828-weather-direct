import { kv } from '@vercel/kv';
import { dayKey, LEAD_MS, MATCH_TOLERANCE_MS, SLOT_MS, predictionId } from './verification.js';
const DAY = 86400000;
const key = (kind, day) => `fog:verification:v1:${kind}:${day}`;
const values = data => Object.values(data || {}).filter(Boolean).map(v => typeof v === 'string' ? JSON.parse(v) : v);
export function createFogStore(client = kv) {
  async function save(kind, item, at, immutable) {
    const k = key(kind, dayKey(at));
    if (immutable) await client.hsetnx(k, item.id, item);
    else await client.hset(k, { [item.id]: item });
    await client.expireat(k, Math.floor((Date.parse(`${dayKey(at)}T00:00:00Z`) + 400 * DAY) / 1000));
    const saved = await client.hget(k, item.id);
    if (!saved) throw new Error('Archive readback failed');
    return typeof saved === 'string' ? JSON.parse(saved) : saved;
  }
  async function days(kind, dates) {
    const result = [];
    // Bound concurrent reads, rather than issuing 120 connections at once.
    for (let i = 0; i < dates.length; i += 8) {
      const batch = await Promise.all(dates.slice(i, i + 8).map(day => client.hgetall(key(kind, day))));
      result.push(...batch.flatMap(values));
    }
    return result;
  }
  return {
    savePrediction: item => save('predictions', item, item.issuedAt, true),
    saveLabel: item => save('labels', item, item.observedAt, false),
    async load(now = Date.now()) {
      const dates = Array.from({ length: 121 }, (_, i) => dayKey(now - i * DAY));
      const labels = (await days('labels', dates)).filter(l => now - l.observedAt <= 120 * DAY);
      const recent = await days('predictions', dates.slice(0, 2));
      const wanted = new Map();
      for (const label of labels) {
        const target = label.observedAt - LEAD_MS;
        for (let at = Math.floor((target - MATCH_TOLERANCE_MS) / SLOT_MS) * SLOT_MS; at <= target + MATCH_TOLERANCE_MS; at += SLOT_MS) {
          const k = key('predictions', dayKey(at));
          if (!wanted.has(k)) wanted.set(k, new Set());
          wanted.get(k).add(predictionId(label.stationId, at));
        }
      }
      const matched = [];
      const groups = [...wanted];
      for (let i = 0; i < groups.length; i += 8) {
        const batch = await Promise.all(groups.slice(i, i + 8).map(([k, ids]) => client.hmget(k, ...ids)));
        matched.push(...batch.flatMap(values));
      }
      return { labels, predictions: [...new Map([...recent, ...matched].map(p => [p.id, p])).values()], recent };
    }
  };
}
