import { kv } from "@vercel/kv";

const HISTORY_KEY = "pulse:history";

function normalizeHistory(history, latest) {
  const items = Array.isArray(history) ? history.filter(Boolean) : [];
  const withLatest = latest ? [latest, ...items] : items;
  const seen = new Set();

  return withLatest.filter((item) => {
    const key = `${item.timestamp || ""}:${item.mediaUrl || ""}:${item.text || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const [latest, history] = await Promise.all([
      kv.get("pulse:latest"),
      kv.get(HISTORY_KEY)
    ]);

    const items = normalizeHistory(history, latest);
    const current = items[0] || null;

    if (!current) {
      return res.status(200).json({
        title: "No Weather Pulse yet",
        text: "",
        mediaUrl: null,
        timestamp: null,
        fallback: true,
        recent: [],
        items: []
      });
    }

    return res.status(200).json({
      ...current,
      fallback: false,
      recent: items.slice(1, 5),
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
