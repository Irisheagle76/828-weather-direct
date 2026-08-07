export function clampScore(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

export function roundScore(value) {
  return Math.round(clampScore(value));
}

export function forecastWeightedAverage(values = [], options = {}) {
  const limit = Math.max(1, Math.round(options.limit ?? 12));
  const decay = clampScore(options.decay ?? 0.84, 0.05, 1);
  const valid = values.slice(0, limit).map((value, index) => ({ value, index })).filter(({ value }) => Number.isFinite(value));
  if (!valid.length) return null;

  let weightedTotal = 0;
  let weightTotal = 0;
  for (const { value, index } of valid) {
    const weight = decay ** index;
    weightedTotal += value * weight;
    weightTotal += weight;
  }
  return weightTotal ? weightedTotal / weightTotal : null;
}

export function cloudVisibilityScore(cloudCover) {
  if (!Number.isFinite(cloudCover)) return 50;
  const cloud = clampScore(cloudCover);
  return clampScore(100 - cloud * 0.62 - cloud * cloud * 0.0038);
}

export function cloudTextureScore(cloudCover) {
  if (!Number.isFinite(cloudCover)) return 50;
  const cloud = clampScore(cloudCover);
  const distanceFromIdeal = Math.abs(cloud - 38);
  const overcastPenalty = Math.max(0, cloud - 82) * 0.45;
  return clampScore(100 - distanceFromIdeal * 1.25 - overcastPenalty);
}

export function buildSkyScores(metrics = {}) {
  const cloudCover = Number.isFinite(metrics.cloudCover) ? clampScore(metrics.cloudCover) : 60;
  const cloudVisibility = cloudVisibilityScore(metrics.cloudCover);
  const transparency = Number.isFinite(metrics.transparency) ? clampScore(metrics.transparency) : 55;
  const darkness = Number.isFinite(metrics.darkness) ? clampScore(metrics.darkness) : 45;
  const wind = Number.isFinite(metrics.windComfort) ? clampScore(metrics.windComfort) : 70;
  const humidityPenalty = Number.isFinite(metrics.humidityPenalty) ? clampScore(metrics.humidityPenalty) : 45;
  const smokePenalty = Number.isFinite(metrics.smokePenalty) ? clampScore(metrics.smokePenalty) : 35;
  const atmosphericClarity = 100 - (humidityPenalty * 0.58 + smokePenalty * 0.42);
  const clearSky = 100 - cloudCover;

  const summitView =
    cloudVisibility * 0.42 +
    transparency * 0.30 +
    wind * 0.12 +
    atmosphericClarity * 0.16;
  const sunriseSunset =
    cloudTextureScore(metrics.cloudCover) * 0.52 +
    transparency * 0.30 +
    wind * 0.12 +
    atmosphericClarity * 0.06;
  const nightSky =
    clearSky * 0.45 +
    transparency * 0.30 +
    darkness * 0.20 +
    wind * 0.05;
  const undercast =
    humidityPenalty * 0.34 +
    clearSky * 0.23 +
    wind * 0.20 +
    transparency * 0.13 +
    cloudTextureScore(metrics.cloudCover) * 0.10;

  return {
    summitView: roundScore(summitView),
    sunriseSunset: roundScore(sunriseSunset),
    nightSky: roundScore(nightSky),
    undercast: roundScore(undercast)
  };
}

function cameraViewScore(signal) {
  const clarity = signal?.camera?.clarityScore;
  if (!Number.isFinite(clarity)) return null;
  const conditionPenalty = {
    fog_or_low_cloud: 24,
    limited_visibility: 10,
    usable: 3,
    clear_view: 0
  }[signal.camera.condition] ?? 5;
  return clampScore(clarity - conditionPenalty);
}

function cameraBlendWeight(signal) {
  if (!Number.isFinite(signal?.camera?.clarityScore)) return 0;
  const darkShare = Number.isFinite(signal.camera.darkShare) ? signal.camera.darkShare : 0;
  if (darkShare >= 0.65) return 0.08;
  if (darkShare >= 0.4) return 0.16;
  return 0.34;
}

function stationViewScore(signal) {
  const humidity = signal?.observation?.humidityPct;
  const dewSpread = signal?.dewSpread;
  if (!Number.isFinite(humidity) && !Number.isFinite(dewSpread)) return null;
  const humidityPenalty = Number.isFinite(humidity) ? Math.max(0, humidity - 90) * 5 : 0;
  const saturationPenalty = Number.isFinite(dewSpread) ? Math.max(0, 4 - dewSpread) * 8 : 0;
  return clampScore(70 - humidityPenalty - saturationPenalty, 5, 70);
}

export function blendLiveSummitScore(baseScore, signal) {
  const base = clampScore(baseScore);
  if (!signal) {
    return { score: roundScore(base), baseScore: roundScore(base), liveScore: null, liveWeight: 0, adjustment: 0 };
  }

  const isCameraSignal = String(signal.type || "").startsWith("camera-");
  const liveScore = isCameraSignal ? cameraViewScore(signal) : stationViewScore(signal);
  if (!Number.isFinite(liveScore)) {
    return { score: roundScore(base), baseScore: roundScore(base), liveScore: null, liveWeight: 0, adjustment: 0 };
  }

  const weight = isCameraSignal ? cameraBlendWeight(signal) : 0.36;
  const blended = base * (1 - weight) + liveScore * weight;
  const score = roundScore(blended);
  return {
    score,
    baseScore: roundScore(base),
    liveScore: roundScore(liveScore),
    liveWeight: Number(weight.toFixed(2)),
    adjustment: score - roundScore(base)
  };
}

export function scoreConfidence(metrics = {}, sampleCounts = {}, signal = null) {
  const metricKeys = ["cloudCover", "transparency", "darkness", "humidityPenalty", "smokePenalty", "windComfort"];
  const validMetrics = metricKeys.filter((key) => Number.isFinite(metrics[key])).length;
  const chartCompleteness = validMetrics / metricKeys.length;
  const counts = metricKeys.map((key) => Number(sampleCounts[key]) || 0);
  const sampleCoverage = counts.length ? counts.reduce((sum, count) => sum + Math.min(count / 12, 1), 0) / counts.length : 0;
  const hasLiveRead = Number.isFinite(signal?.camera?.clarityScore) || signal?.type === "summit-fog";
  const darkCamera = Number(signal?.camera?.darkShare) >= 0.65;
  const confidence = roundScore(chartCompleteness * 64 + sampleCoverage * 20 + (hasLiveRead ? (darkCamera ? 3 : 10) : 0));
  return {
    score: confidence,
    label: confidence >= 85 ? "High" : confidence >= 65 ? "Moderate" : "Low",
    chartCompleteness: Number(chartCompleteness.toFixed(2)),
    sampleCoverage: Number(sampleCoverage.toFixed(2)),
    liveObservationUsed: hasLiveRead
  };
}
