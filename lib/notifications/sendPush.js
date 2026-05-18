import webpush from "web-push";
import { getAllSubscriptions, removeSubscription } from "./store.js";

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
    return { sent: 0, failed: 0, skipped: true };
  }

  const subs = await getAllSubscriptions();

  if (!subs.length) {
    console.log("No push subscribers. Skipping push send.");
    return { sent: 0, failed: 0, skipped: false };
  }

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
        sent += 1;
      } catch (err) {
        failed += 1;
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.warn("Removing expired subscription:", sub.endpoint);
          await removeSubscription(sub.endpoint);
        } else {
          console.error("Push send error:", err);
        }
      }
    })
  );

  return { sent, failed, skipped: false };
}

function cleanKey(value) {
  return String(value || "").trim();
}

function hasOuterWhitespace(value) {
  if (value == null) return false;
  return String(value) !== String(value).trim();
}
