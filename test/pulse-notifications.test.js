import test from 'node:test';
import assert from 'node:assert/strict';
import { notifyPulse, pulseNotification } from '../lib/notifications/pulse.js';

const pulse = { timestamp: 123, text: '<p>Rain &amp; wind tonight.</p>' };
test('Pulse notification uses plain text and opens the mobile Pulse page', () => {
  const payload = pulseNotification(pulse);
  assert.equal(payload.body, 'Rain & wind tonight.');
  assert.equal(payload.title, '828 Pulse Updates');
  assert.equal(payload.url, '/mobile/#pulse');
  assert.ok(pulseNotification({ ...pulse, text: 'x'.repeat(250) }).body.length <= 180);
});
test('only explicit new regular Pulse requests reach the sender', async () => {
  let sent = 0;
  const dependencies = { claim: async () => true, send: async (payload, options) => {
    assert.equal(options.topic, 'pulse');
    sent++;
    return { sent: 1 };
  } };
  await notifyPulse(pulse, {}, dependencies);
  await notifyPulse(pulse, { requested: 'true' }, dependencies);
  await notifyPulse(pulse, { requested: true, editing: true }, dependencies);
  await notifyPulse({ ...pulse, headquarters: true }, { requested: true }, dependencies);
  assert.equal(sent, 0);
  assert.equal((await notifyPulse(pulse, { requested: true }, dependencies)).sent, 1);
});
test('duplicate claims and storage or delivery failures do not fail publishing', async () => {
  let sends = 0;
  const send = async () => { sends++; throw new Error('provider offline'); };
  assert.equal((await notifyPulse(pulse, { requested: true }, { claim: async () => null, send })).reason, 'already-requested');
  assert.equal(sends, 0);
  assert.equal((await notifyPulse(pulse, { requested: true }, { claim: async () => { throw new Error('offline'); }, send })).reason, 'delivery-unavailable');
  assert.equal(sends, 0);
  assert.equal((await notifyPulse(pulse, { requested: true }, { claim: async () => true, send })).reason, 'delivery-unavailable');
});
