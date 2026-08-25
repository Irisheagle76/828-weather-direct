import jpeg from "jpeg-js";

const CAMERA_URLS = {
  wnw: "https://i.ytimg.com/vi/UxUU3Fc1vBw/maxresdefault_live.jpg",
  ene: "https://i.ytimg.com/vi/MLpl07DrrsY/maxresdefault_live.jpg"
};
const CACHE_MS = 45 * 1000;
let memoryCache = null;

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function standardDeviation(values, mean) {
  if (!values.length || mean == null) return null;
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)) || 0);
}

function analyzeFrame({ width, height, data }) {
  const step = Math.max(3, Math.floor(Math.min(width, height) / 120));
  // The fixed courthouse camera's horizon sits near the top fifth of the frame.
  // Keeping this crop above the ridgeline prevents trees and terrain from
  // diluting the western cloud-cover signal.
  const skyBottom = Math.floor(height * 0.2);
  const groundTop = Math.floor(height * 0.5);
  const skyBrightness = [];
  const groundBrightness = [];
  const skyRows = [[], [], []];
  let bluePixels = 0;
  let cloudPixels = 0;
  let validSkyPixels = 0;

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3 / 255;
      const saturation = max ? (max - min) / max : 0;

      if (y < skyBottom) {
        skyBrightness.push(brightness);
        const blueSky = b > r * 1.04 && b > g * 0.98 && saturation > 0.09 && max > 65;
        const brightGray = saturation < 0.3 && max > 125 && r > b * 0.82 && g > b * 0.82;
        const warmGray = r > b * 0.94 && g > b * 0.88 && brightness > 0.47 && saturation < 0.37;
        const cloud = !blueSky && (brightGray || warmGray);
        if (blueSky) bluePixels += 1;
        if (cloud) cloudPixels += 1;
        if (blueSky || cloud) validSkyPixels += 1;
        skyRows[Math.min(2, Math.floor((y / skyBottom) * 3))].push(brightness);
      }

      if (y >= groundTop) groundBrightness.push(brightness);
    }
  }

  const skyMean = average(skyBrightness) || 0;
  const contrast = standardDeviation(skyBrightness, skyMean) || 0;
  const groundMean = average(groundBrightness) || 0;
  const groundContrast = standardDeviation(groundBrightness, groundMean) || 0;
  const cloudCover = validSkyPixels ? Math.round((cloudPixels / validSkyPixels) * 100) : 0;
  const blueShare = validSkyPixels ? bluePixels / validSkyPixels : 0;
  const visibilityScore = skyRows.reduce((score, row) => {
    if (row.length < 2) return score;
    const rowMean = average(row) || 0;
    const rowContrast = standardDeviation(row, rowMean) || 0;
    return score + (rowContrast > 0.055 ? 1 : 0);
  }, 0);
  const sunlightStrength = groundMean * 0.6 + groundContrast * 0.4;
  const sunlightLevel = sunlightStrength > 0.12 ? "strong" : sunlightStrength > 0.07 ? "moderate" : "weak";
  const sunlightDetected = sunlightStrength > 0.07;
  const visibleStructureSignal = groundContrast >= 0.13 && groundMean >= 0.18;
  let structureSamples = 0;
  let structuredSamples = 0;
  let structureGradientTotal = 0;
  const luminanceAt = (x, y) => {
    const index = (y * width + x) * 4;
    return (data[index] + data[index + 1] + data[index + 2]) / 3;
  };

  // Cloud towers and textured storm clouds create substantially more local
  // light/dark structure than a smooth blue sky. Exclude the camera's text
  // overlay in the upper-left before measuring that structure.
  for (let y = step; y < skyBottom - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      if (x < width * 0.32 && y < skyBottom * 0.45) continue;
      const center = luminanceAt(x, y);
      const gradient = (
        Math.abs(center - luminanceAt(x + step, y)) +
        Math.abs(center - luminanceAt(x, y + step))
      ) / 2;
      structureSamples += 1;
      structureGradientTotal += gradient;
      if (gradient >= 12) structuredSamples += 1;
    }
  }
  const buildingCloudStructureScore = structureSamples
    ? structuredSamples / structureSamples
    : 0;
  const buildingCloudStructureSignal = buildingCloudStructureScore >= 0.09;
  const structureCloudEstimate = Math.round(Math.max(
    0,
    Math.min(1, (buildingCloudStructureScore - 0.05) / 0.15)
  ) * 100);
  const adjustedCloudCover = Math.max(cloudCover, structureCloudEstimate);

  return {
    cloudCoverWest: adjustedCloudCover,
    brightness: Number(skyMean.toFixed(2)),
    contrast: Number(contrast.toFixed(2)),
    visibilityScore,
    sunlightDetected,
    sunlightStrength: Number(sunlightStrength.toFixed(2)),
    sunlightLevel,
    groundBrightness: Number(groundMean.toFixed(2)),
    groundContrast: Number(groundContrast.toFixed(2)),
    visibleStructureSignal,
    buildingCloudStructureSignal,
    buildingCloudStructureScore: Number(buildingCloudStructureScore.toFixed(2)),
    structureCloudEstimate,
    skyTextureGradient: structureSamples
      ? Number((structureGradientTotal / structureSamples).toFixed(1))
      : null,
    softShadowSignal: contrast < 0.09 || (groundContrast < 0.18 && contrast < 0.12),
    filteredSunshineSignal: sunlightDetected && cloudCover >= 20,
    skyBlueSignal: Number((1 + blueShare * 0.35).toFixed(2)),
    precipVisible: false,
    mode: skyMean < 0.18 ? "night" : "day",
    source: "live-thumbnail"
  };
}

