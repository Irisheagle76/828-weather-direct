import { ELEVATION_BANDS } from "./config.js";

const mean = (values) => {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
};

export function buildElevationAnalysis(destinations = [], { now = Date.now(), observations = null } = {}) {
  const overnight = destinations.map((destination) => {
    const nighttime = selectNextOvernight(destination.hourly || [], now);
    const lows = nighttime.map((hour) => hour.temperatureF).filter(Number.isFinite);
    return { ...destination, overnightLow: lows.length ? Math.min(...lows) : null, nighttime };
  }).filter((site) => Number.isFinite(site.overnightLow) && site.dataQuality?.available !== false);

  const valley = overnight.find((site) => site.id === "asheville") || overnight.slice().sort((a, b) => a.elevationFeet - b.elevationFeet)[0];
  const clear = mean((valley?.nighttime || []).map((h) => h.cloudCover)) ?? 1;
  const wind = mean((valley?.nighttime || []).map((h) => h.windSpeed)) ?? 20;
  const dewSpread = mean((valley?.nighttime || []).map((h) => Number.isFinite(h.temperatureF) && Number.isFinite(h.dewpointF) ? h.temperatureF - h.dewpointF : null));
  const forecastColdPoolRisk = Number.isFinite(valley?.overnightLow) && valley.overnightLow <= 45 && clear <= 0.35 && wind <= 5 && (dewSpread == null || dewSpread >= 4);
  const observedColdPoolSignal = detectObservedColdPool(observations?.anchors || [], now);
  // Observations remain diagnostic-only during calibration. They can confirm
  // or contradict the setup, but do not change public forecast guidance yet.
  const coldPoolRisk = forecastColdPoolRisk;

  const estimates = ELEVATION_BANDS.map((band) => {
    const neighbors = overnight
      .map((site) => ({ site, distance: Math.abs(site.elevationFeet - band.representativeFeet) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);
    let temperatureF = neighbors.length
      ? neighbors.reduce((sum, item) => sum + item.site.overnightLow / Math.max(350, item.distance), 0) /
        neighbors.reduce((sum, item) => sum + 1 / Math.max(350, item.distance), 0)
      : null;
    if (coldPoolRisk && band.id === "asheville-valley" && Number.isFinite(valley?.overnightLow)) temperatureF = valley.overnightLow;
    return { ...band, temperatureF: Number.isFinite(temperatureF) ? Math.round(temperatureF) : null, status: thresholdLabel(temperatureF) };
  });

  const thresholds = Object.fromEntries([40, 36, 32, 28].map((threshold) => [
    `temp${threshold}`,
    estimateThresholdRange(overnight, threshold)
  ]));
  const lowConfidenceSites = overnight.filter((site) => site.dataQuality?.elevationConfidence === "low").length;
  const observationAnchorCount = (observations?.anchors || []).length;
  const effectiveObservationAnchors = (observations?.anchors || []).reduce((sum, anchor) => sum + (Number(anchor.effectiveWeight ?? anchor.weight) || 0), 0);
  return {
    bands: estimates,
    thresholds,
    coldPoolRisk,
    forecastColdPoolRisk,
    observedColdPoolSignal,
    observationAnchorCount,
    effectiveObservationAnchors,
    sampleCount: overnight.length,
    confidence: overnight.length >= 5 && lowConfidenceSites <= 2 && effectiveObservationAnchors >= 3 ? "medium" : "low"
  };
}

function detectObservedColdPool(anchors, now) {
  const localHour = easternHour(now);
  if (localHour > 8 && localHour < 20) return false;
  const valleys = anchors.filter((anchor) => anchor.terrainRole === "valley" || (!anchor.terrainRole && ["asheville", "waynesville", "black-mountain"].includes(anchor.destinationId)));
  const ridges = anchors.filter((anchor) => anchor.terrainRole === "ridge" || (!anchor.terrainRole && ["pisgah", "mitchell"].includes(anchor.destinationId)));
  const valleyTemperature = mean(valleys.map((anchor) => anchor.temperatureF));
  const ridgeTemperature = mean(ridges.map((anchor) => anchor.temperatureF));
  const valleyWind = mean(valleys.map((anchor) => anchor.windMph));
  return valleys.length >= 2 && ridges.length >= 1 && Number.isFinite(valleyTemperature) && Number.isFinite(ridgeTemperature) && valleyTemperature <= ridgeTemperature - 2 && (valleyWind == null || valleyWind <= 4);
}

function selectNextOvernight(hours, now = Date.now()) {
  const future = hours.filter((hour) => Number.isFinite(hour.timestamp) && hour.timestamp >= now - 60 * 60 * 1000);
  const result = [];
  let started = false;
  for (const hour of future) {
    const localHour = easternHour(hour.timestamp);
    const nighttime = localHour >= 20 || localHour <= 8;
    if (!started && nighttime) started = true;
    if (started && !nighttime) break;
    if (started) result.push(hour);
  }
  return result.slice(0, 13);
}

function thresholdLabel(temp) {
  if (!Number.isFinite(temp)) return "Awaiting data";
  if (temp <= 28) return "Hard freeze risk";
  if (temp <= 32) return "Freeze";
  if (temp <= 36) return "Frost possible";
  if (temp <= 40) return "Cool-night signal";
  return "Mild";
}

function estimateThresholdRange(sites, threshold) {
  const sorted = sites.slice().sort((a, b) => a.elevationFeet - b.elevationFeet);
  const cold = sorted.filter((site) => site.overnightLow <= threshold);
  if (!cold.length) return { reached: false, range: null, ranges: [], ambiguous: false, confidence: "medium" };
  const crossings = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const lower = sorted[index - 1];
    const upper = sorted[index];
    const lowerDifference = lower.overnightLow - threshold;
    const upperDifference = upper.overnightLow - threshold;
    if (lowerDifference === 0 || upperDifference === 0 || lowerDifference * upperDifference < 0) {
      const span = upper.elevationFeet - lower.elevationFeet;
      const fraction = Math.abs(lowerDifference) / Math.max(0.1, Math.abs(lowerDifference) + Math.abs(upperDifference));
      const estimate = lower.elevationFeet + span * fraction;
      const uncertain = lower.dataQuality?.elevationConfidence === "low" || upper.dataQuality?.elevationConfidence === "low";
      const margin = uncertain ? 600 : 300;
      crossings.push([Math.max(1500, Math.round((estimate - margin) / 100) * 100), Math.round((estimate + margin) / 100) * 100]);
    }
  }
  if (crossings.length > 1) return { reached: true, range: null, ranges: crossings, ambiguous: true, confidence: "low" };
  if (crossings.length === 1) return { reached: true, range: crossings[0], ranges: crossings, ambiguous: false, confidence: crossings[0][1] - crossings[0][0] > 700 ? "low" : "medium" };
  return { reached: true, range: null, ranges: [], ambiguous: true, confidence: "low" };
}

function easternHour(timestamp) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }).format(new Date(timestamp))) % 24;
}
