import { computeSkyIntel } from "./sky-intel.js?v=20260701-blue-sky-fog-veto";
import { generateSkyNarrative } from "./sky-narrative.js";

export function labelizeSkyState(value) {
  if (!value) return "Unknown";
  const labels = {
    mostly_cloudy_filtered: "Mostly Cloudy",
    filtered_sunshine: "Filtered Sun",
    low_stratus: "Low Stratus"
  };
  if (labels[value]) return labels[value];
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSkyPercent(value) {
  if (!Number.isFinite(value)) return "--";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

export function isObscuredSky(skyIntel) {
  return skyIntel?.visualObscured === true ||
    skyIntel?.atmosphericState === "fog" ||
    skyIntel?.atmosphericState === "low_cloud";
}

export function skyCloudMetricLabel(skyIntel) {
  if (isObscuredSky(skyIntel)) return "Obscured";
  if (skyIntel?.cloudMetricLabel) return skyIntel.cloudMetricLabel;
  return formatSkyPercent(skyIntel?.displayCloud ?? skyIntel?.cloud);
}

export function skySunlightMetricLabel(skyIntel) {
  return skyIntel?.sunlightDetected ? labelizeSkyState(skyIntel.sunlightLevel) : "Low";
}

function normalizeSkyPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
}

function applyWeatherContext(skyIntel, weatherContext = null) {
  if (!skyIntel || !weatherContext) return skyIntel;
  const cloud = normalizeSkyPercent(weatherContext.cloudCover ?? weatherContext.clouds);
  if (!Number.isFinite(cloud)) return skyIntel;

  const currentState = skyIntel.atmosphericState;
  const cameraCloud = normalizeSkyPercent(skyIntel.cloud);
  const cameraLooksOpen = !Number.isFinite(cameraCloud) || cameraCloud <= 0.35;
  const openState = ["clear", "mostly_clear", "partly_cloudy", "filtered_sunshine"].includes(currentState);
  const highCloudContext = cloud >= 0.68;
  const overcastContext = cloud >= 0.88;

  if (!highCloudContext || !cameraLooksOpen || !openState) return skyIntel;

  const atmosphericState = overcastContext ? "mostly_cloudy_filtered" : "mostly_cloudy";
  const confidenceFloor = overcastContext ? 0.82 : 0.76;
  return {
    ...skyIntel,
    cloud: cloud * 100,
    displayCloud: cloud * 100,
    cloudCoverReliable: true,
    cloudState: overcastContext ? "overcast" : "mostly_cloudy",
    atmosphericState,
    confidence: Math.max(Number(skyIntel.confidence) || 0, confidenceFloor),
    weatherContextCloudOverride: true,
    cloudMetricLabel: formatSkyPercent(cloud)
  };
}

export function buildSkyConditionRead({
  camera,
  previous = null,
  useLiveNarrative = false,
  liveNarrative = null,
  liveLabel = "Live Sky",
  weatherContext = null
} = {}) {
  const skyIntel = applyWeatherContext(computeSkyIntel({ camera, previous, weatherContext }), weatherContext);
  const cameraNarrative = generateSkyNarrative(camera, skyIntel);
  const narrative = useLiveNarrative && liveNarrative ? liveNarrative : cameraNarrative;
  const label = useLiveNarrative ? liveLabel : labelizeSkyState(skyIntel?.atmosphericState);

  return {
    skyIntel,
    narrative,
    label,
    obscured: isObscuredSky(skyIntel),
    cloudMetric: skyCloudMetricLabel(skyIntel),
    sunlightMetric: skySunlightMetricLabel(skyIntel),
    confidenceMetric: formatSkyPercent(skyIntel?.confidence)
  };
}
