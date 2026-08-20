import { buildFallIntelligence } from "./intelligence.js";
import { renderFailure, renderFallExplorer } from "./render.js";

async function fetchJson(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function init() {
  try {
    const fallPayload = await fetchJson(`/api/router?route=fall&t=${Date.now()}`, 20000);
    renderFallExplorer(buildFallIntelligence(fallPayload));

    // Summit camera/chart analysis is an optional refinement. Never make the
    // primary five-second read wait for a slower live-image source.
    fetchJson(`/api/sky-index?t=${Date.now()}`, 12000)
      .then((skyPayload) => renderFallExplorer(buildFallIntelligence(fallPayload, skyPayload)))
      .catch(() => {});
  } catch (error) {
    console.error("Fall Explorer could not load", error);
    renderFailure();
  }
}

init();
