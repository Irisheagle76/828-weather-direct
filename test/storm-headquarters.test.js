import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('headquarters persists across ordinary Pulses, edits its gallery, and can be removed', async () => {
  const store = new Map();
  globalThis.__hqTestKv = {
    get: async key => store.get(key),
    set: async (key, value) => store.set(key, value),
    del: async key => store.delete(key)
  };
  try {
    const source = (await readFile(new URL('../lib/api-routes/tidbits/pulse-write.js', import.meta.url), 'utf8'))
      .replace('import { kv } from "@vercel/kv";', 'const kv = globalThis.__hqTestKv;')
      .replace('import { requireAdminSession } from "../../adminAuth.js";', 'const requireAdminSession = () => true;');
    const { default: write } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const publish = async body => {
      let status;
      let result;
      await write({ method: 'POST', body }, { status(value) { status = value; return this; }, json(value) { result = value; } });
      assert.equal(status, 200);
      return result.pulse;
    };
    const pinned = await publish({ title: 'Tracking Isaias', text: 'First thoughts', headquarters: true, gallery: ['https://example.com/map.png', 'javascript:alert(1)'] });
    assert.equal(store.has('pulse:latest'), false, 'event publication does not replace regular Pulse');
    assert.deepEqual(store.get('pulse:headquarters').gallery, ['https://example.com/map.png']);
    await publish({ title: 'Weather Pulse', text: 'Regular update', timestamp: pinned.timestamp + 1 });
    assert.equal(store.get('pulse:headquarters').text, 'First thoughts');
    await publish({ ...pinned, text: 'New thoughts', gallery: ['https://example.com/new.png'] });
    assert.equal(store.get('pulse:headquarters').text, 'New thoughts');
    const feedSource = (await readFile(new URL('../lib/api-routes/tidbits/pulse-feed.js', import.meta.url), 'utf8'))
      .replace('import { kv } from "@vercel/kv";', 'const kv = globalThis.__hqTestKv;');
    const { default: feed } = await import(`data:text/javascript;base64,${Buffer.from(feedSource).toString('base64')}`);
    let payload;
    await feed({ method: 'GET' }, { status() { return this; }, json(value) { payload = value; } });
    assert.equal(payload.headquartersPost.text, 'New thoughts');
    assert.equal(payload.text, 'Regular update');
    assert.ok(payload.recent.every(item => !item.headquarters));
    assert.ok(payload.items.some(item => item.headquarters), 'events remain in the full archive');
    await publish({ ...pinned, title: 'Winter Storm Headquarters', headquartersActive: true });
    assert.equal(store.get('pulse:headquarters').title, 'Winter Storm Headquarters');
    assert.equal(store.get('pulse:latest').text, 'Regular update');
    const regularLatest = store.get('pulse:latest');
    store.set('pulse:latest', pinned);
    await feed({ method: 'GET' }, { status() { return this; }, json(value) { payload = value; } });
    assert.equal(payload.title, 'Weather Pulse', 'legacy event latest pointer does not leak into regular Pulse');
    assert.equal(payload.items.filter(item => item.timestamp === pinned.timestamp).length, 1);
    assert.equal(payload.items.find(item => item.timestamp === pinned.timestamp).title, 'Winter Storm Headquarters');
    store.set('pulse:latest', regularLatest);
    await publish({ ...pinned, headquartersActive: false });
    assert.equal(store.has('pulse:headquarters'), false, 'visibility can end without converting event to regular Pulse');
    assert.ok(store.get('pulse:history').some(item => item.headquarters && item.headquartersActive === false));
    await publish({ ...pinned, headquarters: false });
    assert.equal(store.has('pulse:headquarters'), false);
    store.clear();
    await publish({ title: 'Flood Watch Headquarters', text: 'Event-only site', headquarters: true });
    await feed({ method: 'GET' }, { status() { return this; }, json(value) { payload = value; } });
    assert.equal(payload.fallback, true, 'no regular Pulse is fabricated from an event');
    assert.equal(payload.headquartersPost.title, 'Flood Watch Headquarters');
    assert.equal(payload.items.length, 1);
  } finally {
    delete globalThis.__hqTestKv;
  }
});
