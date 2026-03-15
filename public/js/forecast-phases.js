// public/js/forecast-phases.js
// Phase + trend + event-day analysis

// hours: array of { hour, temp, pop, windDir, windGust, precipType, thunderProb, cloudCover }
export function analyzeDay(hours) {
  const phases = detectPhases(hours);
  const trends = detectTrends(hours);
  const drivers = detectDominantDrivers(hours, phases, trends);
  const snow = detectSnowBehindFront(hours, phases);

  const isEventDay = phases.length > 1 || drivers.includes("front");

  return {
    isEventDay,
    phases,   // e.g. ["rain-early", "frontal-passage", "post-frontal-cold", "nw-snow"]
    trends,   // e.g. { tempFalling: true, tempRise: false }
    drivers,  // e.g. ["front", "wind", "precip"]
    snow      // e.g. { nwFlowSnow: true }
  };
}

function detectPhases(hours) {
  const phases = [];
  const hasRainEarly = hours.some(h => h.hour >= 6 && h.hour <= 11 && h.pop >= 50 && h.precipType === "rain");
  const hasThunder = hours.some(h => h.hour >= 6 && h.hour <= 12 && (h.thunderProb ?? 0) >= 20);
  const hasWindShift = detectWindShift(hours);
  const hasColdAfternoon = detectColdAfternoon(hours);
  const hasNwSnow = detectSnowBehindFront(hours, []);

  if (hasRainEarly) phases.push("rain-early");
  if (hasThunder) phases.push("thunder-embedded");
  if (hasWindShift) phases.push("frontal-passage");
  if (hasColdAfternoon) phases.push("post-frontal-cold");
  if (hasNwSnow.nwFlowSnow) phases.push("nw-snow");

  return phases;
}

function detectWindShift(hours) {
  // look for a significant change in direction within the day
  const dirs = hours.map(h => h.windDir).filter(d => d != null);
  if (dirs.length < 2) return false;

  const first = dirs[0];
  const last = dirs[dirs.length - 1];
  const diff = Math.abs(first - last);
  return diff >= 60; // crude but effective for front days
}

function detectColdAfternoon(hours) {
  const noon = hours.filter(h => h.hour >= 12 && h.hour <= 17);
  if (noon.length < 2) return false;
  const start = noon[0].temp;
  const end = noon[noon.length - 1].temp;
  return end <= start - 8; // falling sharply
}

function detectTrends(hours) {
  const temps = hours.map(h => h.temp).filter(t => t != null);
  if (temps.length < 2) return { tempFalling: false, tempRising: false };

  const first = temps[0];
  const last = temps[temps.length - 1];

  return {
    tempFalling: last <= first - 8,
    tempRising: last >= first + 8
  };
}

function detectDominantDrivers(hours, phases, trends) {
  const drivers = [];

  const windy = hours.some(h => (h.windGust ?? 0) >= 25);
  const rainy = hours.some(h => h.pop >= 50 && h.precipType === "rain");
  const snowy = hours.some(h => h.pop >= 40 && h.precipType === "snow");

  if (phases.includes("frontal-passage")) drivers.push("front");
  if (windy) drivers.push("wind");
  if (rainy) drivers.push("precip");
  if (snowy) drivers.push("snow");
  if (trends.tempFalling) drivers.push("temp-drop");
  if (trends.tempRising) drivers.push("warm-surge");

  return drivers;
}

function detectSnowBehindFront(hours, phases) {
  // crude NW-flow snow detector: NW-ish wind + cold + precip
  const nwSnow = hours.some(h => {
    const dir = h.windDir;
    if (dir == null) return false;
    const isNW = dir >= 270 || dir <= 330; // rough
    const coldEnough = h.temp <= 36;
    const precip = h.pop >= 30 && (h.precipType === "snow" || h.precipType === "mix");
    return isNW && coldEnough && precip;
  });

  return { nwFlowSnow: nwSnow };
}
