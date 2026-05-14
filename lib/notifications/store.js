import { kv } from "@vercel/kv";

const SUBSCRIPTIONS_KEY = "notifications:subscriptions";
let fallbackSubs = [];

export async function saveSubscription(sub) {
  if (!sub?.endpoint) return;

  const subs = await getAllSubscriptions();
  const next = [
    sub,
    ...subs.filter(item => item?.endpoint && item.endpoint !== sub.endpoint)
  ];

  try {
    await kv.set(SUBSCRIPTIONS_KEY, next);
    fallbackSubs = next;
    return;
  } catch (err) {
    console.warn("KV subscription save unavailable, using in-memory fallback:", err);
  }

  fallbackSubs = next;
}

export async function getAllSubscriptions() {
  try {
    const subs = await kv.get(SUBSCRIPTIONS_KEY);
    if (Array.isArray(subs)) {
      fallbackSubs = subs;
      return subs;
    }
  } catch (err) {
    console.warn("KV subscription load unavailable, using in-memory fallback:", err);
  }

  return fallbackSubs;
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return;

  const subs = await getAllSubscriptions();
  const next = subs.filter(sub => sub?.endpoint !== endpoint);

  try {
    await kv.set(SUBSCRIPTIONS_KEY, next);
    fallbackSubs = next;
    return;
  } catch (err) {
    console.warn("KV subscription remove unavailable, using in-memory fallback:", err);
  }

  fallbackSubs = next;
}
