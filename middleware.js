const ADMIN_COOKIE = "828_admin_session";
const PROTECTED_API_PREFIXES = [
  "/api/alerts/publish",
  "/api/alerts/clear",
  "/api/forecast/publish",
  "/api/tidbits/pulse-write",
  "/api/tidbits/pulse-media"
];

export function middleware(req) {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname === "/admin/login.html" || pathname === "/api/admin/login") {
    return;
  }

  const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
  const isProtectedApi = PROTECTED_API_PREFIXES.some(prefix => pathname.startsWith(prefix));

  if (!isAdminPage && !isProtectedApi) {
    return;
  }

  if (hasAdminSession(req)) {
    return;
  }

  if (isProtectedApi) {
    return jsonResponse({ error: "Admin login required" }, 401);
  }

  const loginUrl = new URL("/admin/login.html", url.origin);
  loginUrl.searchParams.set("next", pathname + url.search);
  return Response.redirect(loginUrl, 302);
}

function hasAdminSession(req) {
  const expected = process.env.ADMIN_SESSION_SECRET;
  if (!expected) return false;

  const cookies = parseCookies(req.headers.get("cookie") || "");
  return cookies[ADMIN_COOKIE] === expected;
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

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
