import { kv } from "@vercel/kv";
import { requireAdminSession } from "../../adminAuth.js";
import { ashevilleDate } from "../../forecast/bottom-line-date.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdminSession(req, res)) return;
  const { date, text } = req.body || {};
  if (date !== ashevilleDate()) return res.status(409).json({ error: "The Asheville date changed. Reload the editor." });
  if (typeof text !== "string" || text.trim().length > 300) return res.status(400).json({ error: "Enter up to 300 characters." });
  try {
    await kv.set("forecast:bottom-line:" + date, { text: text.trim() }, { ex: 172800 });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Could not save Bottom Line." });
  }
}
