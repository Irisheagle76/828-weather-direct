import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";

const FORECAST_KEY = "forecast:manual:latest";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const forecast = await loadForecast();

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(forecast || {});
  } catch (err) {
    console.error("Forecast latest error:", err);
    return res.status(500).json({
      error: "Failed to load latest forecast"
    });
  }
}

async function loadForecast() {
  try {
    const forecast = await kv.get(FORECAST_KEY);
    if (forecast) return forecast;
  } catch (err) {
    console.warn("KV forecast load unavailable, trying local JSON fallback:", err);
  }

  try {
    const filePath = path.join(process.cwd(), "public", "forecast-overrides.json");
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
