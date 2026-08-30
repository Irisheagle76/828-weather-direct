import { createHash } from "node:crypto";
import jpeg from "jpeg-js";
import { CAMERA_REGISTRY } from "../../sky/camera-registry.js";
import { fetchVisibleSatelliteSignal } from "../../sky/visible-satellite.js";
export { CAMERA_REGISTRY } from "../../sky/camera-registry.js";

const CACHE_MS = 45_000;
const MAX_AGE_MS = 15 * 60_000;
const signatures = new Map();
let memoryCache = null;

const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const deviation = (values, mean = average(values)) => values.length && mean != null ? Math.sqrt(average(values.map((value) => (value - mean) ** 2)) || 0) : null;
const coverageLabel = (value) => value < 8 ? "clear" : value < 25 ? "few" : value < 50 ? "scattered" : value < 78 ? "broken" : value < 94 ? "mostly_cloudy" : "overcast";

function analyzeFrame({ width, height, data }, { skyCrop = 0.2 } = {}) {
  const step = Math.max(3, Math.floor(Math.min(width, height) / 120));
  const skyBottom = Math.max(step * 3, Math.floor(height * skyCrop));
  const groundTop = Math.floor(height * Math.max(skyCrop, 0.5));
  const skyBrightness = [], groundBrightness = [], skyRows = [[], [], []];
  const segments = Array.from({ length: 3 }, () => ({ blue: 0, cloud: 0, valid: 0 }));
  let bluePixels = 0, cloudPixels = 0, validSkyPixels = 0, glarePixels = 0, darkPixels = 0;

  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) {
    const i = (y * width + x) * 4;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const brightness = (r + g + b) / 765;
    const saturation = max ? (max - min) / max : 0;
    if (y < skyBottom) {
      skyBrightness.push(brightness);
      const blue = b > r * 1.04 && b > g * 0.98 && saturation > 0.09 && max > 65;
      const gray = !blue && ((saturation < 0.3 && max > 125 && r > b * 0.82 && g > b * 0.82) || (r > b * 0.94 && g > b * 0.88 && brightness > 0.47 && saturation < 0.37));
      const segment = segments[Math.min(2, Math.floor(x / width * 3))];
      if (blue) { bluePixels++; segment.blue++; }
      if (gray) { cloudPixels++; segment.cloud++; }
      if (blue || gray) { validSkyPixels++; segment.valid++; }
      if (brightness > 0.96 && saturation < 0.08) glarePixels++;
      if (brightness < 0.16) darkPixels++;
      skyRows[Math.min(2, Math.floor(y / skyBottom * 3))].push(brightness);
    }
    if (y >= groundTop) groundBrightness.push(brightness);
  }

  const skyMean = average(skyBrightness) || 0, contrast = deviation(skyBrightness, skyMean) || 0;
  const groundMean = average(groundBrightness) || 0, groundContrast = deviation(groundBrightness, groundMean) || 0;
  const rawCloud = validSkyPixels ? Math.round(cloudPixels / validSkyPixels * 100) : 0;
  const blueShare = validSkyPixels ? bluePixels / validSkyPixels : 0;
  const visibilityScore = skyRows.reduce((score, row) => score + (row.length >= 2 && deviation(row) > 0.055 ? 1 : 0), 0);
  const sunlightStrength = groundMean * 0.6 + groundContrast * 0.4;
  let structureSamples = 0, structuredSamples = 0, gradientTotal = 0;
  const luminanceAt = (x, y) => { const i = (y * width + x) * 4; return (data[i] + data[i + 1] + data[i + 2]) / 3; };
  for (let y = step; y < skyBottom - step; y += step) for (let x = step; x < width - step; x += step) {
    if (x < width * 0.32 && y < skyBottom * 0.15) continue;
    const center = luminanceAt(x, y);
    const gradient = (Math.abs(center - luminanceAt(x + step, y)) + Math.abs(center - luminanceAt(x, y + step))) / 2;
    structureSamples++; gradientTotal += gradient; if (gradient >= 12) structuredSamples++;
  }
  const structureScore = structureSamples ? structuredSamples / structureSamples : 0;
  const structureEstimate = Math.round(Math.max(0, Math.min(1, (structureScore - 0.05) / 0.15)) * 100);
  const cloudCover = Math.max(rawCloud, structureEstimate);
  const samples = Math.max(1, skyBrightness.length), glareShare = glarePixels / samples, validSkyShare = validSkyPixels / samples;
  const mode = skyMean < 0.18 || darkPixels / samples > 0.82 ? "night" : "day";
  const qualityFlags = [];
  if (mode === "night") qualityFlags.push("dark");
  if (glareShare > 0.45) qualityFlags.push("glare");
  if (validSkyShare < 0.18) qualityFlags.push("insufficient-sky");
  if (contrast > 0.31 && glareShare > 0.2) qualityFlags.push("possible-droplets");
  const qualityScore = Math.max(0, Math.min(1, 0.78 + Math.min(0.12, validSkyShare * 0.2) - (mode === "night" ? 0.8 : 0) - (glareShare > 0.45 ? 0.45 : 0) - (validSkyShare < 0.18 ? 0.4 : 0)));
  return {
    cloudCoverWest: cloudCover, segmentCloudCover: segments.map((segment) => segment.valid ? Math.round(segment.cloud / segment.valid * 100) : null),
    brightness: +skyMean.toFixed(2), contrast: +contrast.toFixed(2), visibilityScore,
    sunlightDetected: sunlightStrength > 0.07, sunlightStrength: +sunlightStrength.toFixed(2), sunlightLevel: sunlightStrength > 0.12 ? "strong" : sunlightStrength > 0.07 ? "moderate" : "weak",
    groundBrightness: +groundMean.toFixed(2), groundContrast: +groundContrast.toFixed(2), visibleStructureSignal: groundContrast >= 0.13 && groundMean >= 0.18,
    buildingCloudStructureSignal: structureScore >= 0.09, buildingCloudStructureScore: +structureScore.toFixed(2), structureCloudEstimate: structureEstimate,
    skyTextureGradient: structureSamples ? +(gradientTotal / structureSamples).toFixed(1) : null,
    softShadowSignal: contrast < 0.09 || (groundContrast < 0.18 && contrast < 0.12), filteredSunshineSignal: sunlightStrength > 0.07 && rawCloud >= 20,
    skyBlueSignal: +(1 + blueShare * 0.35).toFixed(2), blueShare: +blueShare.toFixed(2), precipVisible: false, mode, source: "live-thumbnail",
    qualityScore: +qualityScore.toFixed(2), qualityFlags, skyVisibleShare: +validSkyShare.toFixed(2), glareShare: +glareShare.toFixed(2)
  };
}

