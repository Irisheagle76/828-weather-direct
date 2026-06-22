import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
import { isDriveNcSender, parseDriveNcEmailAlert } from "../../i26/drivencEmailAlerts.js";

const ALERTS_KEY = "i26:drivenc-email-alerts";
const FALLBACK_PATH = path.join(process.cwd(), "public", "data", "i26-email-alerts.json");
const HISTORY_LIMIT = 75;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const input = req.body || {};
  const sender = input.originalFrom || input.from || input.sender || "";
  if (!isDriveNcSender(sender)) {
    return res.status(400).json({ error: "Message sender is not DriveNC." });
  }

  try {
    const alert = parseDriveNcEmailAlert(input);
    const stored = await saveAlert(alert);
    return res.status(200).json({ ok: true, alert, count: stored.alerts.length });
  } catch (error) {
    console.error("DriveNC email alert ingest failed", error);
    return res.status(500).json({ error: "Failed to ingest DriveNC email alert." });
  }
}

function isAuthorized(req) {
  const expected = process.env.DRIVENC_EMAIL_INGEST_SECRET;
  if (!expected) return false;

  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return bearer === expected || req.headers["x-ingest-secret"] === expected || req.body?.secret === expected;
}

async function saveAlert(alert) {
  const current = await loadStoredAlerts();
  const withoutDuplicate = (current.alerts || []).filter((item) => item.id !== alert.id);
  const nextAlerts = [alert, ...withoutDuplicate]
    .map((item) => markClearedState(item, alert))
    .slice(0, HISTORY_LIMIT);

  const payload = {
    alerts: nextAlerts,
    updatedAt: new Date().toISOString()
  };

  try {
    await kv.set(ALERTS_KEY, payload);
    return payload;
  } catch (error) {
    console.warn("KV DriveNC alert save unavailable, using local fallback:", error);
  }

  await fs.mkdir(path.dirname(FALLBACK_PATH), { recursive: true });
  await fs.writeFile(FALLBACK_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return payload;
}

async function loadStoredAlerts() {
  try {
    const stored = await kv.get(ALERTS_KEY);
    if (stored && Array.isArray(stored.alerts)) return stored;
  } catch {
    // local fallback below
  }

  try {
    return JSON.parse(await fs.readFile(FALLBACK_PATH, "utf8"));
  } catch {
    return { alerts: [], updatedAt: null };
  }
}

function markClearedState(item, latestAlert) {
  if (!latestAlert.cleared || !latestAlert.eventId || item.eventId !== latestAlert.eventId) return item;
  return {
    ...item,
    cleared: true,
    clearedAt: latestAlert.receivedAt,
    status: item.id === latestAlert.id ? item.status : "Cleared"
  };
}
