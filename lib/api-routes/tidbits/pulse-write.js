import { kv } from "@vercel/kv";
import { requireAdminSession } from "../../adminAuth.js";

console.log("Pulse-write route loaded at", Date.now());

const HISTORY_KEY = "pulse:history";
const HISTORY_LIMIT = 30;

function normalizeTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function savePulseHistory(pulse) {
  const existing = await kv.get(HISTORY_KEY);
  const history = Array.isArray(existing) ? existing : [];
  let updatedExisting = false;

  const nextHistory = history
    .filter(Boolean)
    .map((item) => {
      if (item.timestamp === pulse.timestamp) {
        updatedExisting = true;
        return pulse;
      }
      return item;
    });

  if (!updatedExisting) {
    nextHistory.unshift(pulse);
  }

  await kv.set(HISTORY_KEY, nextHistory.slice(0, HISTORY_LIMIT));
}

async function shouldUpdateLatest(pulse, editing) {
  if (!editing) return true;
  const latest = await kv.get("pulse:latest");
  return !latest || latest.timestamp === pulse.timestamp;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const { title, text, imageUrl, videoUrl, mediaUrl, mediaType, timestamp } = req.body;

    if (!title || !text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Normalize media input
    const finalMediaUrl = mediaUrl || imageUrl || videoUrl || null;
    const existingTimestamp = normalizeTimestamp(timestamp);
    const editing = existingTimestamp != null;

    const pulse = {
      title,
      text,
      mediaUrl: finalMediaUrl,
      mediaType: mediaType || null,
      timestamp: existingTimestamp || Date.now(),
      editedAt: editing ? Date.now() : null,
    };

    if (await shouldUpdateLatest(pulse, editing)) {
      await kv.set("pulse:latest", pulse);
    }
    await savePulseHistory(pulse);

    return res.status(200).json({ success: true, pulse });

  } catch (err) {
    console.error("Pulse write error:", err);
    return res.status(500).json({ error: "Failed to save pulse update" });
  }
}
