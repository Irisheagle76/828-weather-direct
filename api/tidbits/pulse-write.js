import { kv } from "@vercel/kv";
import { sendPushToAll } from "../../lib/notifications/sendPush.js";

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

    // Save Pulse Tidbit to KV
    await kv.set("pulse:latest", pulse);

    // 🔔 Send push notification to all subscribers
    await sendPushToAll({
      title: "New Pulse Tidbit",
      body: title,
      url: "/#pulse"
    });

    return res.status(200).json({ success: true, pulse });
  } catch (err) {
    console.error("Pulse write error:", err);
    return res.status(500).json({ error: "Failed to save pulse update" });
  }
}