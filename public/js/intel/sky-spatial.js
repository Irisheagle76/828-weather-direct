import { computeSkyIntel } from "./sky-intel.js?v=20260814-valley-fog";

const SURFACE_ROLES = new Set(["surface-valley"]);
const ELEVATED_ROLES = new Set(["elevated-valley-view", "mountain-view"]);
const PERIPHERAL_ROLES = new Set([
  "southern-buncombe",
  "eastern-buncombe",
  "western-buncombe",
  "regional-context"
]);

const FOG_STATES = new Set(["patchy_fog", "fog", "dense_fog"]);
const LOW_LAYER_STATES = new Set([...FOG_STATES, "low_cloud", "low_stratus"]);
const OPEN_STATES = new Set(["clear", "mostly_clear", "partly_cloudy"]);

const STATE_ALIASES = {
  sunny: "clear",
  mostly_sunny: "mostly_clear",
  foggy: "fog",
  dense_fog: "dense_fog",
  patchy_fog: "patchy_fog",
  low_cloud: "low_cloud",
  low_stratus: "low_stratus",
  cloudy: "mostly_cloudy",
  clear_above: "clear",
  mostly_clear_above: "mostly_clear",
  partly_cloudy_above: "partly_cloudy",
  cloudy_above: "mostly_cloudy"
};

const SURFACE_LABELS = {
  clear: "Clear",
  mostly_clear: "Mostly Clear",
  partly_cloudy: "Partly Cloudy",
  mostly_cloudy: "Mostly Cloudy",
  overcast: "Overcast",
  clear_haze: "Haze",
  patchy_fog: "Patchy Fog",
  fog: "Fog",
  dense_fog: "Dense Fog",
  low_cloud: "Low Stratus",
  low_stratus: "Low Stratus"
};

const ABOVE_LABELS = {
  clear: "Clear Above",
  mostly_clear: "Mostly Clear Above",
  partly_cloudy: "Partly Cloudy Above",
  mostly_cloudy: "Cloudy Above",
  overcast: "Cloudy Above"
};

function normalizeState(value) {
  if (!value) return "unknown";
  const state = String(value).trim().toLowerCase().replace(/[\s-]+/g, "_");
  return STATE_ALIASES[state] || state;
}

function cameraMetrics(camera = {}) {
  const metrics = camera.metrics || {};
  if (metrics.cloudCoverWest != null || metrics.cloudCoverENE == null) return metrics;
  return { ...metrics, cloudCoverWest: metrics.cloudCoverENE };
}

function classifyCamera(camera, weatherContext) {
  const explicit = normalizeState(camera.classification || camera.condition || camera.state);
  if (explicit !== "unknown") return explicit;
  const metrics = cameraMetrics(camera);
  if (!Object.keys(metrics).length) return "unknown";
  return computeSkyIntel({ camera: { ...camera, metrics }, weatherContext })?.atmosphericState || "unknown";
}

function observationList(camera, weatherContext) {
  const entries = Object.entries(camera?.cameras || {}).map(([key, value]) => ({
    id: value?.id || value?.metadata?.id || key,
    ...value,
    metadata: { id: value?.id || value?.metadata?.id || key, ...(value?.metadata || {}) }
  }));

  if (!entries.length && camera?.metrics) {
    entries.push({
      id: camera?.metadata?.id || "primary-camera",
      metrics: camera.metrics,
      metadata: camera.metadata || { role: "surface-valley", region: "asheville" }
    });
  }

  return entries.map((entry) => ({
    ...entry,
    role: entry.metadata?.role || entry.role || "regional-context",
    region: entry.metadata?.region || entry.region || "unknown",
    elevationFt: entry.metadata?.elevationFt != null && Number.isFinite(Number(entry.metadata.elevationFt))
      ? Number(entry.metadata.elevationFt)
      : null,
    classification: classifyCamera(entry, weatherContext)
  }));
}

function bestOpenState(observations) {
  const states = observations.map((item) => item.classification).filter((state) => OPEN_STATES.has(state));
  if (states.includes("clear")) return "clear";
  if (states.includes("mostly_clear")) return "mostly_clear";
  if (states.includes("partly_cloudy")) return "partly_cloudy";
  return null;
}

function strongestSurfaceState(observations) {
  const states = observations.map((item) => item.classification);
  for (const state of ["dense_fog", "fog", "low_stratus", "low_cloud", "patchy_fog"]) {
    if (states.includes(state)) return state;
  }
  return states.find((state) => state !== "unknown") || "unknown";
}

function satelliteContext(camera, weatherContext) {
  const satellite = camera?.satellite || weatherContext?.satellite || null;
  if (!satellite || satellite.available === false) return null;
  if (satellite.illuminated === false && /visible/i.test(String(satellite.product || ""))) return null;
  const footprint = normalizeState(satellite.footprint || satellite.extent);
  return {
    ...satellite,
    footprint,
    terrainConfined: satellite.terrainConfined === true || ["localized", "valley_confined"].includes(footprint),
    clearAbove: satellite.clearAbove === true
  };
}

