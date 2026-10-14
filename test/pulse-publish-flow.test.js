import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { notifyPulse } from '../lib/notifications/pulse.js';

test('admin publish saves before sending and respects Pulse opt-ins and opt-out', async () => {
  const store = new Map();
  const records = [
    { endpoint: 'pulse', preferences: { alerts: false, pulse: true } },
    { endpoint: 'bulletin', preferences: { alerts: true, pulse: false } },
    { endpoint: 'both', preferences: { alerts: true, pulse: true } },
    { endpoint: 'off', preferences: { alerts: false, pulse: false } },
    { endpoint: 'legacy' }
  ];
  const received = [];
  let admin = true;
  globalThis.__pulseFlow = {
    now: 1791980000000,
    kv: { get: async k => store.get(k), set: async (k,v) => store.set(k,v), del: async k => store.delete(k) },
    subscriptions: async () => records,
    sendNotification: async (sub, body) => {
      assert.ok(store.has('pulse:latest'));
      assert.ok(store.has('pulse:history'));
      received.push({ endpoint: sub.endpoint, payload: JSON.parse(body) });
    },
    auth: (_req,res) => admin || (res.status(401).json({ error: 'unauthorized' }), false)
  };
  try {
    let source = await readFile(new URL('../lib/notifications/sendPush.js', import.meta.url), 'utf8');
    source = source.replace('import webpush from "web-push";', 'const webpush = { setVapidDetails() {}, sendNotification: globalThis.__pulseFlow.sendNotification };')
      .replace(/import \{[\s\S]*?\} from "\.\/store\.js";/, 'const getAllSubscriptions=globalThis.__pulseFlow.subscriptions, removeSubscriptions=async()=>0, saveLastDelivery=async()=>{};')
      .replace('if (!vapidReady) {', 'if (false) {');
    const { sendPushToAll } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const claims = new Set();
    globalThis.__pulseFlow.notify = (pulse, options) => notifyPulse(pulse, options, {
      claim: async id => { if(claims.has(id)) return null; claims.add(id); return true; },
      send: sendPushToAll
    });
    source = (await readFile(new URL('../lib/api-routes/tidbits/pulse-write.js', import.meta.url), 'utf8'))
      .replaceAll('Date.now()', 'globalThis.__pulseFlow.now++')
      .replace('import { kv } from "@vercel/kv";', 'const kv=globalThis.__pulseFlow.kv;')
      .replace('import { notifyPulse } from "../../notifications/pulse.js";', 'const notifyPulse=globalThis.__pulseFlow.notify;')
      .replace('import { requireAdminSession } from "../../adminAuth.js";', 'const requireAdminSession=globalThis.__pulseFlow.auth;');
    const { default: publish } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    async function post(body) {
      const res = { status(code){this.code=code;return this;}, json(body){this.body=body;return this;} };
      await publish({method:'POST',body},res); return res;
    }
    const first = await post({title:'Weather Pulse',text:'<p>Rain arrives tonight.</p>',sendPush:true});
    assert.equal(first.code,200);
    assert.deepEqual(received.map(x=>x.endpoint),['pulse','both']);
    assert.equal(received[0].payload.body,'Rain arrives tonight.');
    assert.equal(received[0].payload.url,'/mobile/#pulse');
    records[0].preferences.pulse = false;
    received.length=0;
    await post({title:'Weather Pulse',text:'Next update',sendPush:true});
    assert.deepEqual(received.map(x=>x.endpoint),['both']);
    received.length=0;
    await post({...first.body.pulse,text:'Edited',sendPush:true});
    await post({title:'Quiet update',text:'No notification',sendPush:false});
    assert.equal(received.length,0);
    admin=false;
    assert.equal((await post({title:'Unauthorized',text:'Blocked',sendPush:true})).code,401);
    assert.equal(received.length,0);
  } finally { delete globalThis.__pulseFlow; }
});

test('service worker displays the Pulse payload and notification tap opens Pulse', async () => {
  const listeners={}, displayed=[], opened=[];
  const context={ console:{log(){}}, self:{addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification:async(title,options)=>displayed.push({title,options})}},clients:{openWindow:async url=>opened.push(url)} };
  vm.runInNewContext(await readFile(new URL('../public/sw.js',import.meta.url),'utf8'),context);
  let pending;
  listeners.push({data:{json:()=>({title:'828 Pulse Updates',body:'Rain tonight',url:'/mobile/#pulse'})},waitUntil:p=>pending=p});
  await pending;
  let closed=false;
  listeners.notificationclick({notification:{data:displayed[0].options.data,close(){closed=true;}},waitUntil:p=>pending=p});
  await pending;
  assert.equal(closed,true);
  assert.deepEqual(opened,['/mobile/#pulse']);
  assert.equal(displayed[0].title,'828 Pulse Updates');
});
