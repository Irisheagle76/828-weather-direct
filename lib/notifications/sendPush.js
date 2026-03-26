import webpush from "web-push";
import { getAllSubscriptions, saveSubscription } from "./store.js";

let vapidReady = false;

console.log("sendPush.js LOADED");

try {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;

  if (pub && priv && pub.length > 20 && priv.length > 20) {
    webpush.setVapidDetails("mailto:you@example.com", pub, priv);
    vapidReady = true;
  } else {
    console.warn("⚠️ VAPID keys missing or invalid — push notifications disabled.");
  }
} catch (err) {
  console.error("VAPID initialization error:", err);
}

export async function sendPushToAll(payload) {
  if (!vapidReady) {
    console.warn("⚠️ Push skipped — VAPID not initialized.");
    return;
  }

  const subs = getAllSubscriptions();

  if (!subs.length) {
    console.log("No push subscribers — skipping push send.");
    return;
  }

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, JSON.stringify(payload));
      } catch (err) {
        // Handle expired or invalid subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.warn("Removing expired subscription:", sub.endpoint);
          // Optional: remove from store (if you add a remove function)
        } else {
          console.error("Push send error:", err);
        }
      }
    })
  );
}