// /api/notifications/subscribe.js

import { saveSubscription } from "../../lib/notifications/store.js?v=1.0.0";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const subscription = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    await saveSubscription(subscription);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error saving subscription:", err);
    return res.status(500).json({ error: "Failed to save subscription" });
  }
}