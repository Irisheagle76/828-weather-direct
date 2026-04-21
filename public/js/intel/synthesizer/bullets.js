// bullets.js
// ============================================================
// MICRO-BULLET LIBRARY — CLEAN + USER-FACING
// ============================================================

export const bulletPools = {
  temperature: [
    "Comfortable temperatures",
    "A mild afternoon",
    "A cool start early"
  ],
  moisture: [
    "Dry, crisp air",
    "Comfortable humidity",
    "Air stays light"
  ],
  wind: [
    "Light winds",
    "A light breeze at times",
    "Winds stay out of the way"
  ],
  light: [
    "A mix of sun and clouds",
    "Plenty of sunshine",
    "Some clouds around"
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