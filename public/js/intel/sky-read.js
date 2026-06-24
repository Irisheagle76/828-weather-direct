import { computeSkyIntel } from "./sky-intel.js";
import { generateSkyNarrative } from "./sky-narrative.js";

export function labelizeSkyState(value) {
  if (!value) return "Unknown";
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSkyPercent(value) {
  if (!Number.isFinite(value)) return "--";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.round(normalized)}%`;
}

export function isObscuredSky(skyIntel) {
  return skyIntel?.cloudCoverReliable === false ||
    skyIntel?.atmosphericState === "fog" ||
    skyIntel?.atmosphericState === "low_cloud";
}

export function skyCloudMetricLabel(skyIntel) {
  if (isObscuredSky(skyIntel)) return "Obscured";
  return formatSkyPercent(skyIntel?.displayCloud ?? skyIntel?.cloud);
}

export function skySunlightMetricLabel(skyIntel) {
  return skyIntel?.sunlightDetected ? labelizeSkyState(skyIntel.sunlightLevel) : "Low";
}

export function buildSkyConditionRead({
  camera,
  previous = null,
  useLiveNarrative = false,
  liveNarrative = null,
  liveLabel = "Live Sky"
} = {}) {
  const skyIntel = computeSkyIntel({ camera, previous });
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
