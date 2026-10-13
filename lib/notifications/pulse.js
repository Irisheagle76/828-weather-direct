import { kv } from '@vercel/kv';
import { sendPushToAll } from './sendPush.js';

export function pulseNotification(pulse) {
  const body = String(pulse.text || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ').trim();
  return {
    title: '828 Pulse Updates',
    body: body.length > 180 ? `${body.slice(0, 177)}…` : body,
    url: '/mobile/#pulse',
    tag: `828-pulse-${pulse.timestamp}`,
    renotify: false
  };
}

export async function notifyPulse(pulse, { requested, editing } = {}, {
  claim = id => kv.set(`notifications:pulse:${id}`, 'claimed', { nx: true, ex: 604800 }),
  send = sendPushToAll
} = {}) {
  if (requested !== true) return { skipped: true, reason: 'not-requested' };
  if (editing || pulse.headquarters) return { skipped: true, reason: 'new-pulse-only' };
  try {
    if (!await claim(pulse.timestamp)) return { skipped: true, reason: 'already-requested' };
    return await send(pulseNotification(pulse), { topic: 'pulse' });
  } catch {
    // Publishing succeeded. Never invite a republish just because delivery failed.
    return { skipped: true, reason: 'delivery-unavailable' };
  }
}
