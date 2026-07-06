import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdminSession } from "../../adminAuth.js";
import { sendPushToAll } from "../../notifications/sendPush.js";

const ALERTS_KEY = "alerts:active";
const HISTORY_KEY = "alerts:history";
const HISTORY_LIMIT = 50;
const FALLBACK_PATH = path.join(process.cwd(), "public", "alerts.json");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const alert = normalizeAlert(req.body);

    if (!alert.title || !alert.message) {
      return res.status(400).json({ error: "Alert title and message are required" });
    }

    const activeAlerts = await saveAlert(alert);
    let pushResult = null;

    if (req.body.sendPush) {
      pushResult = await sendPushToAll({
        title: alert.pushTitle || alert.title,
        body: alert.pushBody || alert.message,
        url: alert.url || "/",
        image: alert.imageUrl || undefined,
        tag: `828-alert-${alert.type}`,
        renotify: alert.severity === "urgent",
        alertId: alert.id
      });
    }

    return res.status(200).json({
      ok: true,
      alert,
      activeAlerts,
      pushed: Boolean(req.body.sendPush),
      pushResult
    });
  } catch (err) {
    console.error("Alert publish error:", err);
    return res.status(500).json({ error: "Failed to publish alert" });
  }
}

function normalizeAlert(input = {}) {
  const now = new Date();
  const expiresAt = input.expiresAt
    ? new Date(input.expiresAt)
    : new Date(now.getTime() + 6 * 60 * 60 * 1000);

  return {
    id: input.id || `alert-${now.getTime()}`,
    type: clean(input.type || "weather-alert"),
    severity: clean(input.severity || "heads-up"),
    area: clean(input.area || "828 area"),
    timing: clean(input.timing || "Now"),
    title: clean(input.title || ""),
    message: clean(input.message || ""),
    action: clean(input.action || ""),
    imageUrl: normalizeImageUrl(input.imageUrl),
    url: clean(input.url || "/"),
    pushTitle: clean(input.pushTitle || ""),
    pushBody: clean(input.pushBody || ""),
    publishedAt: now.toISOString(),
    expiresAt: Number.isNaN(expiresAt.getTime())
      ? new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString()
      : expiresAt.toISOString()
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeImageUrl(value) {
  const imageUrl = clean(value);
  if (!imageUrl) return "";

  try {
    const parsed = new URL(imageUrl, "https://avlweather.com");
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

async function saveAlert(alert) {
  const current = await loadActiveAlerts();
  const next = [
    alert,
    ...current.filter(item => item?.id !== alert.id && !isExpired(item))
  ].slice(0, 5);

  try {
    await kv.set(ALERTS_KEY, next);
    const history = await kv.get(HISTORY_KEY);
    const nextHistory = [alert, ...(Array.isArray(history) ? history : [])].slice(0, HISTORY_LIMIT);
    await kv.set(HISTORY_KEY, nextHistory);
    return next;
  } catch (err) {
    console.warn("KV alert save unavailable, using local fallback:", err);
  }

  await fs.writeFile(FALLBACK_PATH, `${JSON.stringify({ alerts: next }, null, 2)}\n`, "utf8");
  return next;
}

async function loadActiveAlerts() {
  try {
    const alerts = await kv.get(ALERTS_KEY);
    if (Array.isArray(alerts)) return alerts.filter(item => !isExpired(item));
  } catch {
    // local fallback below
  }

  try {
    const raw = await fs.readFile(FALLBACK_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.alerts)
      ? parsed.alerts.filter(item => !isExpired(item))
      : [];
  } catch {
    return [];
  }
}

function isExpired(alert) {
  if (!alert?.expiresAt) return false;
  return new Date(alert.expiresAt).getTime() <= Date.now();
}
