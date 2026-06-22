import { kv } from "@vercel/kv";
import { requireAdminSession } from "../../adminAuth.js";

const LATEST_KEY = "i26:news:latest";
const HISTORY_KEY = "i26:news:history";
const HISTORY_LIMIT = 30;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const entry = normalizeEntry(req.body);
    if (!entry.title || !entry.text) {
      return res.status(400).json({ error: "Title and update text are required" });
    }

    const history = await saveHistory(entry);
    if (await shouldUpdateLatest(entry, Boolean(req.body.timestamp))) {
      await kv.set(LATEST_KEY, entry);
    }

    return res.status(200).json({ ok: true, entry, items: history });
  } catch (error) {
    console.error("I-26 news write error:", error);
    return res.status(500).json({ error: "Failed to publish Connector update" });
  }
}

function normalizeEntry(input = {}) {
  const existingTimestamp = normalizeTimestamp(input.timestamp);
  const timestamp = existingTimestamp || Date.now();
  const mediaItems = normalizeMediaItems(input);
  const firstMedia = mediaItems[0] || {};

  return {
    id: input.id || `connector-news-${timestamp}`,
    title: clean(input.title),
    text: String(input.text || "").trim(),
    summary: clean(input.summary),
    label: clean(input.label || "Connector update"),
    sourceLabel: clean(input.sourceLabel || "Source"),
    sourceUrl: clean(input.sourceUrl),
    mediaUrl: clean(firstMedia.mediaUrl || input.mediaUrl || input.imageUrl || input.videoUrl),
    mediaType: clean(firstMedia.mediaType || input.mediaType),
    mediaItems,
    timestamp,
    editedAt: existingTimestamp ? Date.now() : null
  };
}

function normalizeMediaItems(input = {}) {
  const rawItems = Array.isArray(input.mediaItems) ? input.mediaItems : [];
  const normalized = rawItems
    .map((item) => ({
      mediaUrl: clean(item?.mediaUrl),
      mediaType: clean(item?.mediaType),
      label: clean(item?.label)
    }))
    .filter((item) => item.mediaUrl)
    .slice(0, 8);

  if (normalized.length) return normalized;

  const fallbackUrl = clean(input.mediaUrl || input.imageUrl || input.videoUrl);
  if (!fallbackUrl) return [];

  return [{
    mediaUrl: fallbackUrl,
    mediaType: clean(input.mediaType),
    label: ""
  }];
}

async function saveHistory(entry) {
  const existing = await kv.get(HISTORY_KEY);
  const history = Array.isArray(existing) ? existing : [];
  let updatedExisting = false;

  const next = history.filter(Boolean).map((item) => {
    if (item.timestamp === entry.timestamp) {
      updatedExisting = true;
      return entry;
    }
    return item;
  });

  if (!updatedExisting) next.unshift(entry);
  const trimmed = next.slice(0, HISTORY_LIMIT);
  await kv.set(HISTORY_KEY, trimmed);
  return trimmed;
}

async function shouldUpdateLatest(entry, editing) {
  if (!editing) return true;
  const latest = await kv.get(LATEST_KEY);
  return !latest || latest.timestamp === entry.timestamp;
}

function normalizeTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function clean(value) {
  return String(value ?? "").trim();
}
