import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAdminSession } from "../../adminAuth.js";
import { validateForecast } from "../../forecast/validate.js";

const FORECAST_KEY = "forecast:manual:latest";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  try {
    const forecast = normalizeForecast(req.body);
    const validation = validateForecast(forecast);
    if (!validation.valid) {
      return res.status(400).json({ error: "Forecast validation failed", validation });
    }

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

  const publishedAt = new Date().toISOString();
  return {
    ...input,
    weekAheadSignals: normalizeWeekAheadSignals(input.weekAheadSignals),
    lastUpdated: publishedAt,
    source: "manual-composer",
    metadata: {
      ...(input.metadata || {}),
      publicationSource: "manual",
      publishedAt
    },
    days,
    global: {
      tone: "human",
      style: "concise",
      overrideNarrative: true,
      ...(input.global || {})
    }
  };
}

function normalizeWeekAheadSignals(input = {}) {
  const global = input.global && typeof input.global === "object"
    ? Object.fromEntries(
        Object.entries(input.global).map(([key, value]) => [key, emptyToString(value)])
      )
    : {};

  const cards = Array.isArray(input.cards)
    ? input.cards
        .map(normalizeSignalCard)
        .filter(card => card.label && card.value)
    : [];

  return { global, cards };
}

function normalizeSignalCard(card = {}) {
  const presetLabel = emptyToString(card.presetLabel);
  const customLabel = emptyToString(card.customLabel);
  const label = emptyToString(
    card.label ||
    (presetLabel === "CREATE MY OWN" ? customLabel : presetLabel) ||
    customLabel
  );

  return {
    label,
    value: emptyToString(card.value),
    detail: emptyToString(card.detail),
    type: normalizeSignalType(card.type === "auto" ? typeForSignalLabel(label) : card.type)
  };
}

function normalizeSignalType(type) {
  const value = emptyToString(type).toLowerCase();
  return ["comfort", "impact", "pattern", "uncertainty", "mountain", "custom"].includes(value)
    ? value
    : "custom";
}

function typeForSignalLabel(label) {
  const value = emptyToString(label).toUpperCase();
  if (value.includes("PICK") || value.includes("SPRINGLIKE")) return "comfort";
  if (value.includes("IMPACT") || value.includes("WEATHER MAKER") || value.includes("OUT OF SEASON")) return "impact";
  if (value.includes("PATTERN")) return "pattern";
  if (value.includes("VOLATILE") || value.includes("CONFIDENCE") || value.includes("EYES ON")) return "uncertainty";
  if (value.includes("MOUNTAIN")) return "mountain";
  return "custom";
}

function emptyToString(value) {
  return String(value ?? "").trim();
}

async function saveForecast(forecast) {
  try {
    await kv.set(FORECAST_KEY, forecast);
  } catch (err) {
    console.warn("KV forecast save unavailable, trying local JSON fallback:", err);
    await saveForecastToFile(forecast);
    return;
  }

  if (!await forecastSavedToKv(forecast)) {
    throw new Error("KV readback did not match the submitted forecast");
  }
}

async function saveForecastToFile(forecast) {
  const filePath = path.join(process.cwd(), "public", "forecast-overrides.json");
  const tempPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(forecast, null, 2)}\n`, "utf8");
  await fs.rename(tempPath, filePath);
}

async function forecastSavedToKv(forecast) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const saved = await kv.get(FORECAST_KEY);
    if (forecastMatches(saved, forecast)) return true;
    if (attempt < 2) await wait(150 * (attempt + 1));
  }

  return false;
}

function forecastMatches(saved, forecast) {
  if (!saved || !forecast) return false;
  return saved.lastUpdated === forecast.lastUpdated &&
    saved.metadata?.publishedAt === forecast.metadata?.publishedAt &&
    saved.source === forecast.source;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
