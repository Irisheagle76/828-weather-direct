import webpush from "web-push";
import {
  getAllSubscriptions,
  removeSubscriptions,
  saveLastDelivery
} from "./store.js";

let vapidReady = false;

try {
  const pub = cleanKey(process.env.VAPID_PUBLIC_KEY);
  const priv = cleanKey(process.env.VAPID_PRIVATE_KEY);

  if (pub && priv && pub.length > 20 && priv.length > 20) {
    webpush.setVapidDetails("mailto:tballisty@gmail.com", pub, priv);
    vapidReady = true;
  } else {
    console.warn("VAPID keys missing or invalid. Push notifications disabled.");
  }
} catch (err) {
  console.error("VAPID initialization error:", err);
}

export function getPushConfigStatus() {
  const publicKey = cleanKey(process.env.VAPID_PUBLIC_KEY);
  const privateKey = cleanKey(process.env.VAPID_PRIVATE_KEY);

  return {
    vapidReady,
    hasPublicKey: Boolean(publicKey),
    hasPrivateKey: Boolean(privateKey),
    publicKeyLength: publicKey.length,
    privateKeyLength: privateKey.length,
    publicKeyHasWhitespace: hasOuterWhitespace(process.env.VAPID_PUBLIC_KEY),
    privateKeyHasWhitespace: hasOuterWhitespace(process.env.VAPID_PRIVATE_KEY)
  };
}

export async function sendPushToAll(payload) {
  if (!vapidReady) {
    console.warn("Push skipped. VAPID not initialized.");
    return { sent: 0, failed: 0, attempted: 0, skipped: true, reason: "vapid-not-ready" };
  }

  let subs;
  try {
    subs = await getAllSubscriptions();
  } catch (err) {
    console.error("Push skipped. Subscription storage is unavailable:", safeErrorMessage(err));
    return { sent: 0, failed: 0, attempted: 0, skipped: true, reason: "subscription-store-unavailable" };
  }

  if (!subs.length) {
    console.log("No push subscribers. Skipping push send.");
    return { sent: 0, failed: 0, attempted: 0, skipped: false };
  }

  return deliverPushNotifications(subs, payload);
}

export async function deliverPushNotifications(subs, payload, {
  sendNotification = (sub, body) => webpush.sendNotification(sub, body),
  removeMany = removeSubscriptions,
  saveSummary = saveLastDelivery
} = {}) {
  const body = JSON.stringify(payload);

  const results = await Promise.all(
    subs.map(async (sub) => {
      try {
        await sendNotification(sub, body);
        return { ok: true };
      } catch (err) {
        const statusCode = normalizeStatusCode(err?.statusCode);
        const category = classifyPushFailure(statusCode);
        console.warn(`Push delivery failed (${category}${statusCode ? `, HTTP ${statusCode}` : ""}).`);
        return {
          ok: false,
          endpoint: sub?.endpoint || "",
          expired: statusCode === 404 || statusCode === 410,
          category
        };
      }
    })
  );

  const sent = results.filter(result => result.ok).length;
  const failures = results.filter(result => !result.ok);
  const expiredEndpoints = failures.filter(result => result.expired).map(result => result.endpoint);
  const failureReasons = failures.reduce((counts, result) => {
    counts[result.category] = (counts[result.category] || 0) + 1;
    return counts;
  }, {});

  let expiredRemoved = 0;
  let cleanupFailed = false;
  if (expiredEndpoints.length) {
    try {
      expiredRemoved = await removeMany(expiredEndpoints);
    } catch (err) {
      cleanupFailed = true;
      console.error("Expired push subscription cleanup failed:", safeErrorMessage(err));
    }
  }

  const summary = {
    attempted: subs.length,
    sent,
    failed: failures.length,
    expired: expiredEndpoints.length,
    expiredRemoved,
    cleanupFailed,
    failureReasons
  };

  try {
    await saveSummary(summary);
  } catch (err) {
    console.error("Push delivery diagnostics could not be saved:", safeErrorMessage(err));
  }

  return { ...summary, skipped: false };
}

function cleanKey(value) {
  return String(value || "").trim();
}

function hasOuterWhitespace(value) {
  if (value == null) return false;
  return String(value) !== String(value).trim();
}

function normalizeStatusCode(value) {
  const statusCode = Number(value);
  return Number.isInteger(statusCode) ? statusCode : null;
}

function classifyPushFailure(statusCode) {
  if (statusCode === 404 || statusCode === 410) return "expired";
  if (statusCode === 401 || statusCode === 403) return "authorization";
  if (statusCode === 429) return "rate-limited";
  if (statusCode && statusCode >= 500) return "provider-error";
  if (statusCode && statusCode >= 400) return "rejected";
  return "network-error";
}

function safeErrorMessage(err) {
  return err instanceof Error ? err.message : String(err || "Unknown push error");
}
