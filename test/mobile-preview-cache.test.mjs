import test from "node:test";
import assert from "node:assert/strict";
import { createUpstreamCache } from "../tools/mobile-preview/upstream-cache.mjs";

test("shares cached and simultaneous requests across tabs, ignores cache busting", async () => {
  let calls = 0, time = 0;
  const get = createUpstreamCache({ now: () => time, fetchImpl: async () => { calls++; return new Response('{"ok":true}'); } });
  const url = new URL("http://localhost/api/router?route=weather&type=hourly&t=1");
  await Promise.all([get(url), get(url), get(url)]);
  url.searchParams.set("t", "2");
  assert.equal((await get(url)).cache, "HIT");
  assert.equal(calls, 1);
  time = 600_001;
  await get(url);
  assert.equal(calls, 2);
});

test("keeps locations distinct and backs off failures without stale fallback", async () => {
  let calls = 0, time = 0;
  const get = createUpstreamCache({ now: () => time, fetchImpl: async () => { calls++; throw new Error("offline"); } });
  const url = new URL("http://localhost/api/router?route=weather&lat=35");
  assert.equal((await get(url)).status, 503);
  await get(url);
  assert.equal(calls, 1);
  url.searchParams.set("lat", "36");
  await get(url);
  assert.equal(calls, 2);
  time = 30_001;
  await get(url);
  assert.equal(calls, 3);
});
