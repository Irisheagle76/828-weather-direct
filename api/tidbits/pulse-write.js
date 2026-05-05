import { kv } from "@vercel/kv";

console.log("Pulse-write route loaded at", Date.now());

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    return res.status(200).json({ success: true, pulse });

  } catch (err) {
    console.error("Pulse write error:", err);
    return res.status(500).json({ error: "Failed to save pulse update" });
  }
}
