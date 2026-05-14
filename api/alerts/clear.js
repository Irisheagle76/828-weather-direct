import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";

const ALERTS_KEY = "alerts:active";
const FALLBACK_PATH = path.join(process.cwd(), "public", "alerts.json");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { id } = req.body || {};
    const current = await loadAlerts();
    const next = id ? current.filter(alert => alert?.id !== id) : [];

    try {
      await kv.set(ALERTS_KEY, next);
    } catch (err) {
      console.warn("KV alert clear unavailable, using local fallback:", err);
      await fs.writeFile(FALLBACK_PATH, `${JSON.stringify({ alerts: next }, null, 2)}\n`, "utf8");
    }

    return res.status(200).json({ ok: true, alerts: next });
  } catch (err) {
    console.error("Alert clear error:", err);
    return res.status(500).json({ error: "Failed to clear alert" });
  }
}

async function loadAlerts() {
  try {
    const alerts = await kv.get(ALERTS_KEY);
    if (Array.isArray(alerts)) return alerts;
  } catch {
    // local fallback below
  }

  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.alerts) ? parsed.alerts : [];
  } catch {
    return [];
  }
}