async function fetchAndAnalyze(url) {
  const response = await fetch(`${url}?t=${Date.now()}`, {
    headers: {
      "user-agent": "828 Weather Direct current sky/1.0",
      accept: "image/jpeg,image/*"
    }
  });
  if (!response.ok) throw new Error(`Live camera fetch failed: ${response.status}`);
  const image = jpeg.decode(Buffer.from(await response.arrayBuffer()), { useTArray: true });
  return analyzeFrame(image);
}

function compareDirections(wnw, ene) {
  const west = wnw.cloudCoverWest;
  const east = ene.cloudCoverWest;
  const difference = west - east;
  let summary = "Cloud cover is fairly similar east and west.";
  let pattern = "similar";
  if (difference >= 15) {
    summary = "Cloud cover is greater toward the west-northwest than the east-northeast.";
    pattern = "cloudier-west";
  } else if (difference <= -15) {
    summary = "Cloud cover is greater toward the east-northeast than the west-northwest.";
    pattern = "cloudier-east";
  }
  return { pattern, difference: Math.abs(difference), narrative: summary };
}

async function buildPayload() {
  const [wnw, eneRaw] = await Promise.all([
    fetchAndAnalyze(CAMERA_URLS.wnw),
    fetchAndAnalyze(CAMERA_URLS.ene)
  ]);
  const ene = { ...eneRaw, cloudCoverENE: eneRaw.cloudCoverWest };
  delete ene.cloudCoverWest;
  const directionalComparison = compareDirections(wnw, eneRaw);
  return {
    timestamp: new Date().toISOString(),
    captureStatus: "live",
    metrics: { ...wnw, cloudCoverENE: ene.cloudCoverENE },
    cameras: {
      wnw: { label: "Downtown Asheville", direction: "WNW", metrics: wnw },
      ene: { label: "East Asheville", direction: "ENE", metrics: ene }
    },
    directionalComparison,
    trend: { cloudTrend: "unknown", brightnessTrend: "unknown", overallTrend: "current" }
  };
}

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.timestamp > CACHE_MS) {
      memoryCache = { timestamp: now, payload: await buildPayload() };
    }
    res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=45");
    return res.status(200).json(memoryCache.payload);
  } catch (error) {
    return res.status(503).json({ error: error.message || "Current sky unavailable" });
  }
}

export { analyzeFrame, buildPayload };
