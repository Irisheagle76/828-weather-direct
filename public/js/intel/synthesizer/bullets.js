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
  humid: [
    "Humidity is noticeable",
    "The air feels a bit heavier",
    "Moisture creeps up"
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
  const dewPoint = intel?.signals?.dewPoint ?? intel?.dewPoint ?? intel?.dewpointF ?? null;
  const wind = intel?.signals?.wind ?? intel?.windSpeed ?? intel?.wind ?? null;
  const cloud = intel?.signals?.cloudCover ?? intel?.cloudCover ?? intel?.clouds ?? null;

  const moistureBullet = Number.isFinite(dewPoint) && dewPoint >= 60
    ? pick(bulletPools.humid)
    : pick(bulletPools.moisture);

  const windBullet = Number.isFinite(wind) && wind >= 10
    ? "Breeze becomes noticeable"
    : pick(bulletPools.wind);

  const lightBullet = Number.isFinite(cloud) && cloud > 75
    ? "Clouds are more common"
    : Number.isFinite(cloud) && cloud >= 35
      ? "A mix of sun and clouds"
      : pick(bulletPools.light);

  return [
    moistureBullet,
    windBullet,
    lightBullet
  ].filter(Boolean);
}
