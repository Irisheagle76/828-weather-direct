const METRICS = Object.freeze({
  temperature: { field: "temperatureF", label: "Temperature", unit: "°F" },
  dewPoint: { field: "dewPointF", label: "Dew point", unit: "°F" },
  wind: { field: "windMph", label: "Wind", unit: " mph" },
  gust: { field: "windGustMph", label: "Gust", unit: " mph" },
  rainfallRate: { field: "precipitationRateInHr", label: "Rain rate", unit: " in/hr" },
  rainfallToday: { field: "precipitationTodayIn", label: "Rain today", unit: " in" },
  pressure: { field: "normalizedPressureMb", label: "Elevation-adjusted pressure", unit: " mb" },
  solar: { field: "solarRadiationWm2", label: "Solar radiation", unit: " W/m²" }
});

export function analyzeMesonet(payload = {}) {
  const stations = (payload.stations ?? []).filter((station) => station?.observation && station?.quality?.usable !== false);
  const statistics = Object.fromEntries(Object.entries(METRICS).map(([key, metric]) => [key, summarizeMetric(stations, metric.field)]));
  const anomalies = buildAnomalies(stations, statistics);
  const elevation = elevationAnalysis(stations);
  const pairs = buildPairs(stations);
  const rain = rainfallAnalysis(stations);
  const agreement = agreementAnalysis(statistics, stations.length);
  const qc = qualitySummary(payload.stations ?? []);
  const insights = rankInsights({ stations, statistics, anomalies, elevation, rain, agreement, pairs });

  return {
    generatedAt: payload.generatedAt ?? null,
    stationCount: payload.network?.stationCount ?? (payload.stations ?? []).length,
    reportingCount: stations.length,
    metrics: METRICS,
    statistics,
    anomalies,
    elevation,
    pairs,
    rain,
    agreement,
    qc,
    insights,
    readiness: readinessMatrix(payload.stations ?? [])
  };
}

export function summarizeMetric(stations, field) {
  const samples = stations
    .map((station) => ({ stationId: station.id, name: station.name, value: finite(station.observation?.[field]) }))
    .filter((sample) => sample.value != null)
    .sort((a, b) => a.value - b.value);
  const values = samples.map((sample) => sample.value);
  if (!values.length) return emptyStats();
  const center = median(values);
  const deviations = values.map((value) => Math.abs(value - center));
  const mad = median(deviations);
  const q1 = quantile(values, 0.25);
  const q3 = quantile(values, 0.75);
  const mean = average(values);
  const standardDeviation = Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
  return {
    count: values.length,
    min: round(values[0]),
    max: round(values.at(-1)),
    spread: round(values.at(-1) - values[0]),
    median: round(center),
    q1: round(q1),
    q3: round(q3),
    iqr: round(q3 - q1),
    mad: round(mad),
    mean: round(mean),
    coefficientOfVariation: Math.abs(mean) > 0.0001 ? round(standardDeviation / Math.abs(mean), 3) : null,
    minimumStation: samples[0],
    maximumStation: samples.at(-1)
  };
}

export function robustElevationSlope(stations, field = "temperatureF") {
  const points = stations
    .map((station) => ({ stationId: station.id, name: station.name, elevationFt: finite(station.elevationFt), value: finite(station.observation?.[field]) }))
    .filter((point) => point.elevationFt != null && point.value != null);
  const slopes = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const elevationDifference = points[j].elevationFt - points[i].elevationFt;
      if (Math.abs(elevationDifference) >= 25) slopes.push(((points[j].value - points[i].value) / elevationDifference) * 1000);
    }
  }
  if (!slopes.length) return { sampleCount: points.length, slopePer1000Ft: null, intercept: null, r2: null };
  const slope = median(slopes);
  const intercept = median(points.map((point) => point.value - (slope * point.elevationFt) / 1000));
  const meanValue = average(points.map((point) => point.value));
  const residualSum = points.reduce((sum, point) => sum + (point.value - (intercept + (slope * point.elevationFt) / 1000)) ** 2, 0);
  const totalSum = points.reduce((sum, point) => sum + (point.value - meanValue) ** 2, 0);
  return {
    sampleCount: points.length,
    slopePer1000Ft: round(slope, 2),
    intercept: round(intercept, 2),
    r2: totalSum > 0 ? round(Math.max(0, 1 - residualSum / totalSum), 3) : null,
    points
  };
}

