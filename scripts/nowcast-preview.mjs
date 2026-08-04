import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import router from "../api/router.js";

const host = "127.0.0.1";
const port = Number(process.env.NOWCAST_PREVIEW_PORT || 4173);
const publicRoot = path.join(process.cwd(), "public");
const previewSession = "local-nowcast-preview";

process.env.NOWCAST_MOCK_MODE = "true";
process.env.NOWCAST_PREVIEW_MODE = "true";
process.env.ADMIN_SESSION_SECRET = previewSession;
process.env.NODE_ENV = process.env.NODE_ENV || "development";

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8"
};

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  if (url.pathname === "/") {
    response.writeHead(302, { Location: "/admin/nowcast/index.html" });
    return response.end();
  }

  if (url.pathname === "/api/router") {
    return handleApi(request, response, url);
  }

  const relative = url.pathname.replace(/^\/+/, "");
  const resolved = path.resolve(publicRoot, relative);
  if (!resolved.startsWith(path.resolve(publicRoot) + path.sep)) {
    response.writeHead(404);
    return response.end("Not found");
  }
  try {
    const body = await fs.readFile(resolved);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(resolved)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    return request.method === "HEAD" ? response.end() : response.end(body);
  } catch {
    response.writeHead(404);
    return response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`828 Nowcast Console preview: http://${host}:${port}/admin/nowcast/index.html`);
  console.log("Mock data mode is ON. This local preview cannot publish.");
});

async function handleApi(request, response, url) {
  const body = await readJsonBody(request);
  const query = Object.fromEntries(url.searchParams.entries());
  const req = {
    method: request.method,
    query,
    body,
    headers: { ...request.headers, cookie: `828_admin_session=${previewSession}` }
  };
  const res = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; },
    json(value) { sendJson(response, this.statusCode, this.headers, value); return this; },
    send(value) { sendBody(response, this.statusCode, this.headers, value); return this; },
    end() { response.writeHead(this.statusCode, this.headers); response.end(); return this; }
  };
  try {
    await router(req, res);
  } catch (error) {
    console.error("Preview API error:", error);
    if (!response.headersSent) sendJson(response, 500, {}, { error: "Local preview request failed" });
  }
}

async function readJsonBody(request) {
  if (request.method === "GET" || request.method === "HEAD") return {};
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { return {}; }
}

function sendJson(response, status, headers, value) {
  sendBody(response, status, { "Content-Type": "application/json; charset=utf-8", ...headers }, JSON.stringify(value));
}

function sendBody(response, status, headers, value) {
  response.writeHead(status, headers);
  response.end(value);
}
