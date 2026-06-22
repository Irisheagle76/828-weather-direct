import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";

const ALERTS_KEY = "i26:drivenc-email-alerts";
const FALLBACK_PATH = path.join(process.cwd(), "public", "data", "i26-email-alerts.json");
const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const stored = await loadStoredAlerts();
    const alerts = filterRecent(stored.alerts || []);

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({
      alerts,
      count: alerts.length,
      activeCount: alerts.filter((alert) => !alert.cleared).length,
      updatedAt: stored.updatedAt || null,
      source: "DriveNC notification emails"
    });
  } catch (error) {
    console.error("DriveNC email alert feed failed", error);
    return res.status(500).json({ error: "DriveNC email alerts are temporarily unavailable.", alerts: [] });
  }
}

async function loadStoredAlerts() {
  try {
    const stored = await kv.get(ALERTS_KEY);
    if (stored && Array.isArray(stored.alerts)) return stored;
  } catch (error) {
    console.warn("KV DriveNC alert load unavailable, trying local fallback:", error);
  }

  try {
    return JSON.parse(await fs.readFile(FALLBACK_PATH, "utf8"));
  } catch {
    return { alerts: [], updatedAt: null };
  }
}

function filterRecent(alerts) {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  return alerts
    .filter((alert) => {
      const received = new Date(alert.receivedAt || alert.updatedAt || 0).getTime();
      const end = new Date(alert.endTime || 0).getTime();
      return received >= cutoff || end >= Date.now();
    })
    .sort((a, b) => new Date(b.receivedAt || b.updatedAt || 0) - new Date(a.receivedAt || a.updatedAt || 0))
    .slice(0, 20);
}
