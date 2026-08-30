import { computeSkyIntel } from "./sky-intel.js?v=20260701-blue-sky-fog-veto";
import { generateSkyNarrative } from "./sky-narrative.js";
import { buildSkyState } from "./sky-state.js?v=20260830-orographic-v2";
import { generateSkyLanguage } from "./sky-language.js?v=20260829-sky-language-prod";

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
  weatherContext = null,
  verbosity = "short",
  surface = "homepage"
} = {}) {
  const computedSkyIntel = applyWeatherContext(computeSkyIntel({ camera, previous, weatherContext }), weatherContext);
  const skyState = buildSkyState({ camera, skyIntel: computedSkyIntel, weatherContext });
  const fogType = skyState?.fogState?.type;
  const fogLikely = ["likely", "confirmed"].includes(skyState?.fogState?.likelihood);
  const hasSharedCoverage = Number.isFinite(skyState?.cloudCoverageFraction);
  const skyIntel = skyState && skyState.overall !== "unknown"
    ? {
        ...(computedSkyIntel || {}),
        cloud: hasSharedCoverage ? skyState.cloudCoverageFraction * 100 : computedSkyIntel?.cloud ?? null,
        displayCloud: hasSharedCoverage ? skyState.cloudCoverageFraction * 100 : computedSkyIntel?.displayCloud ?? null,
        cloudCoverReliable: hasSharedCoverage,
        cloudState: skyState.cloudCoverage,
        atmosphericState: fogLikely ? (fogType === "valley_fog" ? "fog" : fogType === "low_overcast" ? "low_stratus" : skyState.overall) : skyState.overall,
        sunlightDetected: skyState.sunVisibility === "mostly_unobstructed" || skyState.sunVisibility.includes("filtered"),
        sunlightLevel: skyState.sunVisibility === "mostly_unobstructed" ? "strong" : skyState.sunVisibility.includes("filtered") ? "moderate" : "weak",
        visualObscured: skyState.overall === "obscured" || (fogLikely && fogType === "low_overcast"),
        confidence: skyState.confidence,
        sharedSkyState: true
      }
    : computedSkyIntel;
  const language = generateSkyLanguage(skyState, { verbosity, surface });
  const legacyNarrative = generateSkyNarrative(camera, skyIntel);
  const cameraNarrative = typeof language === "string"
    ? {
        headline: language,
        detail: generateSkyLanguage(skyState, { verbosity: "narrative", surface: `${surface}-detail`, remember: false }).observation,
        confidence: skyState.confidence >= 0.75 ? "high" : skyState.confidence >= 0.5 ? "medium" : "low",
        type: skyState.overall
      }
    : language || legacyNarrative;
  const baseNarrative = useLiveNarrative && liveNarrative ? liveNarrative : cameraNarrative;
  const narrative = baseNarrative;
  const label = useLiveNarrative ? liveLabel : labelizeSkyState(skyIntel?.atmosphericState || skyState?.overall);

  return {
    skyIntel,
    skyState,
    narrative,
    label,
    obscured: isObscuredSky(skyIntel),
    cloudMetric: skyCloudMetricLabel(skyIntel) === "--" ? formatSkyPercent(skyState?.cloudCoverageFraction) : skyCloudMetricLabel(skyIntel),
    sunlightMetric: skyIntel ? skySunlightMetricLabel(skyIntel) : labelizeSkyState(skyState?.lightQuality),
    confidenceMetric: formatSkyPercent(skyIntel?.confidence ?? skyState?.confidence)
  };
}
