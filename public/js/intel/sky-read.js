import { computeSkyIntel } from "./sky-intel.js?v=20260814-valley-fog";
import { generateSkyNarrative } from "./sky-narrative.js";
import { diagnoseSpatialSky } from "./sky-spatial.js?v=20260814-valley-fog";

export function labelizeSkyState(value) {
  if (!value) return "Unknown";
  const labels = {
    mostly_cloudy_filtered: "Mostly Cloudy",
    filtered_sunshine: "Filtered Sun",
    low_stratus: "Low Stratus",
    rain_shaft: "Rain Shaft",
    clear_smoke: "Clear + Smoke",
    clear_dust: "Clear + Saharan Dust",
    clear_haze: "Clear + Haze",
    VALLEY_FOG_CLEAR_ABOVE: "Valley Fog • Clear Above",
    PATCHY_VALLEY_FOG: "Patchy Valley Fog",
    LOW_STRATUS_CLEAR_ABOVE: "Low Stratus • Clear Above",
    WIDESPREAD_FOG: "Widespread Fog",
    MOUNTAIN_CLOUDS_VALLEYS_CLEAR: "Mountain Clouds • Valleys Clear",
    VARIABLE_SKY_ASHEVILLE: "Variable Sky Across Asheville"
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
    skyIntel?.atmosphericState === "low_cloud" ||
    skyIntel?.atmosphericState === "rain_shaft";
}

export function isTransientValleyFog(skyIntel) {
  return ["VALLEY_FOG_CLEAR_ABOVE", "PATCHY_VALLEY_FOG"].includes(skyIntel?.skyRegime) &&
    skyIntel?.fogDepth === "Shallow" &&
    skyIntel?.sunsetImpact === "minimal";
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
  if (value == null || value === "") return null;
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
  const openState = ["clear", "mostly_clear", "partly_cloudy", "filtered_sunshine", "clear_smoke", "clear_dust", "clear_haze"].includes(currentState);
  const highCloudContext = cloud >= 0.68;
  const overcastContext = cloud >= 0.88;
  const cameraOrSatelliteCorroboratesCloud =
    skyIntel.satelliteHighCloudSignal === true ||
    (skyIntel.filteredSun === true && skyIntel.softShadowSignal === true);

  // Model cloud cover is supporting context, not permission to erase a clear
  // camera read. This is especially important when aerosol haze is present.
  if (skyIntel.aerosolDetected || !highCloudContext || !cameraLooksOpen || !openState || !cameraOrSatelliteCorroboratesCloud) return skyIntel;

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
  const baseSkyIntel = applyWeatherContext(computeSkyIntel({ camera, previous, weatherContext }), weatherContext);
  const spatialSky = diagnoseSpatialSky({ camera, weatherContext, primarySkyIntel: baseSkyIntel });
  const skyIntel = spatialSky
    ? {
        ...baseSkyIntel,
        atmosphericState: spatialSky.regime,
        skyRegime: spatialSky.regime,
        surfaceCondition: spatialSky.surfaceCondition,
        skyAboveLowLayer: spatialSky.skyAboveLowLayer,
        fogDepth: spatialSky.fogDepth,
        fogFootprint: spatialSky.fogFootprint,
        sunsetImpact: spatialSky.sunsetImpact,
        spatialDisagreement: spatialSky.spatialDisagreement,
        spatialObservations: spatialSky.observations,
        satelliteContext: spatialSky.satellite,
        metarContext: spatialSky.metar,
        surfaceObservationContext: spatialSky.surfaceObservationContext,
        metricTiles: spatialSky.metrics,
        confidence: spatialSky.confidence,
        visualObscured: ["VALLEY_FOG_CLEAR_ABOVE", "PATCHY_VALLEY_FOG", "LOW_STRATUS_CLEAR_ABOVE", "WIDESPREAD_FOG"].includes(spatialSky.regime),
        displayCloud: null,
        cloudCoverReliable: false
      }
    : baseSkyIntel;
  const cameraNarrative = spatialSky
    ? { headline: spatialSky.headline, detail: spatialSky.detail, confidence: spatialSky.confidence >= 0.85 ? "high" : "medium", type: "spatial-sky" }
    : generateSkyNarrative(camera, skyIntel);
  const baseNarrative = useLiveNarrative && liveNarrative ? liveNarrative : cameraNarrative;
  const directionalNarrative = skyIntel?.aerosolDetected || spatialSky ? null : camera?.directionalComparison?.narrative;
  const narrative = directionalNarrative
    ? typeof baseNarrative === "string"
      ? `${baseNarrative} ${directionalNarrative}`
      : { ...baseNarrative, detail: `${baseNarrative?.detail || ""} ${directionalNarrative}`.trim() }
    : baseNarrative;
  const label = useLiveNarrative ? liveLabel : spatialSky?.label || labelizeSkyState(skyIntel?.atmosphericState);

  return {
    skyIntel,
    narrative,
    label,
    obscured: isObscuredSky(skyIntel),
    cloudMetric: skyCloudMetricLabel(skyIntel),
    sunlightMetric: skySunlightMetricLabel(skyIntel),
    confidenceMetric: formatSkyPercent(skyIntel?.confidence),
    metricTiles: spatialSky?.metrics || null
  };
}

function firstFinite(source, keys) {
  if (!source) return null;
  for (const key of keys) {
    if (source[key] == null || source[key] === "") continue;
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

export function buildSkyObservationContext({
  hour = null,
  current = null,
  airQuality = null,
  radar = null,
  satellite = null,
  metar = null,
  surfaceObservations = null
} = {}) {
  if (!hour && !current && !airQuality && !radar && !satellite && !metar && !surfaceObservations) return null;
  const solarSource = current || hour || {};
  return {
    cloudCover: normalizeSkyPercent(firstFinite(hour, ["cloudCover", "cloud_cover", "cloudcover"])),
    humidity: normalizeSkyPercent(
      firstFinite(hour, ["relativeHumidity", "relative_humidity", "humidity"]) ??
      firstFinite(current, ["relativeHumidity", "relative_humidity", "humidity"])
    ),
    precipProbability: normalizeSkyPercent(firstFinite(hour, ["precipProbability", "precipitation_probability", "probabilityOfPrecipitation"])),
    precipAmount: firstFinite(hour, ["precipAmount", "precipitation", "rain"]) ??
      firstFinite(current, ["precipAmount", "precipitation", "precipRate"]) ?? 0,
    solarRadiation: firstFinite(solarSource, ["solarRadiation", "solar_radiation", "solarWm2", "solar"]),
    uvIndex: firstFinite(solarSource, ["uvIndex", "uv_index", "uv"]),
    weatherCode: firstFinite(hour, ["weatherCode", "weather_code"]) ??
      firstFinite(current, ["weatherCode", "weather_code"]),
    airQuality,
    radar,
    satellite,
    metar,
    surfaceObservations
  };
}
