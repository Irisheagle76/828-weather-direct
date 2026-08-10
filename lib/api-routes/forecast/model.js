import { getConfig } from "../../forecast/config.js";
import { fetchSources } from "../../forecast/sources.js";
import { generateForecast } from "../../forecast/generate.js";

const CACHE_MS = 15 * 60 * 1000;
let cachedForecast = null;

export async function buildModelForecast({
  now = new Date(),
  env = process.env,
  fetcher = fetch,
  sourceLoader = fetchSources,
  generator = generateForecast
} = {}) {
  const config = getConfig(env);
  const sources = await sourceLoader(config, { fetcher, now });
  const forecast = generator(sources, now);

  return {
    ...forecast,
    source: "nws-model",
    generatedAt: now.toISOString(),
    metadata: {
      publicationSource: "nws-model",
      sourceTimestamps: sources.timestamps || null
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=900, stale-while-revalidate=3600");

  if (cachedForecast && Date.now() - cachedForecast.savedAt < CACHE_MS) {
    return res.status(200).json(cachedForecast.value);
  }

  try {
    const value = await buildModelForecast();
    cachedForecast = { savedAt: Date.now(), value };
    return res.status(200).json(value);
  } catch (error) {
    console.error("NWS model forecast unavailable:", error);
    return res.status(503).json({ error: "Model forecast unavailable" });
  }
}