function inferCloudTypes(metrics) {
  if (metrics.mode === "night" || metrics.qualityScore < 0.35) return [];
  if (metrics.cloudCoverWest >= 92 && metrics.contrast < 0.09) return [{ type: "stratus", confidence: 0.78 }];
  if (metrics.filteredSunshineSignal && metrics.softShadowSignal) return [{ type: metrics.cloudCoverWest >= 70 ? "altostratus" : "cirrostratus", confidence: 0.7 }];
  if (metrics.buildingCloudStructureScore >= 0.2) return [{ type: "towering_cumulus", confidence: 0.72 }];
  if (metrics.buildingCloudStructureScore >= 0.11 && metrics.cloudCoverWest >= 55) return [{ type: "stratocumulus", confidence: 0.67 }];
  if (metrics.buildingCloudStructureSignal && metrics.cloudCoverWest < 60) return [{ type: "fair_weather_cumulus", confidence: 0.64 }];
  if (metrics.cloudCoverWest < 35 && metrics.softShadowSignal) return [{ type: "cirrus", confidence: 0.58 }];
  return [];
}

function buildDirectional(camera, metrics) {
  const directions = [camera.orientation.left, camera.orientation.center, camera.orientation.right], result = {};
  metrics.segmentCloudCover.forEach((cloud, index) => {
    const direction = directions[index];
    if (direction && Number.isFinite(cloud)) result[direction] = { coverage: coverageLabel(cloud), coverageFraction: cloud / 100, appearance: metrics.blueShare > 0.45 ? "bluer" : metrics.brightness > 0.62 ? "brighter" : "muted" };
  });
  if (!Object.keys(result).length && camera.orientation.center) result[camera.orientation.center] = { coverage: coverageLabel(metrics.cloudCoverWest), coverageFraction: metrics.cloudCoverWest / 100 };
  return result;
}

