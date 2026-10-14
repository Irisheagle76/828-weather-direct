import test from 'node:test';
import assert from 'node:assert/strict';
import { createTestHandler } from '../lib/api-routes/notifications/test.js';

const sub = { endpoint: 'https://web.push.apple.com/test-device', keys: { p256dh: 'key', auth: 'auth' }, preferences: { alerts: false, pulse: true } };
async function request(overrides = {}, input = sub, method = 'POST') {
  const deliveries = [];
  const handler = createTestHandler({ config: () => ({ vapidReady: true }), subscriptions: async () => [sub], claim: async () => true, deliver: async (subs, payload) => { deliveries.push({ subs, payload }); return { sent: 1 }; }, ...overrides });
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ method, body: input }, res);
  return { ...res, deliveries };
}
test('device test targets exactly the matching saved subscription and opens Pulse', async () => {
  const result = await request();
  assert.equal(result.code, 200);
  assert.equal(result.deliveries.length, 1);
  assert.deepEqual(result.deliveries[0].subs, [sub]);
  assert.equal(result.deliveries[0].payload.url, '/mobile/#pulse');
});
test('invalid, unknown, disabled and rate-limited subscriptions never send', async () => {
  for (const [overrides, input, code] of [
    [{}, {}, 400],
    [{}, { ...sub, keys: { ...sub.keys, auth: 'wrong' } }, 403],
    [{ subscriptions: async () => [{ ...sub, preferences: { alerts: false, pulse: false } }] }, sub, 403],
    [{ claim: async () => null }, sub, 429],
    [{ config: () => ({ vapidReady: false }) }, sub, 503]
  ]) {
    const result = await request(overrides, input);
    assert.equal(result.code, code);
    assert.equal(result.deliveries.length, 0);
  }
});
test('untrusted stored endpoints and storage errors fail closed', async () => {
  const bad = { ...sub, endpoint: 'https://localhost/test' };
  assert.equal((await request({ subscriptions: async () => [bad] }, bad)).code, 400);
  assert.equal((await request({ subscriptions: async () => { throw Error('offline'); } })).code, 503);
  assert.equal((await request({ deliver: async () => ({ sent: 0 }) })).code, 502);
  assert.equal((await request({}, sub, 'GET')).code, 405);
});