function metarContext(camera, weatherContext) {
  const metar = camera?.metar || weatherContext?.metar || null;
  if (!metar) return null;
  return { ...metar, classification: normalizeState(metar.classification || metar.condition) };
}

function surfaceObservationContext(camera, weatherContext) {
  const collection = camera?.surfaceObservations || weatherContext?.surfaceObservations || {};
  const observations = Array.isArray(collection) ? collection : Object.values(collection);
  const fresh = observations.filter((item) => item && item.stale !== true);
  return {
    observations: fresh,
    saturationSupport: fresh.some((item) => item.fogSupport === true || item.saturationSignal === true),
    downtownSaturationSupport: fresh.some((item) =>
      item.metadata?.region === "downtown-asheville" &&
      (item.fogSupport === true || item.saturationSignal === true)
    )
  };
}

function sunlightFrom(observations) {
  const levels = observations.map((item) => String(item.metrics?.sunlightLevel || "").toLowerCase());
  if (levels.includes("strong")) return "Strong";
  if (levels.includes("moderate")) return "Moderate";
  if (observations.some((item) => item.metrics?.sunlightDetected === true)) return "Detected";
  return "Unknown";
}

function buildMetrics({ surfaceLabel, aboveLabel, fogDepth, footprint, sunlight, confidence }) {
  return [
    { key: "surface", label: "Low cloud / fog", value: surfaceLabel },
    { key: "above", label: "Sky above", value: aboveLabel.replace(/ Above$/, "") },
    { key: "depth", label: "Fog depth", value: fogDepth },
    { key: "sunlight", label: "Sunlight signal", value: sunlight },
    { key: "footprint", label: "Fog footprint", value: footprint },
    { key: "confidence", label: "Sky read confidence", value: confidence >= 0.85 ? "High" : confidence >= 0.68 ? "Medium" : "Low" }
  ];
}