function buildObservation(camera, metrics, timestamp, qualityOverride = null) {
  const textured = metrics.buildingCloudStructureSignal;
  const lowValleyLayer = camera.capabilities.includes("possible_undercast") && metrics.visibilityScore <= 1 && metrics.visibleStructureSignal && metrics.cloudCoverWest >= 45;
  return {
    source: camera.id, timestamp, available: qualityOverride !== "offline",
    quality: qualityOverride || (metrics.mode === "night" ? "night" : metrics.qualityScore < 0.35 ? "obscured" : "good"), qualityScore: metrics.qualityScore, qualityFlags: metrics.qualityFlags,
    confidence: +Math.min(0.92, metrics.qualityScore * 0.88).toFixed(2), coverage: coverageLabel(metrics.cloudCoverWest), coverageFraction: metrics.cloudCoverWest / 100,
    skyColor: metrics.blueShare > 0.55 ? "blue" : metrics.blueShare > 0.2 ? "blue_gray" : metrics.brightness > 0.72 ? "bright_gray" : "gray",
    cloudTypes: inferCloudTypes(metrics), texture: textured ? [metrics.buildingCloudStructureScore >= 0.2 ? "towering" : "puffy", "textured"] : metrics.filteredSunshineSignal ? ["thin", "layered"] : metrics.cloudCoverWest >= 88 ? ["flat"] : [],
    arrangement: textured ? "scattered_patches" : metrics.filteredSunshineSignal ? "broad_sheet" : null,
    sunVisibility: metrics.sunlightDetected ? metrics.filteredSunshineSignal ? "filtered" : "mostly_unobstructed" : metrics.cloudCoverWest > 75 ? "mostly_hidden" : "uncertain",
    directional: buildDirectional(camera, metrics), ridgeVisibility: metrics.visibilityScore >= 2 || metrics.visibleStructureSignal ? "good" : "moderate",
    valleyVisibility: metrics.visibilityScore >= 2 ? "good" : metrics.visibleStructureSignal ? "moderate" : "poor", undercast: lowValleyLayer ? "possible" : "none"
  };
}

async function fetchAndAnalyze(camera) {
  const separator = camera.snapshotUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${camera.snapshotUrl}${separator}t=${Date.now()}`, { headers: { "user-agent": "828 Weather Direct current sky/2.0", accept: "image/jpeg,image/*" } });
  if (!response.ok) throw new Error(`Live camera fetch failed: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const signature = createHash("sha1").update(buffer).digest("hex"), previous = signatures.get(camera.id);
  const modified = Date.parse(response.headers.get("last-modified") || ""), timestamp = Number.isFinite(modified) ? new Date(modified).toISOString() : new Date().toISOString();
  const frozenCount = previous?.signature === signature ? previous.frozenCount + 1 : 0;
  signatures.set(camera.id, { signature, frozenCount, timestamp });
  const metrics = analyzeFrame(jpeg.decode(buffer, { useTArray: true }), { skyCrop: camera.skyCrop });
  const stale = (Number.isFinite(modified) && Date.now() - modified > MAX_AGE_MS) || frozenCount >= 20;
  const ashevilleHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date()));
  const outsideVisualDaylight = ashevilleHour >= 22 || ashevilleHour < 5;
  const qualityOverride = stale ? "stale" : outsideVisualDaylight ? "night" : null;
  return { camera, metrics, observation: buildObservation(camera, metrics, timestamp, qualityOverride) };
}

async function fetchVisibleWithTimeout() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetchVisibleSatelliteSignal({
      fetchImpl: (url, options = {}) => fetch(url, { ...options, signal: controller.signal })
    });
  } finally {
    clearTimeout(timeout);
  }
}

