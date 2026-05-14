const ADMIN_COOKIE = "828_admin_session";

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

  res.setHeader("Set-Cookie", buildCookie(ADMIN_COOKIE, sessionSecret, {
    maxAge: 60 * 60 * 24 * 14
  }));

  return res.status(200).json({ ok: true });
}

function buildCookie(name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  if (options.maxAge) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}
