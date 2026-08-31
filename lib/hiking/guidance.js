const ASHEVILLE_STATION_IDS = new Set([
  "tempest-144737",
  "tempest-127602",
  "tempest-160562",
  "tempest-157700"
]);
const HIGH_ASHEVILLE_STATION_IDS = new Set(["tempest-160562", "tempest-157700"]);
const LIGHTNING_SIGNAL_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function analyzeHikingStations(stations = [], { now = Date.now() } = {}) {
  const usable = stations.filter((station) => finite(station.temperatureF) != null);
  const asheville = usable.filter((station) => ASHEVILLE_STATION_IDS.has(station.id));
  const highs = usable.filter((station) => HIGH_ASHEVILLE_STATION_IDS.has(station.id));
  const lower = usable.find((station) => station.id === "tempest-144737");
  const high = highs[0];
  const mitchell = usable.find((station) => station.id === "mount-mitchell");
  const localTempSpread = spread(asheville);
  const highStationSpread = spread(highs);
  const localAvg = average(asheville, "temperatureF");
  const lapseRate = lower && high
    ? (lower.temperatureF - high.temperatureF) / ((high.elevationFt - lower.elevationFt) / 1000)
    : null;
  const mitchellDrop = localAvg != null && mitchell ? localAvg - mitchell.temperatureF : null;
  const wncLapseRate = lower && mitchell
    ? (lower.temperatureF - mitchell.temperatureF) / ((mitchell.elevationFt - lower.elevationFt) / 1000)
    : null;
  const dewSpreads = usable
    .map((station) => finite(station.dewPointF) == null ? null : station.temperatureF - station.dewPointF)
    .filter(Number.isFinite);
  const minDewSpread = dewSpreads.length ? Math.min(...dewSpreads) : null;
  const maxUv = maximum(usable.map((station) => finite(station.uv) ?? uvFromSolar(station.solarWm2) ?? 0));
  const maxSolar = maximum(usable.map((station) => finite(station.solarWm2) ?? 0));
  const maxGust = maximum(usable.map((station) => finite(station.gustMph) ?? finite(station.windMph) ?? 0));
  const maxTemp = maximum(usable.map((station) => finite(station.temperatureF)));
  const maxWbgt = maximum(usable.map((station) => finite(station.wbgtF)));
  const maxRainRate = maximum(usable.map((station) => finite(station.rainRateInHr) ?? 0));
  const maxRainToday = maximum(usable.map((station) => finite(station.rainTodayIn) ?? 0));
  const lightningStations = usable.filter((station) => station.provider === "tempest" && hasLightningSignal(station, now));
  const nearestLightningStation = lightningStations
    .slice()
    .sort((a, b) => (finite(a.lightningLastDistanceMiles) ?? Infinity) - (finite(b.lightningLastDistanceMiles) ?? Infinity))[0] || null;
  const lightningActive = lightningStations.length > 0;
  const lightningCounts1h = sum(lightningStations, "lightningStrikes1h");
  const lightningCounts3h = sum(lightningStations, "lightningStrikes3h");
  const lightningDetails = lightningDetail(nearestLightningStation);
  const fogRisk = minDewSpread == null ? "Unknown" : minDewSpread <= 4 ? "Elevated" : minDewSpread <= 8 ? "Patchy pockets" : "Low";
  const overall = lightningActive
    ? "Lightning nearby, avoid exposed terrain"
    : maxTemp >= 84 || maxWbgt >= 78
      ? "Warm, choose shade"
      : maxUv >= 7
        ? "Good, watch sun"
        : maxGust >= 25
          ? "Good, watch wind"
          : "Good for most hikes";
  const bestWindow = lightningActive
    ? "Stay off exposed ridges, balds, summits, and open slopes until the lightning signal clears."
    : maxTemp >= 78 || maxUv >= 7
      ? "Forest shade is the friendliest choice; open ridges and pavement will feel warmer."
      : fogRisk === "Elevated"
        ? "Good overall, but expect damp pockets, wet leaves, or low cloud early."
        : "Most nearby trails look friendly, with normal mountain checks.";
  const hikerNarrative = lightningActive
    ? `Tempest lightning may be in the vicinity of your hike. ${nearestLightningStation ? `${nearestLightningStation.name} reported ${lightningDetails || "a recent lightning signal"}.` : "A nearby Tempest station reported a recent lightning signal."} Stay alert and avoid exposed ridges, balds, summits, and open slopes until the signal clears.`
    : `If you are heading out, Asheville-area trails look ${overall.toLowerCase()}. The nearby readings sit within about ${format(localTempSpread, "degF")} of each other, so elevation alone may not change the feel very much. The two high Asheville readings ${highStationSpread != null && highStationSpread >= 4 ? "differ enough to show local microclimates at work" : "are telling a similar ridge story"}, which means shade, slope, and open exposure still matter. Mount Mitchell is about ${format(mitchellDrop, "degF")} cooler than the Asheville-area readings, so high-peak hikes deserve an extra layer and a separate comfort check. ${fogRisk === "Elevated" ? "Moisture is close enough for fog, low cloud, or wet leaves in sheltered spots." : "Fog is not the main signal right now."} ${maxSolar >= 500 || maxUv >= 5 ? "Open routes need sun awareness and steady water; forested trails should feel more forgiving." : "Sun exposure is manageable, especially under canopy."}`;
  const scoreInput = {
    localTempSpread: round(localTempSpread, 1),
    mitchellDrop: round(mitchellDrop, 1),
    fogRisk,
    maxUv,
    maxSolar: round(maxSolar),
    maxGust: round(maxGust, 1),
    maxTemp: round(maxTemp, 1),
    maxWbgt: round(maxWbgt, 1),
    maxRainRate: round(maxRainRate, 2),
    maxRainToday: round(maxRainToday, 2),
    lightning: { active: lightningActive }
  };
  const scoreResult = hikerScore(scoreInput);
  return {
    overall,
    bestWindow,
    hikerNarrative,
    bullets: [
      lightningActive ? `Lightning alert: ${nearestLightningStation?.name || "Tempest"} reports nearby lightning. Stay off exposed terrain.` : `${overall}: ${bestWindow}`,
      localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${format(localTempSpread, "degF")}.`,
      highStationSpread != null && highStationSpread >= 4 ? "High Asheville readings show a microclimate split." : "High Asheville readings broadly agree.",
      mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${format(mitchellDrop, "degF")} cooler than the Asheville-area readings.`,
      fogRisk === "Elevated" ? "Fog/low cloud or damp vegetation may linger in pockets." : "Fog risk is not the lead concern.",
      maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light at the reporting sites.",
      maxUv >= 5 || maxSolar >= 500 ? "Sun exposure matters on open routes." : "Sun exposure is manageable right now."
    ],
    hikerScore: scoreResult.score,
    hikerScoreLabel: hikerScoreLabel(scoreResult.score, lightningActive),
    hikerScoreFactors: scoreResult.factors,
    localTempSpread: round(localTempSpread, 1),
    highStationSpread: round(highStationSpread, 1),
    lapseRate: round(lapseRate, 1),
    mitchellDrop: round(mitchellDrop, 1),
    wncLapseRate: round(wncLapseRate, 1),
    fogRisk,
    maxUv,
    maxSolar: round(maxSolar),
    maxGust: round(maxGust, 1),
    maxTemp: round(maxTemp, 1),
    maxWbgt: round(maxWbgt, 1),
    maxRainRate: round(maxRainRate, 2),
    maxRainToday: round(maxRainToday, 2),
    lightning: {
      active: lightningActive,
      stationName: nearestLightningStation?.name ?? null,
      details: lightningDetails,
      lastDistanceMiles: nearestLightningStation?.lightningLastDistanceMiles ?? null,
      lastDistanceMsg: nearestLightningStation?.lightningLastDistanceMsg ?? null,
      lastObservedAt: nearestLightningStation?.lightningLastEpoch ?? null,
      strikeCount1h: lightningCounts1h,
      strikeCount3h: lightningCounts3h,
      summary: lightningActive
        ? `Tempest lightning may be in the vicinity of the hike. ${nearestLightningStation?.name ? `${nearestLightningStation.name} is the closest lightning signal.` : ""} Stay alert and avoid exposed ridges, balds, summits, and open slopes until the signal clears.`
        : "No nearby Tempest lightning signal is active right now."
    }
  };
}

