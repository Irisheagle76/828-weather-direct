import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import comparison from "../../lib/api-routes/tempest/temperature-comparison.js";
import feelscoreMap from "../../lib/api-routes/mobile/feelscore-map.js";
import { startChamberSnapshots, getChamberSnapshot, getChamberStatus } from "./chamber-snapshot.mjs";
import { createUpstreamCache } from "./upstream-cache.mjs";
const published = createUpstreamCache();
async function servePublished(url, res) {
  const response = await published(url);
  res.writeHead(response.status, { "Content-Type": response.type, "Cache-Control": "no-store", "X-Mobile-Preview-Cache": response.cache });
  res.end(response.body);
}

const root = fileURLToPath(new URL("../../public/", import.meta.url));
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
startChamberSnapshots();
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1:4174");
    if (url.pathname === "/mobile-preview/chamber-status.json") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      return res.end(JSON.stringify(getChamberStatus()));
    }
    if (url.pathname === "/mobile-preview/chamber.jpg") {
      const snapshot = getChamberSnapshot();
      if (!snapshot) { res.writeHead(503, { "Cache-Control": "no-store" }); return res.end("Camera snapshot unavailable"); }
      res.writeHead(200, { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=60", "Last-Modified": new Date(snapshot.capturedAt).toUTCString() });
      return res.end(snapshot.image);
    }
    // Local previews consume the same published hiking snapshot as production.
    if (url.pathname === "/data/hiking-guidance.json") {
      return await servePublished(url, res);
    }
    if (url.pathname === "/api/router") {
      if (["tempest/temperature-comparison", "mobile/feelscore-map"].includes(url.searchParams.get("route"))) {
        req.query = Object.fromEntries(url.searchParams);
        res.status = code => { res.statusCode = code; return res; };
        res.json = data => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(data)); };
        return await (url.searchParams.get("route") === "mobile/feelscore-map" ? feelscoreMap : comparison)(req, res);
      }
      return await servePublished(url, res);
    }
    let requested = decodeURIComponent(url.pathname);
    if (requested === "/") requested = "/mobile/";
    if (requested.endsWith("/")) requested += "index.html";
    const file = path.resolve(root, `.${requested}`);
    const relative = path.relative(root, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) { res.writeHead(403); return res.end("Forbidden"); }
    const body = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(body);
  } catch { res.writeHead(404); res.end("Unavailable"); }
}).listen(4174, "127.0.0.1", () => console.log("Mobile preview: http://127.0.0.1:4174/mobile/"));