export function diagnoseSpatialSky({ camera, weatherContext = null, primarySkyIntel = null } = {}) {
  const observations = observationList(camera, weatherContext);
  const surface = observations.filter((item) => SURFACE_ROLES.has(item.role));
  const elevated = observations.filter((item) => ELEVATED_ROLES.has(item.role));
  const peripheral = observations.filter((item) => PERIPHERAL_ROLES.has(item.role));
  const satellite = satelliteContext(camera, weatherContext);
  const metar = metarContext(camera, weatherContext);
  const surfaceContext = surfaceObservationContext(camera, weatherContext);
  const surfaceState = strongestSurfaceState(surface);
  const surfaceLowLayer = LOW_LAYER_STATES.has(surfaceState);
  const surfaceFog = FOG_STATES.has(surfaceState);
  const surfaceOpen = bestOpenState(surface);
  const elevatedOpen = bestOpenState(elevated);
  const peripheralOpen = bestOpenState(peripheral);
  const kavlOpen = metar && OPEN_STATES.has(metar.classification);
  const satelliteLocalized = satellite?.terrainConfined === true;
  const satelliteRegional = ["regional", "widespread"].includes(satellite?.footprint);
  const coherentLocalization = Boolean(elevatedOpen || peripheralOpen || kavlOpen || satelliteLocalized);

  let regime = null;
  let disagreementCause = null;
  const aboveState = elevatedOpen || (satellite?.clearAbove ? "mostly_clear" : null);

  if (surfaceFog && satelliteRegional) {
    regime = "WIDESPREAD_FOG";
    disagreementCause = "widespread_fog";
  } else if (surfaceFog && elevatedOpen) {
    regime = "VALLEY_FOG_CLEAR_ABOVE";
    disagreementCause = "valley_fog";
  } else if (["low_cloud", "low_stratus"].includes(surfaceState) && elevatedOpen) {
    regime = "LOW_STRATUS_CLEAR_ABOVE";
    disagreementCause = "localized_low_stratus";
  } else if (surfaceFog && coherentLocalization) {
    regime = "PATCHY_VALLEY_FOG";
    disagreementCause = "valley_fog";
  } else if (surfaceOpen && elevated.some((item) => ["fog", "low_cloud", "low_stratus", "overcast"].includes(item.classification))) {
    regime = "MOUNTAIN_CLOUDS_VALLEYS_CLEAR";
    disagreementCause = "mountain_obscuration";
  } else {
    const usableStates = new Set(surface.map((item) => item.classification).filter((state) => state !== "unknown"));
    const hasMeaningfulSurfaceSplit =
      [...usableStates].some((state) => LOW_LAYER_STATES.has(state)) &&
      [...usableStates].some((state) => OPEN_STATES.has(state));
    if (hasMeaningfulSurfaceSplit && surface.length >= 2) {
      regime = "VARIABLE_SKY_ASHEVILLE";
      disagreementCause = "genuinely_conflicting";
    }
  }

  if (!regime) return null;

  const localized = !satelliteRegional && (
    satelliteLocalized ||
    Boolean(peripheralOpen || kavlOpen) ||
    Boolean(surfaceLowLayer && elevatedOpen)
  );
  const fogDepth = surfaceLowLayer && elevatedOpen ? "Shallow" : "Unknown";
  const footprint = satellite?.footprint === "widespread"
    ? "Western North Carolina"
    : satellite?.footprint === "regional"
      ? "Much of Buncombe County"
      : localized
        ? "Mainly Asheville valleys"
        : "Asheville area";
  const surfaceLabel = surfaceLowLayer
    ? localized ? "Asheville valleys" : SURFACE_LABELS[surfaceState]
    : SURFACE_LABELS[surfaceState] || "Variable";
  const aboveLabel = ABOVE_LABELS[aboveState] || "Indeterminate";
  const evidenceCount = [
    surfaceLowLayer,
    Boolean(elevatedOpen),
    Boolean(satellite),
    Boolean(peripheralOpen),
    Boolean(kavlOpen),
    surfaceLowLayer && surfaceContext.downtownSaturationSupport
  ]
    .filter(Boolean).length;
  const coherent = disagreementCause !== "genuinely_conflicting";
  const confidence = coherent
    ? Math.min(0.94, evidenceCount >= 4 ? 0.92 : evidenceCount === 3 ? 0.88 : 0.8)
    : Math.min(Number(primarySkyIntel?.confidence) || 0.55, 0.62);
  const sunlight = sunlightFrom(elevatedOpen ? elevated : observations);

  let label = "Variable Sky Across Asheville";
  let headline = "Sky conditions vary across Asheville right now.";
  let detail = "The available views do not yet support a single sky-cover description for the whole area.";

  if (regime === "VALLEY_FOG_CLEAR_ABOVE") {
    label = "Valley Fog • Clear Above";
    headline = "Shallow fog blankets parts of Asheville, with bright skies just above it.";
    detail = `Fog is concentrated in the Asheville basin and nearby river valleys. Elevated cameras show the layer is shallow, with ${aboveLabel.toLowerCase().replace(" above", "")} skies immediately above it.${surfaceContext.downtownSaturationSupport ? " The Grove Arcade observation confirms saturated air at valley level." : ""}${peripheralOpen || kavlOpen ? " Southern Buncombe County remains largely fog-free." : ""}`;
  } else if (regime === "PATCHY_VALLEY_FOG") {
    label = "Patchy Valley Fog";
    headline = "Fog is affecting parts of Asheville while nearby areas remain clearer.";
    detail = "The low cloud is localized around the Asheville basin and river valleys rather than covering all of Buncombe County.";
  } else if (regime === "LOW_STRATUS_CLEAR_ABOVE") {
    label = "Low Stratus • Clear Above";
    headline = "A shallow low cloud deck covers parts of Asheville, with brighter sky above it.";
    detail = "Valley-level views are beneath low stratus while elevated cameras show the layer does not extend far above the basin.";
  } else if (regime === "WIDESPREAD_FOG") {
    label = "Widespread Fog";
    headline = "Fog and low cloud are widespread across the Asheville area.";
    detail = "Available surface and satellite evidence supports a broader low-cloud layer, not just an isolated valley pocket.";
  } else if (regime === "MOUNTAIN_CLOUDS_VALLEYS_CLEAR") {
    label = "Mountain Clouds • Valleys Clear";
    headline = "Valleys are relatively clear while clouds cling to higher terrain.";
    detail = "The difference between valley and mountain views is consistent with terrain-focused cloud cover.";
  }

  return {
    regime,
    label,
    headline,
    detail,
    surfaceCondition: SURFACE_LABELS[surfaceState] || "Indeterminate",
    skyAboveLowLayer: aboveLabel,
    fogDepth,
    fogFootprint: footprint,
    sunlightSignal: sunlight,
    confidence,
    sunsetImpact: surfaceLowLayer && fogDepth === "Shallow" && localized ? "minimal" : "normal",
    observations,
    satellite,
    metar,
    surfaceObservationContext: surfaceContext,
    spatialDisagreement: {
      detected: true,
      coherent,
      cause: disagreementCause,
      explanation: coherent
        ? "The observations differ in a way that is consistent with terrain and elevation."
        : "The available observations conflict without a well-supported terrain explanation."
    },
    metrics: buildMetrics({ surfaceLabel, aboveLabel, fogDepth, footprint, sunlight, confidence })
  };
}
