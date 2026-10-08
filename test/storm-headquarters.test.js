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
    assert.deepEqual(store.get('pulse:headquarters').gallery, ['https://example.com/map.png']);
    await publish({ title: 'Weather Pulse', text: 'Regular update' });
    assert.equal(store.get('pulse:headquarters').text, 'First thoughts');
    await publish({ ...pinned, text: 'New thoughts', gallery: ['https://example.com/new.png'] });
    assert.equal(store.get('pulse:headquarters').text, 'New thoughts');
    const feedSource = (await readFile(new URL('../lib/api-routes/tidbits/pulse-feed.js', import.meta.url), 'utf8'))
      .replace('import { kv } from "@vercel/kv";', 'const kv = globalThis.__hqTestKv;');
    const { default: feed } = await import(`data:text/javascript;base64,${Buffer.from(feedSource).toString('base64')}`);
    let payload;
    await feed({ method: 'GET' }, { status() { return this; }, json(value) { payload = value; } });
    assert.equal(payload.headquartersPost.text, 'New thoughts');
    await publish({ ...pinned, headquarters: false });
    assert.equal(store.has('pulse:headquarters'), false);
  } finally {
    delete globalThis.__hqTestKv;
  }
});
