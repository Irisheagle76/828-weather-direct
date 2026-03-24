import webpush from "web-push";
import { getAllSubscriptions } from "./store.js";

let vapidReady = false;

console.log("sendPush.js LOADED");
try {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;

  if (pub && priv) {
    webpush.setVapidDetails("mailto:you@example.com", pub, priv);
    vapidReady = true;
  } else {
    console.warn("⚠️ VAPID keys missing — push notifications disabled.");
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

  await Promise.all(
    subs.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(() => {})
    )
  );
}