function hikerScore(guidance) {
  const factors = [];
  let penalty = 0;
  const add = (amount, label) => {
    const value = round(amount, 1);
    if (value > 0) {
      penalty += value;
      factors.push({ label, penalty: value });
    }
  };
  if (guidance.lightning?.active) add(45, "Nearby lightning");
  add(guidance.fogRisk === "Elevated" ? 8 : guidance.fogRisk === "Patchy pockets" ? 4 : 0, "Fog or damp trail risk");
  add(guidance.maxUv == null ? 0 : clamp((guidance.maxUv - 2) * 2, 0, 18), "UV exposure");
  add(guidance.maxSolar == null ? 0 : clamp((guidance.maxSolar - 500) / 120, 0, 5), "Solar exposure");
  add(guidance.maxGust == null ? 0 : clamp((guidance.maxGust - 12) * 0.9, 0, 18), "Wind on exposed terrain");
  add(guidance.maxWbgt == null ? 0 : clamp((guidance.maxWbgt - 65) * 0.75, 0, 20), "Heat stress");
  add(guidance.maxTemp == null || guidance.maxWbgt != null ? 0 : clamp((guidance.maxTemp - 78) * 0.6, 0, 10), "Warm air temperature");
  add(guidance.maxRainRate == null ? 0 : clamp(guidance.maxRainRate * 80, 0, 12), "Active rain");
  add(guidance.maxRainToday == null ? 0 : clamp((guidance.maxRainToday - 0.1) * 8, 0, 8), "Wet ground");
  add(guidance.mitchellDrop == null ? 0 : clamp((guidance.mitchellDrop - 10) * 0.4, 0, 7), "High-peak temperature drop");
  add(guidance.localTempSpread == null ? 0 : clamp((guidance.localTempSpread - 4) * 0.6, 0, 8), "Local microclimate spread");
  return { score: Math.round(clamp(92 - penalty, 0, 100)), factors };
}

