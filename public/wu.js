// /api/wu.js
// Unified Weather Underground router (safe shadow version)

export default async function handler(req, res) {
  const { type } = req.query;

  try {
    if (type === "current") return getCurrent(req, res);
    if (type === "hourly") return getHourly(req, res);
    if (type === "forecast") return getForecast(req, res);

    return res.status(400).json({ error: "Unknown WU type" });
  } catch (err) {
    console.error("WU router error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// -----------------------------
// CURRENT CONDITIONS
// -----------------------------
async function getCurrent(req, res) {
  const url = `https://api.weather.com/v2/pws/observations/current?...`; 
  const r = await fetch(url);
  const json = await r.json();
  return res.status(200).json(json);
}

// -----------------------------
// HOURLY FORECAST
// -----------------------------
async function getHourly(req, res) {
  const url = `https://api.weather.com/v3/wx/forecast/hourly?...`;
  const r = await fetch(url);
  const json = await r.json();
  return res.status(200).json(json);
}

// -----------------------------
// DAILY FORECAST
// -----------------------------
async function getForecast(req, res) {
  const url = `https://api.weather.com/v3/wx/forecast/daily?...`;
  const r = await fetch(url);
  const json = await r.json();
  return res.status(200).json(json);
}