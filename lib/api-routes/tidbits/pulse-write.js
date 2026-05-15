import { kv } from "@vercel/kv";
import { requireAdminSession } from "../../adminAuth.js";

console.log("Pulse-write route loaded at", Date.now());

const HISTORY_KEY = "pulse:history";
const HISTORY_LIMIT = 30;

async function savePulseHistory(pulse) {
  const existing = await kv.get(HISTORY_KEY);
  const history = Array.isArray(existing) ? existing : [];
  const nextHistory = [
    pulse,
    ...history.filter((item) => {
      if (!item) return false;
      if (item.timestamp === pulse.timestamp) return false;
      return item.text !== pulse.text || item.mediaUrl !== pulse.mediaUrl;
    })
  ].slice(0, HISTORY_LIMIT);

  await kv.set(HISTORY_KEY, nextHistory);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const { title, text, imageUrl, videoUrl, mediaUrl, mediaType } = req.body;

    if (!title || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Normalize media input
    const finalMediaUrl = mediaUrl || imageUrl || videoUrl || null;

    const pulse = {
      title,
      text,
      mediaUrl: finalMediaUrl,
      mediaType: mediaType || null,
      timestamp: Date.now(),
    };

    // Save Pulse FIRST
    await kv.set("pulse:latest", pulse);
    await savePulseHistory(pulse);

    return res.status(200).json({ success: true, pulse });

  } catch (err) {
    console.error("Pulse write error:", err);
    return res.status(500).json({ error: "Failed to save pulse update" });
  }
}
