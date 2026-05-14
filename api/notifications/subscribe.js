import { saveSubscription } from "../../lib/notifications/store.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sub = req.body;

    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: "Invalid push subscription" });
    }

    await saveSubscription(sub);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Subscribe error:", err);
    return res.status(500).json({ error: "Failed to save subscription" });
  }
}
