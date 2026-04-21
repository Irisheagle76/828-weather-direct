export const bulletPools = {

  // TEMPERATURE
  temperature: [
    "Comfortable temperatures",
    "A mild afternoon",
    "A cool start early",
    "Warmer later in the day",
    "Temperatures ease later on",
    "A steady feel through the day"
  ],

  // MOISTURE
  moisture: [
    "Dry, crisp air",
    "Comfortable humidity",
    "Air stays light and clean",
    "A slightly heavier feel at times",
    "Humidity stays in check",
    "No stickiness to deal with"
  ],

  // WIND
  wind: [
    "Light winds",
    "A light breeze at times",
    "Winds stay out of the way",
    "A bit of a breeze develops",
    "Occasional gusts",
    "Calm conditions overall"
  ],

  // LIGHT / SKY
  light: [
    "A mix of sun and clouds",
    "Plenty of sunshine",
    "Some clouds around at times",
    "Sun breaks through at times",
    "Partly sunny skies",
    "More clouds than sun"
  ],

  // MICROCLIMATE (keep subtle, but understandable)
  microclimate: [
    "Cooler in the valleys early",
    "Warmer on the ridges",
    "Some small differences by elevation",
    "Conditions feel similar across the area"
  ],

  // PATTERN (MINIMIZED — only keep what makes sense)
  pattern: [
    "Not much changing through the day",
    "A steady day overall",
    "Things stay pretty consistent",
    "A simple, quiet setup"
  ],

  // GOLDILOCKS (this one matters — keep it clean)
  goldilocks: [
    "Comfortable from start to finish",
    "Great air quality",
    "Light winds",
    "Dry, crisp air",
    "Easy to be outside",
    "A really nice overall feel"
  ]
};

function pick(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function buildBullets(intel = {}) {
  const { moisture, wind, light } = bulletPools;

  // ------------------------------------------------------------
  // PRIORITY ORDER (REAL-WORLD SIGNALS)
  // ------------------------------------------------------------
  const selected = [
    pick(moisture),
    pick(wind),
    pick(light)
  ]
    .filter(Boolean)
    .slice(0, 3);

  return selected;
}