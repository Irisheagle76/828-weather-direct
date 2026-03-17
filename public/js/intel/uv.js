// /js/intel/uv.js
// Unified UV pipeline: Tempest → WU → Open-Meteo → Solar fallback

export function getReliableUV(intel) {
  const now = new Date();
  const month = now.getMonth() + 1;

  // Seasonal UV caps for Asheville
  const seasonalMax = {
    1: 2, 2: 3, 3: 5, 4: 7, 5: 9, 6: 10,
    7: 10, 8: 9, 9: 7, 10: 5, 11: 3, 12: 2
  }[month];

  // 1️⃣ Tempest UV (best)
  const tempestUV = intel.tempest?.uv ?? null;
  if (tempestUV != null && tempestUV >= 0 && tempestUV <= 15) {
    return Math.min(tempestUV, seasonalMax);
  }

  // 2️⃣ WU station UV
  const wuUV = intel.wu?.uv ?? intel.wu?.uv_index ?? null;
  if (wuUV != null && wuUV >= 0 && wuUV <= 15) {
    return Math.min(wuUV, seasonalMax);
  }

  // 3️⃣ Open-Meteo UV (correct local hour)
  const hourly = intel.hourly;
  if (hourly?.uv_index && hourly.time) {
    const nowISO = now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    const idx = hourly.time.findIndex(t => t.startsWith(nowISO));
    if (idx >= 0) {
      const omUV = hourly.uv_index[idx];
      if (omUV != null && omUV >= 0 && omUV <= 15) {
        return Math.min(omUV, seasonalMax);
      }
    }
  }

  // 4️⃣ Solar radiation fallback
  const solar = intel.wu?.solarRadiation ?? null;
  if (solar != null) {
    const est = Math.min(solar / 100, seasonalMax);
    return est;
  }

  return 0;
}
