import { createHash } from "node:crypto";
import { kv } from "@vercel/kv";

const LEGACY_SUBSCRIPTIONS_KEY = "notifications:subscriptions";
const SUBSCRIPTIONS_HASH_KEY = "notifications:subscriptions:v2";
const MIGRATION_COMPLETE_KEY = "notifications:subscriptions:v2:migrated";
const LAST_DELIVERY_KEY = "notifications:last-delivery";

export function createSubscriptionStore({
  client = kv,
  clock = () => new Date(),
  allowFallback = !isHostedRuntime()
} = {}) {
  const fallbackSubs = new Map();
  let fallbackLastDelivery = null;
  let migrationReady = false;

  async function saveSubscription(sub) {
    if (!isValidSubscription(sub)) {
      throw new TypeError("Invalid push subscription");
    }

    const id = subscriptionId(sub.endpoint);
    const now = clock().toISOString();

    try {
      await ensureLegacyMigration();
      const existing = normalizeSubscription(await client.hget(SUBSCRIPTIONS_HASH_KEY, id));
      const record = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        },
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await client.hset(SUBSCRIPTIONS_HASH_KEY, { [id]: record });
      fallbackSubs.set(id, record);
      return record;
    } catch (err) {
      if (!allowFallback) throw err;
      console.warn("KV subscription save unavailable, using local fallback:", safeErrorMessage(err));
      const existing = fallbackSubs.get(id);
      const record = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
      fallbackSubs.set(id, record);
      return record;
    }
  }

  async function getAllSubscriptions() {
    try {
      await ensureLegacyMigration();
      const stored = await client.hgetall(SUBSCRIPTIONS_HASH_KEY);
      const records = normalizeHashSubscriptions(stored);
      replaceFallback(records);
      return records;
    } catch (err) {
      if (!allowFallback) throw err;
      console.warn("KV subscription load unavailable, using local fallback:", safeErrorMessage(err));
      return [...fallbackSubs.values()];
    }
  }

  async function getSubscriptionCount() {
    const subs = await getAllSubscriptions();
    return subs.length;
  }

  async function removeSubscriptions(endpoints = []) {
    const ids = [...new Set(endpoints.filter(Boolean).map(subscriptionId))];
    if (!ids.length) return 0;

    try {
      await ensureLegacyMigration();
      const removed = await client.hdel(SUBSCRIPTIONS_HASH_KEY, ...ids);
      ids.forEach(id => fallbackSubs.delete(id));
      return Number(removed) || 0;
    } catch (err) {
      if (!allowFallback) throw err;
      console.warn("KV subscription removal unavailable, using local fallback:", safeErrorMessage(err));
      let removed = 0;
      ids.forEach(id => {
        if (fallbackSubs.delete(id)) removed += 1;
      });
      return removed;
    }
  }

  async function saveLastDelivery(summary) {
    const record = { ...summary, recordedAt: clock().toISOString() };
    try {
      await client.set(LAST_DELIVERY_KEY, record);
      fallbackLastDelivery = record;
      return record;
    } catch (err) {
      if (!allowFallback) throw err;
      console.warn("KV delivery diagnostics unavailable, using local fallback:", safeErrorMessage(err));
      fallbackLastDelivery = record;
      return record;
    }
  }

  async function getLastDelivery() {
    try {
      const record = await client.get(LAST_DELIVERY_KEY);
      if (record && typeof record === "object") {
        fallbackLastDelivery = record;
        return record;
      }
      return null;
    } catch (err) {
      if (!allowFallback) throw err;
      console.warn("KV delivery diagnostics load unavailable, using local fallback:", safeErrorMessage(err));
      return fallbackLastDelivery;
    }
  }

  async function ensureLegacyMigration() {
    if (migrationReady) return;
    if (await client.get(MIGRATION_COMPLETE_KEY)) {
      migrationReady = true;
      return;
    }

    const legacy = await client.get(LEGACY_SUBSCRIPTIONS_KEY);
    if (Array.isArray(legacy) && legacy.length) {
      const now = clock().toISOString();
      const migrated = legacy
        .filter(isValidSubscription)
        .map(sub => ({
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime ?? null,
          keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
          createdAt: sub.createdAt || now,
          updatedAt: sub.updatedAt || now
        }));

      if (migrated.length) {
        await client.hset(SUBSCRIPTIONS_HASH_KEY, Object.fromEntries(
          migrated.map(sub => [subscriptionId(sub.endpoint), sub])
        ));
      }
    }

    await client.set(MIGRATION_COMPLETE_KEY, true);
    migrationReady = true;
  }

  function replaceFallback(records) {
    fallbackSubs.clear();
    records.forEach(record => fallbackSubs.set(subscriptionId(record.endpoint), record));
  }

  return {
    saveSubscription,
    getAllSubscriptions,
    getSubscriptionCount,
    removeSubscriptions,
    saveLastDelivery,
    getLastDelivery
  };
}

const store = createSubscriptionStore();

export const saveSubscription = store.saveSubscription;
export const getAllSubscriptions = store.getAllSubscriptions;
export const getSubscriptionCount = store.getSubscriptionCount;
export const removeSubscriptions = store.removeSubscriptions;
export const saveLastDelivery = store.saveLastDelivery;
export const getLastDelivery = store.getLastDelivery;

function subscriptionId(endpoint) {
  return createHash("sha256").update(endpoint).digest("hex");
}

function isValidSubscription(sub) {
  return Boolean(sub?.endpoint && sub?.keys?.p256dh && sub?.keys?.auth);
}

function normalizeHashSubscriptions(stored) {
  if (!stored || typeof stored !== "object") return [];
  return Object.values(stored)
    .map(normalizeSubscription)
    .filter(isValidSubscription);
}

function normalizeSubscription(value) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function safeErrorMessage(err) {
  return err instanceof Error ? err.message : String(err || "Unknown storage error");
}

function isHostedRuntime() {
  return Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";
}
