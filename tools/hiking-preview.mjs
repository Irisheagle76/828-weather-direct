import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute, extname } from "node:path";
import { analyzeHikingStations } from "../lib/hiking/guidance.js";

const root = resolve("public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml" };
let snapshot;
let snapshotAt = 0;
async function hikingData() {
  if (!snapshot || Date.now() - snapshotAt > 60 * 1000) {
    snapshotAt = Date.now();
    snapshot = (async () => {
      try {
        const response = await fetch("https://avlweather.com/api/router?route=hiking/current", { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`Upstream ${response.status}`);
        return await response.json();
      } catch {
        return JSON.parse(await readFile(resolve(root, "data/hiking-guidance.json"), "utf8"));
      }
    })();
  }
  const data = await snapshot;
  return { ...data, guidance: analyzeHikingStations(data.stations, { now: Date.parse(data.generatedAt) }) };
}
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:4212");
  try {
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/data/hiking-guidance.json" || (url.pathname === "/api/router" && url.searchParams.get("route") === "hiking/current")) {
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify(await hikingData()));
    }
    const file = resolve(root, `.${decodeURIComponent(url.pathname === "/" ? "/hiking.html" : url.pathname)}`);
    const rel = relative(root, file);
    if (rel.startsWith("..") || isAbsolute(rel)) { res.writeHead(403); return res.end(); }
    res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end("Unavailable"); }
}).listen(4212, "127.0.0.1", () => console.log("Hiking preview: http://127.0.0.1:4212/hiking.html"));
