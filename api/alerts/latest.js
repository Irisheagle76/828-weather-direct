import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";

const ALERTS_KEY = "alerts:active";
const FALLBACK_PATH = path.join(process.cwd(), "public", "alerts.json");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const alerts = await loadAlerts();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ alerts });
  } catch (err) {
    console.error("Alert latest error:", err);
    return res.status(500).json({ error: "Failed to load alerts" });
  }
}

async function loadAlerts() {
  try {
    const alerts = await kv.get(ALERTS_KEY);
    if (Array.isArray(alerts)) return alerts.filter(alert => !isExpired(alert));
  } catch (err) {
    console.warn("KV alert load unavailable, trying local fallback:", err);
  }

  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.alerts)
      ? parsed.alerts.filter(alert => !isExpired(alert))
      : [];
  } catch {
    return [];
  }
}

function isExpired(alert) {
  if (!alert?.expiresAt) return false;
  return new Date(alert.expiresAt).getTime() <= Date.now();
}