function hikerScoreLabel(score, lightningActive) {
  if (lightningActive) return "Alert";
  if (score >= 84) return "Great";
  if (score >= 70) return "Good";
  if (score >= 55) return "Mixed";
  return "Use care";
}

function hasLightningSignal(station, now, thresholdMiles = 10) {
  const lastStrikeAt = Date.parse(station.lightningLastEpoch);
  return Boolean(
    (finite(station.lightningStrikes1h) ?? 0) > 0 ||
    (finite(station.lightningStrikes3h) ?? 0) > 0 ||
    (Number.isFinite(lastStrikeAt) && now - lastStrikeAt <= LIGHTNING_SIGNAL_MAX_AGE_MS && (finite(station.lightningLastDistanceMiles) ?? Infinity) <= thresholdMiles)
  );
}

function lightningDetail(station) {
  if (!station) return null;
  const parts = [];
  if ((finite(station.lightningStrikes1h) ?? 0) > 0) parts.push(`${station.lightningStrikes1h} strike${station.lightningStrikes1h === 1 ? "" : "s"} in the last hour`);
  if ((finite(station.lightningStrikes3h) ?? 0) > 0) parts.push(`${station.lightningStrikes3h} strike${station.lightningStrikes3h === 1 ? "" : "s"} in the last 3 hours`);
  if (station.lightningLastDistanceMsg) parts.push(`last strike ${station.lightningLastDistanceMsg}`);
  else if (finite(station.lightningLastDistanceMiles) != null) parts.push(`last strike about ${format(station.lightningLastDistanceMiles, " miles")} away`);
  return parts.join(" · ");
}

function spread(stations) {
  const values = stations.map((station) => finite(station.temperatureF)).filter(Number.isFinite);
  return values.length ? Math.max(...values) - Math.min(...values) : null;
}

function average(stations, key) {
  const values = stations.map((station) => finite(station[key])).filter(Number.isFinite);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function maximum(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? Math.max(...usable) : null;
}

function sum(stations, key) {
  return stations.reduce((total, station) => total + (finite(station[key]) ?? 0), 0);
}

function uvFromSolar(solarWm2) {
  const value = finite(solarWm2);
  return value == null ? null : Math.max(0, Math.min(11, Math.round(value / 115)));
}

function finite(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 0) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function format(value, suffix = "") {
  return value == null ? "n/a" : `${Math.round(value)}${suffix}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
