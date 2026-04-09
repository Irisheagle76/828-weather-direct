import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    const pulse = await kv.get("pulse:latest");
console.log("KV PULSE:", pulse);

    if (!pulse) {
      return res.status(200).json({
        title: "No Weather Pulse yet",
        text: "",
        imageUrl: null,
        timestamp: null,
        fallback: true,
      });
    }

    return res.status(200).json({
      ...pulse,
      fallback: false,
    });
  } catch (err) {
    console.error("Pulse latest error:", err);

    return res.status(200).json({
      title: "Error loading Weather Pulse",
      text: "",
      mediaUrl: null,
mediaType: null,
      timestamp: null,
      fallback: true,
    });
  }
}