export function haversineMiles(a, b) {
  const lat1 = finite(a?.location?.latitude);
  const lon1 = finite(a?.location?.longitude);
  const lat2 = finite(b?.location?.latitude);
  const lon2 = finite(b?.location?.longitude);
  if ([lat1, lon1, lat2, lon2].some((value) => value == null)) return null;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function buildAnomalies(stations, statistics) {
  const output = [];
  for (const [metricKey, metric] of Object.entries(METRICS)) {
    const stats = statistics[metricKey];
    if (!stats?.count) continue;
    for (const station of stations) {
      const value = finite(station.observation?.[metric.field]);
      if (value == null) continue;
      const anomaly = value - stats.median;
      const robustZ = stats.mad > 0 ? (0.6745 * anomaly) / stats.mad : 0;
      output.push({
        stationId: station.id,
        name: station.name,
        area: station.area,
        metric: metricKey,
        label: metric.label,
        unit: metric.unit,
        value: round(value),
        median: stats.median,
        anomaly: round(anomaly),
        robustZ: round(robustZ, 2),
        unusualness: round(Math.abs(robustZ), 2)
      });
    }
  }
  return output.sort((a, b) => b.unusualness - a.unusualness || Math.abs(b.anomaly) - Math.abs(a.anomaly));
}

function elevationAnalysis(stations) {
  const temperature = robustElevationSlope(stations, "temperatureF");
  const dewPoint = robustElevationSlope(stations, "dewPointF");
  const wind = robustElevationSlope(stations, "windMph");
  const rainfall = robustElevationSlope(stations, "precipitationTodayIn");
  return {
    temperature: { ...temperature, classification: classifyTemperatureSlope(temperature.slopePer1000Ft) },
    dewPoint,
    wind,
    rainfall,
    caution: "A current cross-section is a spatial relationship, not a free-air lapse rate. Exposure and geography can dominate individual stations."
  };
}

function classifyTemperatureSlope(slope) {
  if (slope == null) return "insufficient data";
  if (slope >= 4) return "strong inversion signal";
  if (slope >= 1.5) return "inversion signal";
  if (slope > -1.5) return "near-isothermal";
  if (slope > -3.5) return "weak lapse";
  if (slope >= -7) return "typical lapse";
  return "strong lapse";
}

function buildPairs(stations) {
  const pairs = [];
  for (let i = 0; i < stations.length; i += 1) {
    for (let j = i + 1; j < stations.length; j += 1) {
      const first = stations[i];
      const second = stations[j];
      const distanceMiles = haversineMiles(first, second);
      if (distanceMiles == null) continue;
      const values = {};
      for (const [key, metric] of Object.entries(METRICS)) {
        const a = finite(first.observation?.[metric.field]);
        const b = finite(second.observation?.[metric.field]);
        values[key] = a == null || b == null ? null : round(b - a);
      }
      pairs.push({
        id: `${first.id}::${second.id}`,
        first: stationDigest(first),
        second: stationDigest(second),
        distanceMiles: round(distanceMiles, 2),
        elevationDifferenceFt: round(second.elevationFt - first.elevationFt, 0),
        differences: values
      });
    }
  }
  return pairs.sort((a, b) => a.distanceMiles - b.distanceMiles);
}

function rainfallAnalysis(stations) {
  const wet = stations.filter((station) => (finite(station.observation?.precipitationRateInHr) ?? 0) >= 0.01);
  const clusters = connectedComponents(wet, 8).map((members) => {
    const rates = members.map((station) => finite(station.observation?.precipitationRateInHr) ?? 0);
    const totals = members.map((station) => finite(station.observation?.precipitationTodayIn)).filter((value) => value != null);
    return {
      stationCount: members.length,
      stations: members.map((station) => station.name),
      center: {
        latitude: round(average(members.map((station) => station.location.latitude)), 4),
        longitude: round(average(members.map((station) => station.location.longitude)), 4)
      },
      peakRateInHr: round(Math.max(...rates)),
      medianRateInHr: round(median(rates)),
      maximumTodayIn: totals.length ? round(Math.max(...totals)) : null,
      confidence: members.length >= 3 ? "high" : members.length === 2 ? "moderate" : "low"
    };
  }).sort((a, b) => b.peakRateInHr - a.peakRateInHr);
  const rateStats = summarizeMetric(stations, "precipitationRateInHr");
  const totalStats = summarizeMetric(stations, "precipitationTodayIn");
  return {
    wetStationCount: wet.length,
    rateReportingCount: rateStats.count,
    clusters,
    rateStats,
    totalStats,
    localized: wet.length > 0 && wet.length <= Math.max(2, Math.floor(rateStats.count * 0.2)),
    limitation: "Rolling 5-minute through 24-hour totals and duration cannot be reconstructed from one current snapshot."
  };
}

function connectedComponents(stations, maximumMiles) {
  const remaining = new Set(stations);
  const groups = [];
  while (remaining.size) {
    const seed = remaining.values().next().value;
    remaining.delete(seed);
    const group = [seed];
    const queue = [seed];
    while (queue.length) {
      const current = queue.shift();
      for (const candidate of [...remaining]) {
        const distance = haversineMiles(current, candidate);
        if (distance != null && distance <= maximumMiles) {
          remaining.delete(candidate);
          group.push(candidate);
          queue.push(candidate);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function agreementAnalysis(statistics, reportingCount) {
  const temperature = statistics.temperature;
  const dewPoint = statistics.dewPoint;
  const coverage = reportingCount > 0 ? Math.min(1, temperature.count / reportingCount) : 0;
  const normalizedTemperatureMad = temperature.mad == null ? null : temperature.mad / 3;
  const normalizedDewMad = dewPoint.mad == null ? null : dewPoint.mad / 4;
  const dispersion = average([normalizedTemperatureMad, normalizedDewMad].filter(Number.isFinite));
  const score = round(Math.max(0, Math.min(100, coverage * 100 - dispersion * 22)), 0);
  const category = consensusCategory(temperature.iqr);
  const localContrast = contrastCategory(temperature.spread);
  return {
    score,
    classification: score >= 82 ? "high" : score >= 65 ? "moderate" : score >= 45 ? "low" : "very low",
    basis: `${temperature.count} temperature and ${dewPoint.count} dew-point observations; robust spatial dispersion is emphasized.`,
    publicCategory: category.label,
    publicVerdict: category.verdict,
    categoryIndex: category.index,
    localContrast: localContrast.label,
    temperatureMedian: temperature.median,
    typicalLow: temperature.q1,
    typicalHigh: temperature.q3,
    fullLow: temperature.min,
    fullHigh: temperature.max,
    typicalDeparture: temperature.mad,
    eventExplanation: explainCurrentPattern(statistics, category, localContrast)
  };
}

function consensusCategory(iqr) {
  if (!Number.isFinite(iqr)) return { index: 0, label: "Insufficient data", verdict: "Not enough stations are reporting to describe the citywide pattern." };
  if (iqr <= 3) return { index: 0, label: "One Asheville story", verdict: "Yes—one Asheville reading broadly represents conditions across town." };
  if (iqr <= 5) return { index: 1, label: "Mostly aligned", verdict: "Mostly—but not everywhere." };
  if (iqr <= 8) return { index: 2, label: "Location matters", verdict: "Only partly—your neighborhood meaningfully changes the weather you experience." };
  return { index: 3, label: "Highly localized", verdict: "No—one Asheville reading cannot represent conditions across town." };
}

function contrastCategory(spread) {
  if (!Number.isFinite(spread)) return { label: "Unknown" };
  if (spread < 4) return { label: "Limited" };
  if (spread < 7) return { label: "Noticeable" };
  if (spread < 10) return { label: "Strong" };
  return { label: "Very strong" };
}

function explainCurrentPattern(statistics, category, contrast) {
  const rain = statistics.rainfallRate;
  const gust = statistics.gust;
  const temperature = statistics.temperature;
  if (rain?.maximumStation?.value > 0.01) {
    return "Active rain is creating localized cooling and moisture differences across Asheville’s reporting stations.";
  }
  if (gust?.spread >= 10) {
    return `Wind exposure is part of today's story: gusts differ by ${gust.spread.toFixed(1)} mph across reporting stations.`;
  }
  if (category.index >= 2 || contrast.label === "Very strong") {
    return "Neighborhood setting, terrain and exposure are producing pronounced warm and cool pockets across Asheville.";
  }
  if (temperature?.iqr <= 3) {
    return "A relatively uniform air mass is keeping most neighborhoods close to the citywide temperature.";
  }
  return "Most neighborhoods share the same broad air mass, while local terrain and exposure create smaller departures.";
}

function qualitySummary(allStations) {
  const flags = new Map();
  const freshness = { fresh: 0, delayed: 0, stale: 0, unknown: 0 };
  const pressure = { reported: 0, elevationAdjusted: 0, inferred: 0, withheld: 0 };
  for (const station of allStations) {
    const state = station.quality?.freshness ?? "unknown";
    freshness[state] = (freshness[state] ?? 0) + 1;
    for (const flag of station.quality?.flags ?? []) flags.set(flag, (flags.get(flag) ?? 0) + 1);
    const method = station.observation?.pressureNormalization;
    if (method === "reported_sea_level") pressure.reported += 1;
    else if (method === "elevation_reduced_station") pressure.elevationAdjusted += 1;
    else if (method?.startsWith("inferred_")) pressure.inferred += 1;
    else if (method === "unresolved") pressure.withheld += 1;
  }
  return {
    freshness,
    pressure,
    flags: [...flags.entries()].map(([flag, count]) => ({ flag, count })).sort((a, b) => b.count - a.count),
    unavailable: allStations.filter((station) => !station.observation).map((station) => ({ name: station.name, reason: station.unavailableReason ?? "No observation" })),
    gaps: [
      "No micronet-specific jump detection across requests",
      "No rainfall-counter reset handling",
      "No duplicate-timestamp suppression",
      "No neighbor-consistency or persistent-bias test",
      "No wind-direction plausibility or calm-wind handling",
      "Inferred pressure datums still need persistence checks against trusted references",
      "Provider QC status is collected but not yet used to block interpretations"
    ]
  };
}

function rankInsights(context) {
  const candidates = [];
  const temp = context.statistics.temperature;
  const dew = context.statistics.dewPoint;
  const wind = context.statistics.wind;
  const gust = context.statistics.gust;
  if (temp.count >= 6) candidates.push({
    key: "temperature-spread",
    score: Math.min(100, temp.spread * 7),
    confidence: temp.count >= 15 ? "high" : "moderate",
    title: `${temp.spread.toFixed(1)}°F separates Asheville’s stations`,
    text: `${temp.minimumStation.name} is coolest at ${temp.minimumStation.value.toFixed(1)}°F; ${temp.maximumStation.name} is warmest at ${temp.maximumStation.value.toFixed(1)}°F.`
  });
  if (context.elevation.temperature.slopePer1000Ft != null) candidates.push({
    key: "elevation",
    score: Math.min(88, (32 + Math.abs(context.elevation.temperature.slopePer1000Ft) * 4) * (0.45 + 0.55 * (context.elevation.temperature.r2 ?? 0))),
    confidence: context.elevation.temperature.sampleCount >= 12 && context.elevation.temperature.r2 >= 0.2 ? "moderate" : "low",
    title: `Elevation signal: ${context.elevation.temperature.classification}`,
    text: `The robust gradient is ${signed(context.elevation.temperature.slopePer1000Ft)}°F per 1,000 ft, but spatial coherence is ${context.elevation.temperature.r2 >= 0.2 ? "meaningful" : "weak"} (R² ${formatNullable(context.elevation.temperature.r2, 2)}).`
  });
  if (dew.count >= 6) candidates.push({
    key: "moisture",
    score: Math.min(90, dew.spread * 7),
    confidence: dew.count >= 15 ? "high" : "moderate",
    title: `${dew.spread.toFixed(1)}°F dew-point gradient`,
    text: `${dew.maximumStation.name} has the moist edge; ${dew.minimumStation.name} is the driest reporting location.`
  });
  if (context.rain.wetStationCount) candidates.push({
    key: "rain",
    score: context.rain.localized ? 92 : 72,
    confidence: context.rain.clusters.some((cluster) => cluster.stationCount >= 2) ? "moderate" : "low",
    title: context.rain.localized ? "Rainfall is highly localized" : "Rain is affecting multiple parts of the Asheville area",
    text: `${context.rain.wetStationCount} of ${context.rain.rateReportingCount} rate-reporting stations are wet; ${context.rain.clusters.length} spatial cluster${context.rain.clusters.length === 1 ? "" : "s"} detected.`
  });
  if (gust.count >= 6 && gust.spread >= 8) candidates.push({
    key: "wind",
    score: Math.min(88, 40 + gust.spread * 3),
    confidence: "moderate",
    title: `${gust.spread.toFixed(1)} mph gust spread`,
    text: `${gust.maximumStation.name} is the gustiest site, a useful clue to terrain exposure or localized mixing.`
  });
  if (wind.count >= 6 && !candidates.some((item) => item.key === "wind")) candidates.push({
    key: "wind",
    score: Math.min(65, 25 + wind.spread * 3),
    confidence: "low",
    title: `${wind.spread.toFixed(1)} mph sustained-wind spread`,
    text: `${wind.maximumStation.name} has the strongest sustained wind in this snapshot.`
  });
  return candidates.sort((a, b) => b.score - a.score).slice(0, 3).map(({ score, ...item }) => item);
}

function readinessMatrix(allStations) {
  const reporting = allStations.filter((station) => station.observation);
  const count = (field) => reporting.filter((station) => finite(station.observation?.[field]) != null).length;
  return [
    readiness("Network anomalies", "now", "High", "High", "Yes", "Current median/MAD support robust rankings now."),
    readiness("Spatial spreads and agreement", "now", "High", "High", "Yes", "Temperature, dew point, wind, gust, rain, and solar can be summarized now; pressure uses a provisional datum-normalization layer."),
    readiness("Elevation relationship", "now", "High", "High", "With caveats", `${count("temperatureF")} temperatures and elevation for every cataloged station support a robust current cross-section.`),
    readiness("Rain localization", "partial", "High", "High", "With caveats", `${count("precipitationRateInHr")} rain-rate and ${count("precipitationTodayIn")} daily-total fields are present; rolling windows need retained samples.`),
    readiness("Wind exposure", "partial", "High", "Moderate", "No", `${count("windMph")} wind speeds are available now; station fingerprints and wind roses require months of history and siting metadata.`),
    readiness("Cold-air drainage / inversion cycle", "history", "High", "High", "No", "Needs sunset-relative time series plus defensible valley/slope/ridge classes."),
    readiness("Front / outflow tracking", "history", "High", "High", "Conservative only", "Needs 1–5 minute temperature, dew point, wind direction, gust, pressure, and rain-rate histories with synchronized clocks."),
    readiness("Urban heat signal", "history", "Moderate", "High", "No", "Needs urban/suburban/rural metadata and many clear, light-wind nights."),
    readiness("Station fingerprints", "history", "High", "Moderate", "No", "Needs at least one season; a full year is preferable."),
    readiness("Flood-monitoring stress", "history", "High", "High", "No", "Needs rolling rainfall, antecedent totals, gauge/soil context, and multi-station agreement. Must remain observational." )
  ];
}

function readiness(name, state, operational, publicValue, automation, note) {
  return { name, state, operational, publicValue, automation, note };
}

function stationDigest(station) {
  return {
    id: station.id,
    name: station.name,
    area: station.area,
    elevationFt: station.elevationFt,
    exposure: station.exposure,
    provider: station.provider,
    location: station.location,
    observation: station.observation
  };
}

function emptyStats() {
  return { count: 0, min: null, max: null, spread: null, median: null, q1: null, q3: null, iqr: null, mad: null, mean: null, coefficientOfVariation: null, minimumStation: null, maximumStation: null };
}

function quantile(sorted, probability) {
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const fraction = index - lower;
  return sorted[lower + 1] == null ? sorted[lower] : sorted[lower] + fraction * (sorted[lower + 1] - sorted[lower]);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return quantile(sorted, 0.5);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 1) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function signed(value) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function formatNullable(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : "n/a";
}
