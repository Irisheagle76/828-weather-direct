import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildAshevilleSpread } from "../lib/asheville-spread/service.js";
import { ASHEVILLE_STATIONS, publicStationMetadata } from "../lib/asheville-spread/stations.js";

const port = Number(process.argv[2] || 4175);
const upstreamUrl = process.argv[3] || null;
const pagePath = fileURLToPath(new URL("../public/asheville-microscope-terrain.html", import.meta.url));

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

  try {
    if (url.pathname === "/asheville-microscope-terrain.html" || url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      response.end(await readFile(pagePath));
      return;
    }

    if (url.pathname === "/api/router" && url.searchParams.get("route") === "asheville-spread") {
      const payload = upstreamUrl ? await loadNormalizedUpstream() : await buildAshevilleSpread({ nowMs: Date.now() });
      response.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    response.end(JSON.stringify({ error: "Local terrain preview failed", detail: error.message }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Station Terrain preview: http://127.0.0.1:${port}/asheville-microscope-terrain.html`);
  console.log(upstreamUrl ? `Observation source: normalized upstream ${upstreamUrl}` : "Observation source: local normalized service");
});

async function loadNormalizedUpstream() {
  const response = await fetch(upstreamUrl, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Normalized upstream failed (${response.status})`);
  const payload = await response.json();
  if (!Array.isArray(payload?.stations) || !payload?.network) throw new Error("Normalized upstream returned an unexpected shape");
  const upstreamById = new Map(payload.stations.map((station) => [station.id, station]));
  const stations = ASHEVILLE_STATIONS.map((station) => {
    const metadata = publicStationMetadata(station);
    const upstream = upstreamById.get(station.id);
    if (upstream) return { ...upstream, ...metadata };
    return {
      ...metadata,
      status: "unavailable",
      observation: null,
      quality: { freshness: "unknown", ageMinutes: null, usable: false, flags: ["not_in_deployed_endpoint"] },
      unavailableReason: "Local station is not yet present in the deployed normalized endpoint"
    };
  });
  return {
    ...payload,
    network: {
      ...payload.network,
      stationCount: stations.length,
      enabledStationCount: stations.filter((station) => station.enabled).length
    },
    stations
  };
}
