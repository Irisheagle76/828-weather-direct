const CLOUD_TYPES = new Set([
  "cirrus", "cirrostratus", "altocumulus", "altostratus",
  "fair_weather_cumulus", "cumulus", "towering_cumulus",
  "stratocumulus", "stratus", "cumulonimbus"
]);

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function fraction(value) {
  const number = finite(value);
  if (number == null) return null;
  return Math.max(0, Math.min(1, number > 1 ? number / 100 : number));
}

function timestamp(value) {
  if (Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function solarPhase(now, sunriseAt, sunsetAt) {
  const sunrise = timestamp(sunriseAt);
  const sunset = timestamp(sunsetAt);
  if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) return null;
  const minute = 60 * 1000;
  if (now < sunrise - 60 * minute) return "night";
  if (now < sunrise) return "first_light";
  if (now < sunrise + 90 * minute) return "rising";
  if (now < sunrise + 3 * 60 * minute) return "morning";
  if (now < sunset - 3 * 60 * minute) return "day";
  if (now < sunset - 75 * minute) return "lowering";
  if (now < sunset + 10 * minute) return "setting";
  if (now < sunset + 60 * minute) return "afterglow";
  return "night";
}

function buildSolarRead({ now, weatherContext, cameraVisual, directional, fallbackSunVisibility }) {
  const phase = solarPhase(now, weatherContext?.sunriseAt ?? weatherContext?.sunrise, weatherContext?.sunsetAt ?? weatherContext?.sunset);
  if (!phase) return null;
  const direction = ["first_light", "rising", "morning"].includes(phase)
    ? "east"
    : ["lowering", "setting", "afterglow"].includes(phase) ? "west" : null;
  const directionalSky = direction ? directional[direction] || null : null;
  const candidates = direction
    ? cameraVisual.filter((observation) => observation.directional?.[direction])
      .sort((a, b) => (finite(b.qualityScore) ?? 0) - (finite(a.qualityScore) ?? 0))
    : [];
  const cameraObservation = candidates[0] || null;
  const sunVisibility = cameraObservation?.sunVisibility || fallbackSunVisibility || "uncertain";
  const visibility = sunVisibility === "mostly_unobstructed"
    ? "visible"
    : ["filtered", "occasionally_filtered"].includes(sunVisibility)
      ? "filtered"
      : ["mostly_hidden", "obscured"].includes(sunVisibility) ? "hidden" : "indeterminate";
  const directSunObserved = Boolean(
    cameraObservation &&
    ["rising", "morning", "lowering", "setting"].includes(phase) &&
    ["visible", "filtered"].includes(visibility)
  );
  const horizon = directionalSky?.coverageFraction == null
    ? "unknown"
    : directionalSky.coverageFraction < 0.35 ? "open" : directionalSky.coverageFraction < 0.75 ? "partly_open" : "blocked";
  return {
    phase,
    direction,
    visibility,
    directSunObserved,
    horizon,
    directionalCloudFraction: directionalSky?.coverageFraction ?? null,
    cameraSource: cameraObservation?.source || null
  };
}

function coverageName(value) {
  if (value == null) return "unknown";
  if (value < 0.08) return "clear";
  if (value < 0.25) return "few";
  if (value < 0.5) return "scattered";
  if (value < 0.78) return "broken";
  if (value < 0.94) return "mostly_cloudy";
  return "overcast";
}

function overallName(value, obscured) {
  if (obscured) return "obscured";
  if (value == null) return "unknown";
  if (value < 0.12) return "clear";
  if (value < 0.35) return "mostly_clear";
  if (value < 0.65) return "partly_cloudy";
  if (value < 0.9) return "mostly_cloudy";
  return "overcast";
}

function normalizeCloudTypes(observation) {
  const types = Array.isArray(observation?.cloudTypes) ? observation.cloudTypes : [];
  return types.map((entry) => typeof entry === "string" ? { type: entry, confidence: 0.55 } : entry)
    .filter((entry) => CLOUD_TYPES.has(entry?.type) && finite(entry.confidence) >= 0.35);
}

function synthesizedObservation(camera, skyIntel) {
  const metrics = camera?.metrics || {};
  if (!camera || !Object.keys(metrics).length) return null;
  const cloud = fraction(skyIntel?.displayCloud ?? skyIntel?.cloud ?? metrics.cloudCoverWest);
  const filtered = skyIntel?.filteredSun || metrics.filteredSunshineSignal;
  const lowDeck = ["fog", "low_cloud", "low_stratus"].includes(skyIntel?.atmosphericState);
  const cloudTypes = lowDeck
    ? [{ type: skyIntel?.atmosphericState === "low_stratus" ? "stratus" : "stratus", confidence: 0.72 }]
    : filtered
      ? [{ type: metrics.satelliteHighCloudSignal ? "cirrostratus" : "altostratus", confidence: 0.64 }]
      : metrics.buildingCloudStructureSignal
        ? [{ type: "cumulus", confidence: 0.58 }]
        : [];
  return {
    source: "legacy-west-camera",
    timestamp: camera.timestamp || null,
    available: metrics.mode !== "night",
    quality: metrics.mode === "night" ? "night" : "usable",
    qualityScore: metrics.mode === "night" ? 0 : 0.65,
    confidence: finite(skyIntel?.confidence) ?? 0.6,
    coverage: coverageName(cloud),
    coverageFraction: cloud,
    skyColor: finite(metrics.skyBlueSignal) > 1.16 ? "blue" : finite(metrics.brightness) < 0.45 ? "gray" : "blue_gray",
    texture: metrics.buildingCloudStructureSignal ? ["textured", "puffy"] : filtered ? ["thin", "layered"] : [],
    cloudTypes,
    sunVisibility: skyIntel?.sunlightDetected
      ? filtered ? "filtered" : "mostly_unobstructed"
      : cloud != null && cloud > 0.8 ? "mostly_hidden" : "uncertain",
    ridgeVisibility: skyIntel?.visualObscured ? "poor" : "good",
    valleyVisibility: skyIntel?.visualObscured ? "poor" : "good",
    undercast: "none",
    directional: camera.directional || null
  };
}

function usableObservation(observation, now) {
  if (!observation || observation.available === false) return false;
  if (["offline", "night", "dark", "stale", "obscured"].includes(observation.quality)) return false;
  if ((finite(observation.qualityScore) ?? 0.5) < 0.3) return false;
  const timestamp = Date.parse(observation.timestamp || "");
  const maxAge = observation.kind === "satellite" ? 20 : 15;
  return !Number.isFinite(timestamp) || now - timestamp <= maxAge * 60 * 1000;
}

function weatherObservation(weatherContext) {
  const cloud = fraction(weatherContext?.cloudCover ?? weatherContext?.clouds);
  if (cloud == null) return null;
  return {
    source: "weather-context",
    available: true,
    quality: "model",
    qualityScore: 0.45,
    confidence: 0.5,
    coverage: coverageName(cloud),
    coverageFraction: cloud,
    cloudTypes: [],
    texture: [],
    sunVisibility: cloud < 0.35 ? "mostly_unobstructed" : cloud < 0.75 ? "occasionally_filtered" : "mostly_hidden",
    undercast: "none"
  };
}

function fogCorroboration(weatherContext, cameraVisual) {
  const humidity = fraction(weatherContext?.humidity ?? weatherContext?.relativeHumidity);
  const temperature = finite(weatherContext?.temperature ?? weatherContext?.temperatureF);
  const dewPoint = finite(weatherContext?.dewPoint ?? weatherContext?.dewpoint ?? weatherContext?.dewPointF);
  const visibility = finite(weatherContext?.visibility);
  const weatherCode = Number(weatherContext?.weatherCode);
  const saturated = humidity != null && humidity >= 0.92;
  const tightDewPointSpread = temperature != null && dewPoint != null && Math.abs(temperature - dewPoint) <= 3;
  const fogCode = weatherCode === 45 || weatherCode === 48;
  const lowVisibility = visibility != null && (visibility <= 3 || (visibility > 100 && visibility <= 5000));
  const valleyObscured = cameraVisual.some((observation) => observation.valleyVisibility === "poor");
  const ridgeValleyContrast = cameraVisual.some((observation) => observation.ridgeVisibility === "good" && observation.valleyVisibility === "poor");
  const cameraLowDeck = cameraVisual.some((observation) => {
    const coverage = fraction(observation.coverageFraction);
    return coverage != null && coverage >= 0.82 && (observation.texture || []).some((value) => value === "flat" || value === "layered");
  });
  const drySurface =
    (humidity != null && humidity <= 0.85) ||
    (temperature != null && dewPoint != null && Math.abs(temperature - dewPoint) >= 6);
  const clearOpenCamera = cameraVisual.some((observation) => {
    const coverage = fraction(observation.coverageFraction);
    const directionalCoverage = Object.values(observation.directional || {})
      .map((detail) => fraction(detail?.coverageFraction ?? detail?.cloudCover ?? detail?.coverage))
      .filter((value) => value != null);
    const directionalOpen = directionalCoverage.length >= 2 &&
      directionalCoverage.every((value) => value <= 0.5);
    const openSky = observation.skyColor === "blue" || observation.sunVisibility === "mostly_unobstructed";
    return observation.valleyVisibility === "good" &&
      observation.ridgeVisibility === "good" &&
      observation.undercast === "none" &&
      (coverage == null || coverage <= 0.5 || directionalOpen) &&
      openSky;
  });
  const evidence = [];
  if (saturated) evidence.push("high_surface_humidity");
  if (tightDewPointSpread) evidence.push("temperature_dewpoint_convergence");
  if (fogCode) evidence.push("surface_fog_observation");
  if (lowVisibility) evidence.push("reduced_surface_visibility");
  if (valleyObscured) evidence.push("camera_valley_obscuration");
  if (ridgeValleyContrast) evidence.push("camera_ridge_valley_contrast");
  if (cameraLowDeck) evidence.push("camera_low_cloud_deck");
  return {
    evidence,
    saturated,
    fogCode,
    lowVisibility,
    valleyObscured,
    ridgeValleyContrast,
    cameraLowDeck,
    drySurface,
    clearOpenCamera
  };
}

function reconcileFog(satelliteObservation, weatherContext, cameraVisual) {
  const satellite = satelliteObservation?.satelliteLowCloud;
  const empty = { type: "none", likelihood: "none", confidence: 0, trend: "unknown", evidence: [] };
  if (!satellite || satellite.quality !== "good") return empty;
  const corroboration = fogCorroboration(weatherContext, cameraVisual);
  const surfaceSupport = corroboration.saturated || corroboration.fogCode || corroboration.lowVisibility;
  const valleySupport = surfaceSupport || corroboration.valleyObscured;
  const deckSupport = surfaceSupport || corroboration.cameraLowDeck;
  const valleyScore = finite(satellite.valleyFogScore) ?? 0;
  const deckScore = finite(satellite.broadLowCloudScore) ?? 0;
  const clearValleyCameras = cameraVisual.filter((observation) =>
    observation.valleyVisibility === "good" && observation.undercast === "none"
  );
  const clearValleyConsensus = cameraVisual.length >= 2 && clearValleyCameras.length === cameraVisual.length;
  const convectiveCloudSignal = cameraVisual.some((observation) =>
    (observation.texture || []).includes("towering")
    || normalizeCloudTypes(observation).some(({ type }) => type === "towering_cumulus" || type === "cumulonimbus")
  );
  const clearDryContradiction =
    corroboration.drySurface &&
    corroboration.clearOpenCamera &&
    !surfaceSupport &&
    !corroboration.cameraLowDeck;
  if (clearDryContradiction) {
    return {
      ...empty,
      trend: satellite.trend || "unknown",
      evidence: ["clear_dry_camera_contradiction"]
    };
  }
  const clearValleyContradiction = clearValleyConsensus && !surfaceSupport && !corroboration.cameraLowDeck;
  const contradictedValleySignal = clearValleyContradiction && (convectiveCloudSignal
    || (satellite.trend === "dissipating" && valleyScore < 0.6));
  const preferValley = satellite.valleyPattern !== "none" && (satellite.broadDeck === "none" || valleyScore >= deckScore - 0.1);
  let type = "none", likelihood = "none";
  if (preferValley && !contradictedValleySignal) {
    type = "valley_fog";
    likelihood = satellite.valleyPattern === "likely" ? (valleySupport ? "confirmed" : "possible") : (valleySupport ? "likely" : "possible");
  } else if (satellite.broadDeck !== "none") {
    type = "low_overcast";
    likelihood = satellite.broadDeck === "likely" ? (deckSupport ? "confirmed" : "possible") : (deckSupport ? "likely" : "possible");
  }
  if (type === "none") return empty;
  const evidence = [type === "valley_fog" ? "visible_satellite_valley_signature" : "visible_satellite_broad_deck", ...corroboration.evidence];
  const confidence = Math.min(0.96, (finite(satellite.confidence) ?? 0.5) + (likelihood === "confirmed" ? 0.12 : likelihood === "likely" ? 0.04 : -0.08));
  return { type, likelihood, confidence: Number(Math.max(0, confidence).toFixed(2)), trend: satellite.trend || "unknown", evidence };
}

function reconcileDirectional(observations) {
  const buckets = {};
  for (const observation of observations) {
    for (const [direction, detail] of Object.entries(observation.directional || {})) {
      if (!detail || !["east", "south", "west", "overhead"].includes(direction)) continue;
      const coverage = fraction(detail.coverageFraction ?? detail.cloudCover ?? detail.coverage);
      if (coverage == null) continue;
      const weight = (finite(observation.qualityScore) ?? 0.5) * (finite(observation.confidence) ?? 0.5);
      (buckets[direction] ||= []).push({ coverage, weight, detail });
    }
  }
  return Object.fromEntries(Object.entries(buckets).map(([direction, entries]) => {
    const weight = entries.reduce((sum, entry) => sum + entry.weight, 0) || 1;
    const cloud = entries.reduce((sum, entry) => sum + entry.coverage * entry.weight, 0) / weight;
    return [direction, {
      coverage: coverageName(cloud),
      coverageFraction: Number(cloud.toFixed(2)),
      appearance: entries.at(-1)?.detail?.appearance || null,
      confidence: Number(Math.min(0.95, weight / entries.length + 0.2).toFixed(2))
    }];
  }));
}

export function buildSkyState({ camera = null, skyIntel = null, weatherContext = null, now = Date.now() } = {}) {
  const supplied = Array.isArray(camera?.observations) ? camera.observations : [];
  const fallback = supplied.length ? null : synthesizedObservation(camera, skyIntel);
  const allObservations = [...supplied, ...(fallback ? [fallback] : [])];
  const visual = allObservations.filter((observation) => usableObservation(observation, now));
  const satelliteObservation = visual.find((observation) => observation.kind === "satellite") || null;
  const cameraVisual = visual.filter((observation) => observation.kind !== "satellite");
  const weather = weatherObservation(weatherContext);
  const inputs = [...cameraVisual, ...(weather ? [weather] : [])];
  const weighted = inputs.map((observation) => ({
    observation,
    cloud: fraction(observation.coverageFraction),
    weight: (finite(observation.qualityScore) ?? 0.45) * (finite(observation.confidence) ?? 0.5)
  })).filter((entry) => entry.cloud != null && entry.weight > 0);
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const cloud = totalWeight ? weighted.reduce((sum, entry) => sum + entry.cloud * entry.weight, 0) / totalWeight : null;
  const directional = reconcileDirectional(cameraVisual);
  const cloudTypes = cameraVisual.flatMap(normalizeCloudTypes)
    .sort((a, b) => b.confidence - a.confidence)
    .filter((entry, index, list) => list.findIndex((candidate) => candidate.type === entry.type) === index);
  const dominantCloud = cloudTypes[0] || null;
  const textures = [...new Set(cameraVisual.flatMap((observation) => observation.texture || []))];
  const bestVisual = [...cameraVisual].sort((a, b) => (finite(b.qualityScore) ?? 0) - (finite(a.qualityScore) ?? 0))[0];
  const obscured = skyIntel?.visualObscured === true && cameraVisual.length === 0;
  const fogState = reconcileFog(satelliteObservation, weatherContext, cameraVisual);
  const undercastRank = { none: 0, possible: 1, likely: 2, confirmed: 3 };
  // Satellite low-cloud hints are reconciled through fogState above. Keeping
  // them out of this camera-only fallback prevents a rejected terrain-shaped
  // convective signal from reappearing as generic "undercast" language.
  const undercastEvidence = cameraVisual.map((observation) => observation.undercast || "none");
  const strongestUndercast = undercastEvidence.sort((a, b) => (undercastRank[b] || 0) - (undercastRank[a] || 0))[0] || "none";
  const undercast = strongestUndercast === "confirmed" && undercastEvidence.filter((value) => value !== "none").length < 2
    ? "likely"
    : strongestUndercast;
  const fogUndercast = fogState.type === "valley_fog" && fogState.likelihood !== "possible" && fogCorroboration(weatherContext, cameraVisual).ridgeValleyContrast
    ? "likely"
    : fogState.type === "valley_fog" && fogState.likelihood !== "none" ? "possible" : "none";
  const reconciledUndercast = (undercastRank[fogUndercast] || 0) > (undercastRank[undercast] || 0) ? fogUndercast : undercast;
  const trendMap = { improving: "clearing", deteriorating: "clouds_increasing", sun_breaking_through: "clearing" };
  const trend = trendMap[skyIntel?.transition] || camera?.trend?.overallTrend || "little_change";
  const confidence = weighted.length
    ? Math.min(0.95, weighted.reduce((sum, entry) => sum + entry.weight, 0) / weighted.length + (visual.length > 1 ? 0.12 : 0))
    : 0.3;
  const skyColor = bestVisual?.skyColor || (cloud != null && cloud > 0.88 ? "gray" : cloud != null && cloud < 0.35 ? "blue" : "blue_gray");
  const sunVisibility = bestVisual?.sunVisibility || (cloud == null ? "uncertain" : cloud < 0.3 ? "mostly_unobstructed" : cloud < 0.7 ? "occasionally_filtered" : "mostly_hidden");
  const west = directional.west;
  const solarRead = buildSolarRead({ now, weatherContext, cameraVisual, directional, fallbackSunVisibility: sunVisibility });

  return {
    schemaVersion: 1,
    timestamp: camera?.timestamp || new Date(now).toISOString(),
    overall: overallName(cloud, obscured),
    skyColor,
    cloudCoverage: coverageName(cloud),
    cloudCoverageFraction: cloud == null ? null : Number(cloud.toFixed(2)),
    cloudTypes: cloudTypes.map((entry) => entry.type),
    cloudTypeConfidence: Object.fromEntries(cloudTypes.map((entry) => [entry.type, Number(entry.confidence.toFixed(2))])),
    dominantCloudType: dominantCloud?.type || null,
    texture: textures,
    arrangement: bestVisual?.arrangement || null,
    sunVisibility,
    solarRead,
    lightQuality: sunVisibility === "mostly_unobstructed" ? "crisp" : sunVisibility.includes("filtered") ? "filtered" : "muted",
    horizon: west ? (west.coverageFraction < 0.35 ? "clear_west" : west.coverageFraction > 0.75 ? "cloudy_west" : "partly_open_west") : "unknown",
    depth: textures.some((value) => ["textured", "puffy", "lumpy", "layered"].includes(value)) ? "good_texture" : cloud != null && cloud > 0.9 ? "flat" : "soft",
    directional,
    ridgeVisibility: bestVisual?.ridgeVisibility || "unknown",
    valleyVisibility: bestVisual?.valleyVisibility || "unknown",
    undercast: reconciledUndercast,
    possibleUndercast: reconciledUndercast !== "none",
    fogState,
    trend,
    confidence: Number(confidence.toFixed(2)),
    sunsetStructure: {
      westernHorizon: west?.coverageFraction == null ? "unknown" : west.coverageFraction < 0.35 ? "open" : west.coverageFraction < 0.75 ? "partly_open" : "blocked",
      lightCanReachHorizon: !["mostly_hidden", "obscured"].includes(sunVisibility),
      textureAvailable: textures.length > 0 || (cloud != null && cloud >= 0.25 && cloud <= 0.8)
    },
    sources: [...inputs.map((observation) => observation.source), ...(satelliteObservation ? [satelliteObservation.source] : [])],
    debug: {
      camerasUsed: cameraVisual.map((observation) => observation.source),
      satelliteUsed: satelliteObservation?.source || null,
      camerasRejected: allObservations.filter((observation) => !visual.includes(observation)).map((observation) => ({ source: observation.source, quality: observation.quality })),
      observations: allObservations
    }
  };
}

export { coverageName };
