// Preview-only cache: shared across tabs, never changes production responses.
export function previewTtl(url) {
  const route = url.searchParams.get("route");
  if (route === "substack-articles") return 30 * 60_000;
  if (route === "weather") return 10 * 60_000;
  if (["alerts/latest", "tidbits/pulse-feed"].includes(route)) return 2 * 60_000;
  return 5 * 60_000;
}

export function createUpstreamCache({ fetchImpl = fetch, now = Date.now } = {}) {
  const entries = new Map();
  const pending = new Map();
  return async function get(url) {
    const canonical = new URL(url);
    for (const key of ["t", "_", "timestamp"]) canonical.searchParams.delete(key);
    canonical.searchParams.sort();
    const key = canonical.pathname + canonical.search;
    const cached = entries.get(key);
    if (cached && now() < cached.expires) return { ...cached.response, cache: "HIT" };
    if (pending.has(key)) return pending.get(key);
    const request = (async () => {
      let response;
      try {
        const upstream = await fetchImpl(`https://avlweather.com${key}`, { signal: AbortSignal.timeout(15_000) });
        response = { status: upstream.status, type: upstream.headers.get("content-type") || "application/json", body: Buffer.from(await upstream.arrayBuffer()) };
      } catch {
        response = { status: 503, type: "application/json", body: Buffer.from(JSON.stringify({ error: "Published feed unavailable" })) };
      }
      // Short failure cooldown avoids retry storms; never disguise stale data as fresh.
      entries.set(key, { response, expires: now() + (response.status === 200 ? previewTtl(canonical) : 30_000) });
      if (entries.size > 100) entries.delete(entries.keys().next().value);
      return { ...response, cache: "MISS" };
    })();
    pending.set(key, request);
    try { return await request; } finally { pending.delete(key); }
  };
}
