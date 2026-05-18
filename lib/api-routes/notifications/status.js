import { requireAdminSession } from "../../adminAuth.js";
import { getSubscriptionCount } from "../../notifications/store.js";
import { getPushConfigStatus } from "../../notifications/sendPush.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const subscriberCount = await getSubscriptionCount();
    return res.status(200).json({
      ok: true,
      subscriberCount,
      pushConfig: getPushConfigStatus()
    });
  } catch (err) {
    console.error("Notification status error:", err);
    return res.status(500).json({ error: "Failed to load notification status" });
  }
}