function compareDirections(observations) {
  const values = {};
  for (const observation of observations) if (!["offline", "night", "stale", "obscured"].includes(observation.quality)) for (const [direction, detail] of Object.entries(observation.directional || {})) (values[direction] ||= []).push(detail.coverageFraction);
  const west = average(values.west || []), east = average(values.east || []);
  if (!Number.isFinite(west) || !Number.isFinite(east)) return { pattern: "limited", difference: null, narrative: null };
  const difference = west - east;
  if (difference >= 0.15) return { pattern: "cloudier-west", difference: Math.round(Math.abs(difference) * 100), narrative: "Clouds are more numerous west of Asheville, while the eastern sky is clearer." };
  if (difference <= -0.15) return { pattern: "cloudier-east", difference: Math.round(Math.abs(difference) * 100), narrative: "Clouds are more numerous east of Asheville, while the western sky is clearer." };
  return { pattern: "similar", difference: Math.round(Math.abs(difference) * 100), narrative: "Cloud cover is fairly similar east and west." };
}

async function buildPayload() {
  const enabled = CAMERA_REGISTRY.filter((camera) => camera.enabled);
  const [settled, satelliteResult] = await Promise.all([
    Promise.allSettled(enabled.map(fetchAndAnalyze)),
    fetchVisibleWithTimeout().then((value) => ({ status: "fulfilled", value })).catch((reason) => ({ status: "rejected", reason }))
  ]);
  const successful = settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
  const failed = settled.flatMap((result, index) => result.status === "rejected" ? [{ source: enabled[index].id, timestamp: new Date().toISOString(), available: false, quality: "offline", qualityScore: 0, confidence: 0, error: result.reason?.message || "Camera unavailable" }] : []);
  if (!successful.length) throw new Error("All current-sky cameras are unavailable");
  const satellite = satelliteResult.status === "fulfilled" ? satelliteResult.value : null;
  const observations = [...successful.map((entry) => entry.observation), ...failed, ...(satellite?.observation ? [satellite.observation] : [])];
  const downtown = successful.find((entry) => entry.camera.id === "downtown-asheville-west"), north = successful.find((entry) => entry.camera.id === "north-asheville-south"), primary = downtown || north;
  const northEast = north?.observation.directional?.east?.coverageFraction, northWest = north?.observation.directional?.west?.coverageFraction;
  const metrics = { ...primary.metrics, cloudCoverWest: downtown?.metrics.cloudCoverWest ?? (Number.isFinite(northWest) ? northWest * 100 : primary.metrics.cloudCoverWest), cloudCoverENE: Number.isFinite(northEast) ? northEast * 100 : null };
  return {
    timestamp: new Date().toISOString(), captureStatus: failed.length ? "partial" : "live", metrics, observations,
    satellite: satellite ? { image: satellite.image, previousImage: satellite.previousImage, observedAt: satellite.observedAt, analysis: satellite.analysis } : null,
    cameraRegistry: CAMERA_REGISTRY.map(({ snapshotUrl, ...camera }) => camera),
    cameras: Object.fromEntries(successful.map((entry) => [entry.camera.id, { label: entry.camera.name, orientation: entry.camera.orientation, metrics: entry.metrics, quality: entry.observation.quality }])),
    directionalComparison: compareDirections(observations), trend: { cloudTrend: "unknown", brightnessTrend: "unknown", overallTrend: "little_change" },
    debug: {
      camerasUsed: successful.map((entry) => entry.camera.id), cameraFailures: failed, observations,
      satelliteFailure: satelliteResult.status === "rejected" ? satelliteResult.reason?.message || "Visible satellite unavailable" : null
    }
  };
}

export default async function handler(req, res) {
  try {
    const now = Date.now();
    if (!memoryCache || now - memoryCache.timestamp > CACHE_MS) memoryCache = { timestamp: now, payload: await buildPayload() };
    res.setHeader("Cache-Control", "s-maxage=45, stale-while-revalidate=45");
    const suppliedDebugToken = req?.headers?.["x-sky-debug-token"];
    const debugAuthorized = process.env.SKY_DEBUG_TOKEN && suppliedDebugToken === process.env.SKY_DEBUG_TOKEN;
    if (debugAuthorized) return res.status(200).json(memoryCache.payload);
    const { debug, ...publicPayload } = memoryCache.payload;
    return res.status(200).json(publicPayload);
  } catch (error) { return res.status(503).json({ error: error.message || "Current sky unavailable" }); }
}

export { analyzeFrame, buildPayload, buildObservation, compareDirections };
