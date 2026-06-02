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
    weekAheadSignals: normalizeWeekAheadSignals(input.weekAheadSignals),
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
    return;
  } catch (err) {
    console.warn("KV forecast save unavailable, trying local JSON fallback:", err);
  }

  const filePath = path.join(process.cwd(), "public", "forecast-overrides.json");
  await fs.writeFile(filePath, `${JSON.stringify(forecast, null, 2)}\n`, "utf8");
}
