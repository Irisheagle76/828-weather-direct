import { hasAdminSession } from "../../adminAuth.js";
import { runAutomaticForecast, getAutomaticStatus } from "../../forecast/service.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const cron = Boolean(process.env.CRON_SECRET) && req.headers?.authorization === `Bearer ${process.env.CRON_SECRET}`;
  if (req.method === "GET") {
    if (cron) return res.status(200).json(await runAutomaticForecast());
    if (!hasAdminSession(req)) return res.status(401).json({ error:"Unauthorized" });
    return res.status(200).json(await getAutomaticStatus());
  }
  if (req.method !== "POST") return res.status(405).json({ error:"Method not allowed" });
  if (!cron && !hasAdminSession(req)) return res.status(401).json({ error:"Unauthorized" });
  const dryRun = req.body?.dryRun === true || req.query?.dryRun === "true";
  const force = !cron && hasAdminSession(req) && req.body?.force === true;
  return res.status(200).json(await runAutomaticForecast({ dryRun, force }));
}
