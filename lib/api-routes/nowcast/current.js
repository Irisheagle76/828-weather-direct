import { requireAdminSession } from "../../adminAuth.js";
import { getConsoleData } from "../../nowcast/service.js";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });
  if (!requireAdminSession(req, res)) return;
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const data = await getConsoleData({
      scenario: String(req.query?.scenario || "quiet"),
      force: req.query?.force === "1",
      sessionHistory: req.method === "POST" ? req.body?.sessionHistory : [],
      manualSession: req.method === "POST" && req.body?.manualSession === true
    });
    return res.status(200).json(data);
  } catch (error) {
    console.error(JSON.stringify({ event: "nowcast_console_failure", error: String(error?.message || error).slice(0, 300) }));
    return res.status(500).json({ error: "The Phase 1 console could not refresh" });
  }
}
