// ============================================================
// CORE UTILITIES — Shared helpers used across the intel system
// ============================================================

// Cleanly join text fragments, removing empties
export function cleanJoin(parts, sep = ", ") {
  return parts
    .map(p => (p || "").trim())
    .filter(p => p.length > 0)
    .join(sep);
}

// Merge multiple phrase arrays into one clean sentence
export function mergePhrases(...parts) {
  const flat = parts
    .flat()
    .filter(Boolean)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (!flat.length) return "";
  return flat.join(", ");
}

// Convert "2026-03-16T14:00" or "14:00" → "2 PM"
export function to12Hour(timeStr) {
  const raw = timeStr.includes("T") ? timeStr.split("T")[1] : timeStr;
  const [hStr] = raw.split(":");
  let h = parseInt(hStr, 10);

  const suffix = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;

  return `${h} ${suffix}`;
}

// Convert degrees → compass direction (fallback-safe)
export function degToCompass(deg) {
  if (deg == null || isNaN(deg)) return "N";
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const idx = Math.round(deg / 45) % 8;
  return dirs[idx];
}

// Seasonal context helper
export function getSeasonalContext(date = new Date()) {
  const m = date.getMonth() + 1;

  if (m === 12 || m <= 2) return "winter";
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  return "fall";
}
