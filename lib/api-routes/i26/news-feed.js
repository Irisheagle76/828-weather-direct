import { kv } from "@vercel/kv";

const LATEST_KEY = "i26:news:latest";
const HISTORY_KEY = "i26:news:history";

function normalizeHistory(history, latest) {
  const items = Array.isArray(history) ? history.filter(Boolean) : [];
  const withLatest = latest ? [latest, ...items] : items;
  const seen = new Set();

  return withLatest.filter((item) => {
    const key = `${item.timestamp || ""}:${item.title || ""}:${item.text || ""}`;
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
      kv.get(LATEST_KEY),
      kv.get(HISTORY_KEY)
    ]);

    const items = normalizeHistory(history, latest);
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      latest: items[0] || null,
      items,
      fallback: items.length === 0
    });
  } catch (error) {
    console.error("I-26 news feed error:", error);
    return res.status(200).json({ latest: null, items: [], fallback: true });
  }
}
