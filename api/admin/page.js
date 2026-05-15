import fs from "node:fs/promises";
import path from "node:path";
import { getLoginRedirect, hasAdminSession } from "../../lib/adminAuth.js";

const ADMIN_ROOT = path.join(process.cwd(), "public", "admin");
const PUBLIC_ADMIN_FILES = new Set(["login.html"]);
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const filePath = normalizeAdminPath(req.query?.path);
  if (!filePath) {
    return res.status(404).send("Not found");
  }

  if (!PUBLIC_ADMIN_FILES.has(filePath) && !hasAdminSession(req)) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", getLoginRedirect(req, `/admin/${filePath}`));
    return res.status(302).end();
  }

  const absolutePath = path.join(ADMIN_ROOT, filePath);

  try {
    const content = await fs.readFile(absolutePath);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", getContentType(absolutePath));
    return req.method === "HEAD" ? res.status(200).end() : res.status(200).send(content);
  } catch {
    return res.status(404).send("Not found");
  }
}

function normalizeAdminPath(value) {
  const raw = Array.isArray(value) ? value.join("/") : String(value || "index.html");
  const withoutQuery = raw.split("?")[0].replace(/^\/+/, "");
  const withIndex = !withoutQuery || withoutQuery.endsWith("/")
    ? `${withoutQuery}index.html`
    : withoutQuery;
  const normalized = path.posix.normalize(withIndex);

  if (normalized.startsWith("../") || normalized === ".." || path.isAbsolute(normalized)) {
    return null;
  }

  return normalized;
}

function getContentType(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}
