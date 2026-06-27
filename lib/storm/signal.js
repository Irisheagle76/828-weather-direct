function number(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cToF(value) {
  const c = number(value);
  return c == null ? null : (c * 9) / 5 + 32;
}

function normalizeCloudCover(value) {
  const cloud = number(value);
  if (cloud == null) return null;
  return cloud <= 1 ? cloud * 100 : cloud;
}

function joinEvidence(parts = []) {
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

function sentenceCase(value = "") {
  return value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;
}

export function buildStormSignal({ radar = {}, sky = {}, weather = {} } = {}) {
  const tempF = number(weather.tempF) ?? cToF(weather.airTemperatureC ?? weather.air_temperature);
  const dewF = number(weather.dewF) ?? cToF(weather.dewPointC ?? weather.dew_point);
  const humidity = number(weather.humidity ?? weather.relative_humidity);
  const lightningCount = number(weather.lightningCount ?? weather.lightning_strike_count) ?? 0;
  const cloudCover = normalizeCloudCover(sky.cloudCoverWest ?? sky.cloudCover);
  const mode = String(sky.mode || "day").toLowerCase();
  const cloudTrend = String(sky.cloudTrend || "unknown").toLowerCase();
  const brightnessTrend = String(sky.brightnessTrend || "unknown").toLowerCase();

  const radarFresh = radar.available === true && number(radar.ageMinutes) != null && radar.ageMinutes <= 15;
  const radarPresent = radarFresh && (
    (number(radar.echoCoverage) ?? 0) >= 0.004 ||
    (number(radar.echoPixels) ?? 0) >= 40
  );
  const radarStrong = radarPresent && (number(radar.strongEchoPixels) ?? 0) >= 10;
  const radarNear = radarPresent && (
    (number(radar.nearWestEchoPixels) ?? 0) >= 25 ||
    (number(radar.nearestEchoMiles) ?? 999) <= 45
  );
  const radarGrowing = radarPresent && radar.growing === true;
  const radarApproaching = radarPresent && radar.approaching === true;

  const cameraUsable = mode === "day";
  const cameraClouds = cameraUsable && cloudCover != null && cloudCover >= 18;
  const cameraCloudsSubstantial = cameraUsable && cloudCover != null && cloudCover >= 45;
  const cameraGrowth = cameraUsable && ["increasing", "deteriorating"].includes(cloudTrend);
  const cameraDarkening = cameraUsable && brightnessTrend === "decreasing";
  const cameraStructure = cameraUsable && sky.buildingCloudStructureSignal === true;
  const satelliteSupport = cameraUsable && sky.satelliteCloudMotionSignal === true &&
    (number(sky.satelliteCloudFraction) ?? 0) >= 0.18;
  const skySupport = cameraClouds || cameraGrowth || cameraDarkening || cameraStructure || satelliteSupport;

  const warm = tempF != null && tempF >= 78;
  const moist = dewF != null ? dewF >= 62 : humidity != null && humidity >= 60;
  const veryMoist = dewF != null ? dewF >= 67 : humidity != null && humidity >= 70;
  const tightSpread = tempF != null && dewF != null && tempF - dewF <= 20;
  const weatherSupport = moist && (warm || tightSpread);
  const lightning = lightningCount > 0;

  let score = 0;
  if (radarPresent) score += 2;
  if (radarStrong) score += 1;
  if (radarNear) score += 1;
  if (radarGrowing) score += 1;
  if (radarApproaching) score += 1;
  if (cameraClouds) score += 1;
  if (cameraCloudsSubstantial) score += 1;
  if (cameraGrowth || cameraDarkening) score += 1;
  if (cameraStructure) score += 1;
  if (satelliteSupport) score += 1;
  if (weatherSupport) score += 1;
  if (veryMoist) score += 1;
  if (lightning) score += 2;

  const evidenceGate = radarPresent && skySupport && (weatherSupport || lightning);
  const active = evidenceGate && score >= 5;
  const evidence = [];
  if (radarGrowing && radarApproaching) evidence.push("radar echoes are growing and edging east");
  else if (radarGrowing) evidence.push("radar echoes are strengthening west of town");
  else if (radarApproaching) evidence.push("radar echoes west of town are edging closer");
  else if (radarPresent) evidence.push("radar is detecting showers or storms west of town");

  if (cameraGrowth || cameraDarkening) evidence.push("the western sky is becoming more active");
  else if (cameraStructure) evidence.push("the camera is seeing more structured clouds in the western sky");
  else if (cameraCloudsSubstantial) evidence.push("the western camera view is filling with clouds");
  else if (satelliteSupport && cameraClouds) evidence.push("camera and satellite signals show active clouds to the west");
  else if (satelliteSupport) evidence.push("satellite imagery shows active cloud motion west of the area");
  else if (cameraClouds) evidence.push("clouds are visible in the western sky");

  if (lightning) evidence.push("Tempest has detected lightning");
  else if (veryMoist && warm) evidence.push("warm, humid air is supporting development");
  else if (weatherSupport) evidence.push("the local air is moist enough to support development");

  let level = "none";
  let confidence = 0;
  let headline = null;
  if (active && (lightning || score >= 11)) {
    level = "strong";
    confidence = Math.min(0.94, 0.82 + Math.max(0, score - 11) * 0.03);
    headline = "Storm clouds are building west of Asheville.";
  } else if (active && score >= 7) {
    level = "developing";
    confidence = Math.min(0.82, 0.68 + Math.max(0, score - 7) * 0.04);
    headline = "Storm clouds may be developing west of Asheville.";
  } else if (active) {
    level = "watching";
    confidence = 0.58 + Math.max(0, score - 5) * 0.04;
    headline = "Clouds are building to the west.";
  }

  return {
    active,
    level,
    score,
    confidence: Number(confidence.toFixed(2)),
    headline,
    detail: active
      ? `${sentenceCase(joinEvidence(evidence))}. This is an evolving signal, so conditions may change quickly.`
      : null,
    evidence,
    inputs: {
      radarFresh,
      radarPresent,
      radarStrong,
      radarNear,
      radarGrowing,
      radarApproaching,
      cameraUsable,
      cameraClouds,
      cameraGrowth,
      cameraDarkening,
      cameraStructure,
      satelliteSupport,
      tempF,
      dewF,
      humidity,
      lightningCount
    }
  };
}
