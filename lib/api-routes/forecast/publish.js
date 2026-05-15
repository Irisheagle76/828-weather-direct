import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdminSession } from "../../adminAuth.js";

const FORECAST_KEY = "forecast:manual:latest";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const forecast = normalizeForecast(req.body);

    await saveForecast(forecast);

    return res.status(200).json({
      ok: true,
      forecast,
      publishedAt: forecast.lastUpdated
    });
  } catch (err) {
    console.error("Forecast publish error:", err);
    return res.status(500).json({
      error: "Failed to publish forecast"
    });
  }
}

function normalizeForecast(input = {}) {
  const days = input.days && typeof input.days === "object"
    ? input.days
    : {};

  return {
    ...input,
    lastUpdated: new Date().toISOString(),
    source: "manual-composer",
    days,
    global: {
      tone: "human",
      style: "concise",
      overrideNarrative: true,
      ...(input.global || {})
    }
  };
}

async function saveForecast(forecast) {
  try {
    await kv.set(FORECAST_KEY, forecast);
    return;
  } catch (err) {
    console.warn("KV forecast save unavailable, trying local JSON fallback:", err);
  }

  const filePath = path.join(process.cwd(), "public", "forecast-overrides.json");
  await fs.writeFile(filePath, `${JSON.stringify(forecast, null, 2)}\n`, "utf8");
}
