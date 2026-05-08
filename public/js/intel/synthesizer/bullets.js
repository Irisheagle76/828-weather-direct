// bullets.js
// ============================================================
// MICRO-BULLET LIBRARY — CLEAN + USER-FACING
// ============================================================

export const bulletPools = {
  temperature: [
    "Temperatures feel good",
    "A mild afternoon",
    "A cool start early"
  ],
  moisture: [
    "Dry, crisp air",
    "Humidity stays easy",
    "The air feels light",
    "Low humidity helps"
  ],
  wind: [
    "Winds stay light",
    "A light breeze at times",
    "Wind stays pretty quiet"
  ],
  light: [
    "A mix of sun and clouds",
    "Plenty of sunshine",
    "Some clouds around",
    "Sun breaks through at times"
  ]
};

// ------------------------------------------------------------
// INTERNAL PICK HELPER
// ------------------------------------------------------------
function pick(arr) {
  return Array.isArray(arr) && arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : null;
}

// ------------------------------------------------------------
// BULLET BUILDER (PRIORITIZED + CLEAN)
// ------------------------------------------------------------
export function buildBullets(intel = {}) {
  return [
    pick(bulletPools.moisture),
    pick(bulletPools.wind),
    pick(bulletPools.light)
  ].filter(Boolean);
}
