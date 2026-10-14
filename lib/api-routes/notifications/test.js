import { createHash } from 'node:crypto';
import { kv } from '@vercel/kv';
import { getAllSubscriptions } from '../../notifications/store.js';
import { deliverPushNotifications, getPushConfigStatus } from '../../notifications/sendPush.js';

export function createTestHandler({
  config = getPushConfigStatus,
  subscriptions = getAllSubscriptions,
  claim = endpoint => kv.set(`notifications:test:${createHash('sha256').update(endpoint).digest('hex')}`, 'sent', { nx: true, ex: 60 }),
  deliver = deliverPushNotifications
} = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const input = req.body;
    if (!input?.endpoint || !input?.keys?.p256dh || !input?.keys?.auth) return res.status(400).json({ error: 'Enable notifications on this device first.' });
    try {
      if (!config().vapidReady) return res.status(503).json({ error: 'Push delivery is not configured yet.' });
      const sub = (await subscriptions()).find(item => item.endpoint === input.endpoint && item.keys.p256dh === input.keys.p256dh && item.keys.auth === input.keys.auth);
      if (!sub || (!sub.preferences?.alerts && !sub.preferences?.pulse)) return res.status(403).json({ error: 'Save your notification preferences on this device first.' });
      const url = new URL(sub.endpoint);
      const host = url.hostname;
      const supported = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com' || host === 'web.push.apple.com' || host.endsWith('.notify.windows.com');
      if (url.protocol !== 'https:' || url.port || !supported) return res.status(400).json({ error: 'This push provider is not supported for testing.' });
      if (!await claim(sub.endpoint)) return res.status(429).json({ error: 'Wait one minute before testing again.' });
      const result = await deliver([sub], {
        title: '828 notification test',
        body: 'Notifications are reaching this device. Tap to open 828 Pulse.',
        url: '/mobile/#pulse', tag: '828-device-test', renotify: false
      });
      if (result.sent !== 1) return res.status(502).json({ error: 'The push service did not accept the test. Try enabling notifications again.' });
      return res.status(200).json({ ok: true, accepted: true });
    } catch {
      return res.status(503).json({ error: 'Notification delivery or storage is temporarily unavailable.' });
    }
  };
}

export default createTestHandler();
