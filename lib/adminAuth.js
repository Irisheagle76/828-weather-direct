export const ADMIN_COOKIE = "828_admin_session";

export function hasAdminSession(req) {
  const expected = process.env.ADMIN_SESSION_SECRET;
  if (!expected) return false;

  const cookieHeader = getHeader(req, "cookie") || "";
  const cookies = parseCookies(cookieHeader);
  return cookies[ADMIN_COOKIE] === expected;
}

export function requireAdminSession(req, res) {
  if (hasAdminSession(req)) return true;

  res.status(401).json({ error: "Admin login required" });
  return false;
}

export function buildAdminCookie(value, options = {}) {
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax"
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  if (options.maxAge != null) {
    parts.push(`Max-Age=${options.maxAge}`);
  }

  return parts.join("; ");
}

export function clearAdminCookie() {
  return buildAdminCookie("", { maxAge: 0 });
}

export function getLoginRedirect(req, nextPath) {
  const origin = getRequestOrigin(req);
  const loginUrl = new URL("/admin/login.html", origin);
  loginUrl.searchParams.set("next", nextPath || "/admin/index.html");
  return loginUrl.toString();
}

function getRequestOrigin(req) {
  const protocol = getHeader(req, "x-forwarded-proto") || "https";
  const host = getHeader(req, "x-forwarded-host") || getHeader(req, "host") || "localhost";
  return `${protocol}://${host}`;
}

function getHeader(req, name) {
  if (typeof req?.headers?.get === "function") {
    return req.headers.get(name);
  }

  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()];
}

function parseCookies(cookieHeader) {
  return cookieHeader
    .split(";")
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const eq = part.indexOf("=");
      if (eq === -1) return cookies;
      const key = decodeURIComponent(part.slice(0, eq).trim());
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}
