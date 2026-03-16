// ============================================================
// EVENTS + METEOROLOGICAL INTELLIGENCE
// Detects phases, trends, and drivers that shape the expressive
// narrative. This is the "why" behind the weather.
// ============================================================

// ------------------------------------------------------------
// Detect dominant precipitation phase
// ------------------------------------------------------------
export function detectPhase(stats) {
  const rain = stats.precip.rainTotal;
  const snow = stats.precip.snowTotal;

  if (snow > 0.05 && snow >= rain) return "snow";
  if (rain > 0.05) return "rain";
  return "dry";
}

// ------------------------------------------------------------
// Detect temperature trend (warming / cooling / steady)
// ------------------------------------------------------------
export function detectTempTrend(window) {
  const t = window.temperature_2m || [];
  if (t.length < 2) return "steady";

  const first = t[0];
  const last = t[t.length - 1];
  const diff = last - first;

  if (diff >= 4) return "warming";
  if (diff <= -4) return "cooling";
  return "steady";
}

// ------------------------------------------------------------
// Detect wind trend (increasing / decreasing / steady)
// ------------------------------------------------------------
export function detectWindTrend(window) {
  const w = window.wind_speed_10m || [];
  if (w.length < 2) return "steady";

  const first = w[0];
  const last = w[w.length - 1];
  const diff = last - first;

  if (diff >= 5) return "increasing";
  if (diff <= -5) return "decreasing";
  return "steady";
}

// ------------------------------------------------------------
// Detect dominant "driver" of the day
// (rain, wind, heat, cold, humidity, or quiet)
// ------------------------------------------------------------
export function detectDriver(stats) {
  const { temp, dew, wind, precip } = stats;

  if (precip.rainTotal > 0.1) return "rain";
  if (precip.snowTotal > 0.1) return "snow";
  if (wind.gustMax >= 25) return "windy";
  if (temp.max >= 85) return "hot";
  if (temp.min <= 32) return "cold";
  if (dew.avg >= 65) return "humid";

  return "quiet";
}

// ------------------------------------------------------------
// Detect simple frontal passage
// (cooling + wind shift + cloud drop)
// ------------------------------------------------------------
export function detectFront(window, stats) {
  const t = window.temperature_2m || [];
  const c = window.cloudcover || [];
  const d = window.wind_direction_10m || [];

  if (t.length < 2 || c.length < 2 || d.length < 2) return false;

  const tempDrop = t[0] - t[t.length - 1] >= 6;
  const cloudDrop = c[0] - c[c.length - 1] >= 20;

  // Wind shift of ~45° or more
  const windShift = Math.abs(d[d.length - 1] - d[0]) >= 45;

  return tempDrop && (cloudDrop || windShift);
}

// ------------------------------------------------------------
// Detect "commute impact" (rain or snow during 7–9 AM or 4–7 PM)
// ------------------------------------------------------------
export function detectCommuteImpact(hourly, indices) {
  const times = hourly.time || [];
  const rain = hourly.rain || [];
  const snow = hourly.snowfall || [];

  let am = false;
  let pm = false;

  for (const i of indices) {
    const t = new Date(times[i]);
    const h = t.getHours();

    const precip = (rain[i] || 0) + (snow[i] || 0);

    if (precip > 0.02) {
      if (h >= 7 && h <= 9) am = true;
      if (h >= 16 && h <= 19) pm = true;
    }
  }

  return { am, pm };
}

// ------------------------------------------------------------
// Unified event analysis bundle
// ------------------------------------------------------------
export function analyzeEvents(window, stats, hourly, indices) {
  return {
    phase: detectPhase(stats),
    tempTrend: detectTempTrend(window),
    windTrend: detectWindTrend(window),
    driver: detectDriver(stats),
    front: detectFront(window, stats),
    commute: detectCommuteImpact(hourly, indices)
  };
}
