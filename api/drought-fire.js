import { computeDroughtFireIndexLive } from "../lib/drought-fire/computeDroughtFireIndex.js";

export default async function handler(req, res) {
  try {
    const result = await computeDroughtFireIndexLive({
      tempAnomalyF: 8,       // replace with your real weather data later
      daysSinceRain: 18,
      rh: 28,
      windGust: 18,
      tempF: 82
    });

    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "failed to compute drought/fire index" });
  }
}