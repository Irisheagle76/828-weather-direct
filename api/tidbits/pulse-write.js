import { kv } from "@vercel/kv";
import { sendPushToAll } from "../../lib/notifications/sendPush.js?v=1.0.0";
console.log("Pulse-write route loaded at", Date.now());
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { title, text, imageUrl } = req.body;

    if (!title || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const pulse = {
      title,
      text,
      imageUrl: imageUrl || null,
      timestamp: Date.now(),
    };

    // ------------------------------------------------------------
    // 1) Save Pulse FIRST — this should never fail due to push
    // ------------------------------------------------------------
    await kv.set("pulse:latest", pulse);

    // ------------------------------------------------------------
    // 2) Fire push notifications SECOND — but never block publishing
    // ------------------------------------------------------------
    sendPushToAll({
      title: "New Pulse Tidbit",
      body: title,
      url: "/#pulse"
    }).catch(err => {
      console.error("Push notification error (non-blocking):", err);
    });

    return res.status(200).json({ success: true, pulse });

  } catch (err) {
    console.error("Pulse write error:", err);
    return res.status(500).json({ error: "Failed to save pulse update" });
  }
}