import assert from "node:assert/strict";
import test from "node:test";

import { deliverPushNotifications } from "../lib/notifications/sendPush.js";
import { createSubscriptionStore } from "../lib/notifications/store.js";

function subscription(number) {
  return {
    endpoint: `https://push.example.test/subscription-${number}`,
    expirationTime: null,
    keys: {
      p256dh: `p256dh-${number}`,
      auth: `auth-${number}`
    }
  };
}

function createRedisMock(initial = {}) {
  const strings = new Map(Object.entries(initial));
  const hashes = new Map();

  return {
    strings,
    hashes,
    async get(key) {
      return strings.get(key) ?? null;
    },
    async set(key, value) {
      strings.set(key, value);
      return "OK";
    },
    async del(key) {
      return strings.delete(key) ? 1 : 0;
    },
    async hget(key, field) {
      return hashes.get(key)?.get(field) ?? null;
    },
    async hgetall(key) {
      const hash = hashes.get(key);
      return hash ? Object.fromEntries(hash) : {};
    },
    async hset(key, values) {
      if (!hashes.has(key)) hashes.set(key, new Map());
      const hash = hashes.get(key);
      Object.entries(values).forEach(([field, value]) => hash.set(field, value));
      return Object.keys(values).length;
    },
    async hdel(key, ...fields) {
      const hash = hashes.get(key);
      if (!hash) return 0;
      return fields.reduce((removed, field) => removed + (hash.delete(field) ? 1 : 0), 0);
    }
  };
}

test("legacy subscriptions copy once and expired endpoints are removed together", async () => {
  const legacy = Array.from({ length: 10 }, (_, index) => subscription(index + 1));
  const client = createRedisMock({ "notifications:subscriptions": legacy });
  const store = createSubscriptionStore({
    client,
    clock: () => new Date("2026-09-21T17:30:00.000Z"),
    allowFallback: false
  });

  assert.equal((await store.getAllSubscriptions()).length, 10);
  assert.equal(client.strings.has("notifications:subscriptions"), true);

  const removed = await store.removeSubscriptions(legacy.slice(0, 4).map(sub => sub.endpoint));

  assert.equal(removed, 4);
  assert.equal(await store.getSubscriptionCount(), 6);
});

test("simultaneous subscription saves do not overwrite one another", async () => {
  const client = createRedisMock();
  const store = createSubscriptionStore({ client, allowFallback: false });

  await Promise.all(Array.from({ length: 10 }, (_, index) => store.saveSubscription(subscription(index + 1))));

  assert.equal(await store.getSubscriptionCount(), 10);
});

test("a new save copies legacy subscriptions before writing the new endpoint", async () => {
  const legacy = Array.from({ length: 10 }, (_, index) => subscription(index + 1));
  const client = createRedisMock({ "notifications:subscriptions": legacy });
  const store = createSubscriptionStore({ client, allowFallback: false });

  await store.saveSubscription(subscription(11));

  assert.equal(await store.getSubscriptionCount(), 11);
  assert.equal(client.strings.has("notifications:subscriptions"), true);
});

test("delivery batches four expired failures into one cleanup and records safe diagnostics", async () => {
  const subs = Array.from({ length: 10 }, (_, index) => subscription(index + 1));
  const cleanupCalls = [];
  const summaries = [];

  const result = await deliverPushNotifications(subs, { title: "Test" }, {
    sendNotification: async sub => {
      const number = Number(sub.endpoint.split("-").at(-1));
      if (number <= 4) throw Object.assign(new Error("gone"), { statusCode: 410 });
    },
    removeMany: async endpoints => {
      cleanupCalls.push(endpoints);
      return endpoints.length;
    },
    saveSummary: async summary => {
      summaries.push(summary);
    }
  });

  assert.deepEqual(result, {
    attempted: 10,
    sent: 6,
    failed: 4,
    expired: 4,
    expiredRemoved: 4,
    cleanupFailed: false,
    failureReasons: { expired: 4 },
    skipped: false
  });
  assert.equal(cleanupCalls.length, 1);
  assert.equal(cleanupCalls[0].length, 4);
  assert.equal(summaries.length, 1);
  assert.equal(JSON.stringify(summaries).includes("push.example.test"), false);
});

test("delivery diagnostics distinguish temporary and configuration failures", async () => {
  const statuses = [429, 503, 403, null];
  const subs = statuses.map((_, index) => subscription(index + 1));

  const result = await deliverPushNotifications(subs, { title: "Test" }, {
    sendNotification: async sub => {
      const index = Number(sub.endpoint.split("-").at(-1)) - 1;
      const error = new Error("delivery failed");
      if (statuses[index]) error.statusCode = statuses[index];
      throw error;
    },
    removeMany: async () => 0,
    saveSummary: async () => {}
  });

  assert.deepEqual(result.failureReasons, {
    "rate-limited": 1,
    "provider-error": 1,
    authorization: 1,
    "network-error": 1
  });
  assert.equal(result.expired, 0);
});

test("hosted storage errors fail closed instead of reporting a durable subscription", async () => {
  const client = createRedisMock();
  client.hget = async () => {
    throw new Error("storage offline");
  };
  const store = createSubscriptionStore({ client, allowFallback: false });

  await assert.rejects(store.saveSubscription(subscription(1)), /storage offline/);
});
