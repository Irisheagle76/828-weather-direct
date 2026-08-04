import { requireAdminSession } from "../../adminAuth.js";
import { getDrafts } from "../../nowcast/storage.js";
import { handleDraftAction, UserInputError } from "../../nowcast/service.js";

export default async function handler(req, res) {
  if (!requireAdminSession(req, res)) return;
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method === "GET") {
    const drafts = await getDrafts();
    return res.status(200).json({ drafts: drafts.sort((a, b) => b.generatedAt - a.generatedAt) });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const action = String(req.body?.action || "");
    const draft = await handleDraftAction(action, req.body || {});
    return res.status(200).json({ ok: true, draft });
  } catch (error) {
    if (error instanceof UserInputError) return res.status(error.status).json({ error: error.message });
    console.error(JSON.stringify({ event: "draft_action_failure", error: String(error?.message || error).slice(0, 300) }));
    return res.status(500).json({ error: "Draft action failed" });
  }
}
