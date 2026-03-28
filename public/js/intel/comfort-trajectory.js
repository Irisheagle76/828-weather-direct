// /intel/comfort-trajectory.js
// Human‑Action Next 6 Hours Comfort Trajectory

export function buildComfortTrajectory(factorizedHours) {
  if (!factorizedHours || factorizedHours.length === 0) {
    return {
      direction: "steady",
      magnitude: "none",
      nextShiftInMinutes: null,
      sensation: "Conditions stay steady.",
      action: null,
      arcPoints: [0, 0, 0]
    };
  }

  // ------------------------------------------------------------
  // 1. Build a simple comfort index from factors
  // ------------------------------------------------------------
  const comfortIndex = factorizedHours.map(h => {
    const f = h.dominantFactor;

    if (f === "cold" || f === "freezingFog" || f === "blackIce") return -2;
    if (f === "cool" || f === "wind" || f === "dryness") return -1;
    if (f === "mild" || f === "sun" || f === "clouds") return 0;
    if (f === "warm" || f === "uv") return 1;
    if (f === "heat") return 2;

    return 0;
  });

  // ------------------------------------------------------------
  // 2. Determine direction (rising, falling, steady)
  // ------------------------------------------------------------
  const now = comfortIndex[0];
  const mid = comfortIndex[1];
  const later = comfortIndex[3];

  const delta = later - now;

  let direction = "steady";
  if (delta >= 1) direction = "rising";
  if (delta <= -1) direction = "falling";

  // ------------------------------------------------------------
  // 3. Magnitude of change
  // ------------------------------------------------------------
  let magnitude = "none";
  if (Math.abs(delta) === 1) magnitude = "gentle";
  if (Math.abs(delta) >= 2) magnitude = "meaningful";

  // ------------------------------------------------------------
  // 4. Timing of next shift
  // ------------------------------------------------------------
  let nextShiftInMinutes = null;
  for (let i = 1; i < comfortIndex.length; i++) {
    if (comfortIndex[i] !== now) {
      nextShiftInMinutes = i * 60;
      break;
    }
  }

  // ------------------------------------------------------------
  // 5. Sensation shift (narrative)
  // ------------------------------------------------------------
  let sensation = "Conditions stay steady.";
  if (direction === "rising") {
    sensation = magnitude === "meaningful"
      ? "The air takes on a softer, more comfortable feel."
      : "A gentle warmup adds a bit of ease.";
  }
  if (direction === "falling") {
    sensation = magnitude === "meaningful"
      ? "A cooler drift settles in and sharpens the air."
      : "A subtle cool-down adds a crisp edge.";
  }

  // ------------------------------------------------------------
  // 6. Micro‑action
  // ------------------------------------------------------------
  let action = null;
  if (direction === "rising") action = "Great moment to step outside.";
  if (direction === "falling") action = "Layer up if you're heading out.";

  // ------------------------------------------------------------
  // 7. Arc points (for tiny visual arc)
  // ------------------------------------------------------------
  const arcPoints = [
    comfortIndex[0],
    comfortIndex[1],
    comfortIndex[3]
  ];

  return {
    direction,
    magnitude,
    nextShiftInMinutes,
    sensation,
    action,
    arcPoints
  };
}