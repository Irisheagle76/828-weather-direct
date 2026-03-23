import webpush from "web-push";
import { getAllSubscriptions } from "./store";

webpush.setVapidDetails(
  "mailto:you@example.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function sendPushToAll(payload) {
  const subs = getAllSubscriptions();

  await Promise.all(
    subs.map(sub =>
      webpush.sendNotification(sub, JSON.stringify(payload)).catch(() => {})
    )
  );
}