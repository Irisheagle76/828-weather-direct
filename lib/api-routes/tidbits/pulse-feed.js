import { kv } from "@vercel/kv";

const HISTORY_KEY = "pulse:history";

function normalizeHistory(history, latest) {
  const items = Array.isArray(history) ? history.filter(Boolean) : [];
  // History contains edits; a legacy latest pointer can still hold the old copy.
  const withLatest = latest ? [...items, latest] : items;
  const seen = new Set();

  return withLatest.filter((item) => {
    const key = item.timestamp || `${item.mediaUrl || ""}:${item.text || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
}

export default async function handler(req, res) {
  res.setHeader?.("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [latest, history, headquarters, savedEventEndedAt] = await Promise.all([
      kv.get("pulse:latest"),
      kv.get(HISTORY_KEY),
      kv.get("pulse:headquarters"),
      kv.get("pulse:event-ended-at")
    ]);

    const items = normalizeHistory([...(Array.isArray(history) ? history : []), ...(headquarters ? [headquarters] : [])], latest);
    const regularItems = items.filter(item => !item.headquarters);
    const current = regularItems[0] || null;
    // Recover the cutoff for events ended before automatic switching existed.
    const eventEndedAt = Math.max(Number(savedEventEndedAt) || 0, ...items
      .filter(item => item.headquarters && item.headquartersActive === false)
      .map(item => Number(item.editedAt || item.timestamp) || 0)) || null;

    if (!current) {
      return res.status(200).json({
        title: "No Weather Pulse yet",
        text: "",
        mediaUrl: null,
        timestamp: null,
        fallback: true,
        recent: [],
        items,
        headquartersPost: headquarters || null,
        eventEndedAt
      });
    }

    return res.status(200).json({
      ...current,
      headquartersPost: headquarters || null,
      eventEndedAt,
      fallback: false,
      recent: regularItems.slice(1, 5),
      items
    });
  } catch (err) {
    console.error("Pulse feed error:", err);

    return res.status(200).json({
      title: "Error loading Weather Pulse",
      text: "",
      mediaUrl: null,
      mediaType: null,
      timestamp: null,
      fallback: true,
      recent: [],
      items: []
    });
  }
}
