import { buildAdminCookie } from "../../adminAuth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (!expectedPassword || !sessionSecret) {
    return res.status(500).json({
      error: "Admin auth is not configured. Set ADMIN_PASSWORD and ADMIN_SESSION_SECRET."
    });
  }

  const password = String(req.body?.password || "");

  if (password !== expectedPassword) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  res.setHeader("Set-Cookie", buildAdminCookie(sessionSecret, {
    maxAge: 60 * 60 * 24 * 14
  }));

  return res.status(200).json({ ok: true });
}
