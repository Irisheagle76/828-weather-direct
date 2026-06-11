import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");
const jsonPath = path.join(outDir, "hiking-guidance.json");
const htmlPath = path.join(root, "public", "hiking.html");
const weatherFlowKey = "6bff2f89-84ab-463c-886e-fc0f443da4cf";
const weatherUndergroundKey = "e1f10a1e78da46f5b10a1e78da96f525";
const lightningSignalMaxAgeMs = 3 * 60 * 60 * 1000;

const tempestStations = [
  { id: "144737", name: "Lower Asheville", role: "Asheville city weather station", elevationFt: 2137, url: "https://tempestwx.com/station/144737/grid", lat: 35.60675829810566, lon: -82.54793450070898 },
  { id: "127602", name: "Mid Asheville", role: "north/east Asheville transition", elevationFt: 2316, url: "https://tempestwx.com/station/127602/grid", lat: 35.6154509046802, lon: -82.50548363971464 },
  { id: "160562", name: "High Asheville East", role: "nearby ridge reading", elevationFt: 3363, url: "https://tempestwx.com/station/160562/grid", lat: 35.624525314972594, lon: -82.51184579162579 },
  { id: "157700", name: "High Asheville North", role: "nearby ridge cross-check", elevationFt: 3371, url: "https://tempestwx.com/station/157700/grid", lat: 35.6422544091975, lon: -82.49614863661522 }
];

const userAgent = "828 Weather Direct hiking guidance (+https://avlweather.com)";

function n(value) {
  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits = 0) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function f(value, suffix = "") {
  return value == null ? "n/a" : `${Math.round(value)}${suffix}`;
}

function uvFromSolar(solarWm2) {
  if (solarWm2 == null) return null;
  return Math.max(0, Math.min(11, Math.round(solarWm2 / 115)));
}

function displayUv(station) {
  const uv = station.uv ?? uvFromSolar(station.solarWm2);
  return uv == null ? "n/a" : `UV ${uv}${station.uv == null ? " est." : ""}`;
}

function hasLightningSignal(station, thresholdMiles = 10) {
  const lastStrikeAt = station.lightningLastEpoch ? new Date(station.lightningLastEpoch).getTime() : null;
  const hasRecentLastStrike = Number.isFinite(lastStrikeAt) && (Date.now() - lastStrikeAt) <= lightningSignalMaxAgeMs;
  return Boolean(
    (station.lightningStrikes1h ?? 0) > 0 ||
    (station.lightningStrikes3h ?? 0) > 0 ||
    (
      hasRecentLastStrike &&
      station.lightningLastDistanceMiles != null &&
      station.lightningLastDistanceMiles <= thresholdMiles
    )
  );
}

function lightningDetail(station) {
  if (!station) return null;

  const parts = [];
  if ((station.lightningStrikes1h ?? 0) > 0) {
    parts.push(`${station.lightningStrikes1h} strike${station.lightningStrikes1h === 1 ? "" : "s"} in the last hour`);
  }
  if ((station.lightningStrikes3h ?? 0) > 0) {
    parts.push(`${station.lightningStrikes3h} strike${station.lightningStrikes3h === 1 ? "" : "s"} in the last 3 hours`);
  }

  if (station.lightningLastDistanceMsg) {
    parts.push(`last strike ${station.lightningLastDistanceMsg}`);
  } else if (station.lightningLastDistanceMiles != null) {
    parts.push(`last strike about ${f(station.lightningLastDistanceMiles, " miles")} away`);
  }

  if (station.lightningLastEpoch) {
    parts.push(`last detected ${localTime(station.lightningLastEpoch)}`);
  }

  return parts.join(" · ");
}

function heatFeel(station) {
  const wbgt = station.wbgtF;
  const temp = station.temperatureF;
  if (wbgt != null) {
    if (wbgt >= 82) return { label: "Heat caution", detail: `trail heat ${f(wbgt, "°")}` };
    if (wbgt >= 74) return { label: "Warm effort", detail: `trail heat ${f(wbgt, "°")}` };
    if (wbgt >= 65) return { label: "Comfortable", detail: `trail heat ${f(wbgt, "°")}` };
    return { label: "Easy", detail: `trail heat ${f(wbgt, "°")}` };
  }
  if (temp != null && temp <= 58) return { label: "Cool layer", detail: f(temp, "°") };
  if (temp != null && temp >= 78) return { label: "Warm", detail: f(temp, "°") };
  return { label: "Comfortable", detail: temp == null ? "" : f(temp, "°") };
}

function friendlyWind(station) {
  if (station.windMph == null) return "n/a";
  if (station.windMph === 0) return "Calm";
  const direction = normalizeDirection(station.windDirection);
  const base = `${direction ? `${direction} at ` : ""}${f(station.windMph)} mph`;
  const gust = station.gustMph != null && station.gustMph > station.windMph ? `, gusting to ${f(station.gustMph)} mph` : "";
  return `${base}${gust}`;
}

function normalizeDirection(direction) {
  if (!direction || direction === "N/A") return "";
  const text = String(direction).trim();
  if (/^(var|vrb|variable)$/i.test(text)) return "Variable";
  const degree = text.match(/^(-?\d+(?:\.\d+)?)deg$/i);
  if (!degree) return text;
  return degreesToCardinal(Number(degree[1]));
}

function degreesToCardinal(degrees) {
  if (!Number.isFinite(degrees)) return "";
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

function localTime(iso) {
  if (!iso) return "unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function asOfTime(iso) {
  return localTime(iso).replace(/\s([AP])M$/, (_, meridiem) => `${meridiem.toLowerCase()}m ET`);
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlValue(value) {
  return esc(value).replace(/degF/g, "&deg;F").replace(/°F/g, "&deg;F").replace(/°/g, "&deg;");
}

function hikerScore(g) {
  let score = 88;
  if (g.lightning?.active) score -= 30;
  if (g.maxUv >= 7) score -= 12;
  else if (g.maxUv >= 5) score -= 6;
  else if (g.maxUv >= 3) score -= 2;
  if (g.maxGust >= 25) score -= 15;
  else if (g.maxGust >= 15) score -= 6;
  if (g.fogRisk === "Elevated") score -= 10;
  else if (g.fogRisk === "Patchy pockets") score -= 4;
  if (g.mitchellDrop >= 15) score -= 5;
  else if (g.mitchellDrop >= 10) score -= 2;
  if (g.localTempSpread >= 8) score -= 4;
  else if (g.localTempSpread >= 5) score -= 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function readPrevious() {
  try {
    return JSON.parse(await fs.readFile(jsonPath, "utf8"));
  } catch {
    return null;
  }
}

async function fetchTempest(station) {
  const params = new URLSearchParams({
    api_key: weatherFlowKey,
    station_id: station.id,
    units_temp: "f",
    units_wind: "mph",
    units_pressure: "inhg",
    units_distance: "mi",
    units_precip: "in",
    units_other: "imperial",
    units_direction: "cardinal"
  });
  const response = await fetch(`https://swd.weatherflow.com/swd/rest/better_forecast?${params}`, {
    headers: { "user-agent": userAgent }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const c = data.current_conditions || {};
  return {
    source: "Tempest",
    id: `tempest-${station.id}`,
    stationId: station.id,
    name: station.name,
    role: station.role,
    elevationFt: station.elevationFt,
    url: station.url,
    lat: station.lat,
    lon: station.lon,
    status: "live",
    observedAt: c.time ? new Date(c.time * 1000).toISOString() : new Date().toISOString(),
    conditions: c.conditions ?? "Unknown",
    temperatureF: n(c.air_temperature),
    feelsLikeF: n(c.feels_like),
    dewPointF: n(c.dew_point),
    humidityPct: n(c.relative_humidity),
    windMph: n(c.wind_avg),
    gustMph: n(c.wind_gust),
    windDirection: c.wind_direction_cardinal ?? null,
    uv: n(c.uv),
    solarWm2: n(c.solar_radiation),
    lightningStrikes1h: n(c.lightning_strike_count_last_1hr),
    lightningStrikes3h: n(c.lightning_strike_count_last_3hr),
    lightningLastDistanceMiles: n(c.lightning_strike_last_distance),
    lightningLastDistanceMsg: c.lightning_strike_last_distance_msg ?? null,
    lightningLastEpoch: c.lightning_strike_last_epoch ? new Date(c.lightning_strike_last_epoch * 1000).toISOString() : null,
    wbgtF: n(c.wet_bulb_globe_temperature),
    wetBulbF: n(c.wet_bulb_temperature),
    rainTodayIn: n(c.precip_accum_local_day),
    rainRateInHr: n(c.precip_rate ?? 0),
    pressureTrend: c.pressure_trend ?? null
  };
}

async function fetchMitchell() {
  const response = await fetch("https://nchighpeaks.org/davis/RSS/weewx_rss.xml", {
    headers: { "user-agent": userAgent }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const xml = await response.text();
  const pubDate = xml.match(/<lastBuildDate>([^<]+)<\/lastBuildDate>/)?.[1]
    || xml.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1];
  const encoded = xml.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/)?.[1] || "";
  const block = encoded.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&#176;/g, "deg");
  const field = (label) => block.match(new RegExp(`${label}:\\s*([^\\n;]+)`, "i"))?.[1]?.trim();
  const windText = field("Wind") || "";
  const wind = windText.match(/([\d.]+)\s*mph\s*from\s*(.*)$/i);
  return {
    source: "NCHighPeaks WeeWX",
    id: "mount-mitchell",
    name: "Mount Mitchell",
    role: "WNC high-peak reading",
    elevationFt: 6684,
    url: "https://nchighpeaks.org/davis/RSS/weewx_rss.xml",
    status: "live",
    observedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    conditions: "Current conditions",
    temperatureF: n(field("Outside Temperature")),
    feelsLikeF: n(field("Wind Chill")) ?? n(field("Heat Index")),
    dewPointF: n(field("Dew Point")),
    humidityPct: n(field("Humidity")),
    windMph: wind ? n(wind[1]) : null,
    gustMph: null,
    windDirection: wind ? wind[2].trim() : null,
    uv: null,
    solarWm2: null,
    wbgtF: null,
    wetBulbF: null,
    rainTodayIn: null,
    rainRateInHr: n(field("Rain Rate")),
    pressureTrend: null
  };
}

async function fetchMaxPatch() {
  const params = new URLSearchParams({
    stationId: "KTNDELRI5",
    format: "json",
    units: "e",
    numericPrecision: "decimal",
    apiKey: weatherUndergroundKey
  });
  const response = await fetch(`https://api.weather.com/v2/pws/observations/current?${params}`, {
    headers: { "user-agent": userAgent }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const data = await response.json();
  const observation = data.observations?.[0];
  if (!observation) throw new Error("Weather Underground returned no current observation");
  const imperial = observation.imperial || {};
  return {
    source: "Weather Underground",
    id: "max-patch",
    stationId: observation.stationID || "KTNDELRI5",
    name: "Max Patch",
    role: "high-elevation bald reading",
    elevationFt: 4420,
    url: "https://www.wunderground.com/dashboard/pws/KTNDELRI5",
    lat: n(observation.lat),
    lon: n(observation.lon),
    status: "live",
    observedAt: observation.obsTimeUtc || new Date().toISOString(),
    conditions: "Current conditions",
    temperatureF: n(imperial.temp),
    feelsLikeF: n(imperial.heatIndex) ?? n(imperial.windChill) ?? n(imperial.temp),
    dewPointF: n(imperial.dewpt),
    humidityPct: n(observation.humidity),
    windMph: n(imperial.windSpeed),
    gustMph: n(imperial.windGust),
    windDirection: observation.winddir == null ? null : `${observation.winddir}deg`,
    uv: n(observation.uv),
    solarWm2: n(observation.solarRadiation),
    wbgtF: null,
    wetBulbF: null,
    rainTodayIn: n(imperial.precipTotal),
    rainRateInHr: n(imperial.precipRate),
    pressureTrend: null
  };
}

async function withFallback(fetcher, id, previousById) {
  try {
    return await fetcher();
  } catch (error) {
    const previous = previousById.get(id);
    if (previous) {
      return { ...previous, status: "stale", error: error.message };
    }
    return { id, name: id, status: "unavailable", error: error.message };
  }
}

function spread(stations) {
  const temps = stations.map((s) => s.temperatureF).filter((v) => v != null);
  return temps.length ? Math.max(...temps) - Math.min(...temps) : null;
}

function analyze(stations) {
  const usable = stations.filter((s) => s.temperatureF != null);
  const asheville = stations.filter((s) => s.id.startsWith("tempest-"));
  const localTempSpread = spread(asheville);
  const highs = stations.filter((s) => s.id === "tempest-160562" || s.id === "tempest-157700");
  const highStationSpread = spread(highs);
  const lower = stations.find((s) => s.id === "tempest-144737");
  const high = highs.find((s) => s.temperatureF != null);
  const mitchell = stations.find((s) => s.id === "mount-mitchell");
  const localAvg = asheville.filter((s) => s.temperatureF != null).reduce((sum, s, _, arr) => sum + s.temperatureF / arr.length, 0);
  const lapseRate = lower?.temperatureF != null && high?.temperatureF != null
    ? (lower.temperatureF - high.temperatureF) / ((high.elevationFt - lower.elevationFt) / 1000)
    : null;
  const mitchellDrop = localAvg && mitchell?.temperatureF != null ? localAvg - mitchell.temperatureF : null;
  const wncLapseRate = lower?.temperatureF != null && mitchell?.temperatureF != null
    ? (lower.temperatureF - mitchell.temperatureF) / ((mitchell.elevationFt - lower.elevationFt) / 1000)
    : null;
  const dewSpreads = usable.map((s) => s.temperatureF - s.dewPointF).filter((v) => Number.isFinite(v));
  const minDewSpread = dewSpreads.length ? Math.min(...dewSpreads) : null;
  const maxUv = Math.max(...usable.map((s) => s.uv ?? uvFromSolar(s.solarWm2) ?? 0));
  const maxSolar = Math.max(...usable.map((s) => s.solarWm2 ?? 0));
  const maxGust = Math.max(...usable.map((s) => s.gustMph ?? s.windMph ?? 0));
  const maxTemp = Math.max(...usable.map((s) => s.temperatureF ?? -Infinity));
  const maxWbgt = Math.max(...usable.map((s) => s.wbgtF ?? -Infinity));
  const lightningStations = stations.filter((s) => s.source === "Tempest" && hasLightningSignal(s));
  const nearestLightningStation = lightningStations
    .slice()
    .sort((a, b) => (a.lightningLastDistanceMiles ?? Infinity) - (b.lightningLastDistanceMiles ?? Infinity))[0] || null;
  const lightningActive = lightningStations.length > 0;
  const lightningCounts1h = lightningStations.reduce((sum, station) => sum + (station.lightningStrikes1h ?? 0), 0);
  const lightningCounts3h = lightningStations.reduce((sum, station) => sum + (station.lightningStrikes3h ?? 0), 0);
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
    : `If you are heading out, Asheville-area trails look ${overall.toLowerCase()}. The nearby readings sit within about ${f(localTempSpread, "degF")} of each other, so elevation alone may not change the feel very much. The two high Asheville readings ${highStationSpread != null && highStationSpread >= 4 ? "differ enough to show local microclimates at work" : "are telling a similar ridge story"}, which means shade, slope, and open exposure still matter. Mount Mitchell is about ${f(mitchellDrop, "degF")} cooler than the Asheville-area readings, so high-peak hikes deserve an extra layer and a separate comfort check. ${fogRisk === "Elevated" ? "Moisture is close enough for fog, low cloud, or wet leaves in sheltered spots." : "Fog is not the main signal right now."} ${maxSolar >= 500 || maxUv >= 5 ? "Open routes need sun awareness and steady water; forested trails should feel more forgiving." : "Sun exposure is manageable, especially under canopy."}`;
  const bullets = [
    lightningActive
      ? `Lightning alert: ${nearestLightningStation ? nearestLightningStation.name : "Tempest"} reports nearby lightning. Stay off exposed terrain.`
      : `${overall}: ${bestWindow}`,
    localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${f(localTempSpread, "degF")}.`,
    highStationSpread != null && highStationSpread >= 4 ? "High Asheville readings show a microclimate split." : "High Asheville readings broadly agree.",
    mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${f(mitchellDrop, "degF")} cooler than the Asheville-area readings.`,
    fogRisk === "Elevated" ? "Fog/low cloud or damp vegetation may linger in pockets." : "Fog risk is not the lead concern.",
    maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light at the reporting sites.",
    maxUv >= 5 || maxSolar >= 500 ? "Sun exposure matters on open routes." : "Sun exposure is manageable right now."
  ];
  return {
    overall,
    bestWindow,
    hikerNarrative,
    bullets,
    localTempSpread: round(localTempSpread, 1),
    highStationSpread: round(highStationSpread, 1),
    lapseRate: round(lapseRate, 1),
    mitchellDrop: round(mitchellDrop, 1),
    wncLapseRate: round(wncLapseRate, 1),
    fogRisk,
    maxUv: maxUv === -Infinity ? null : maxUv,
    maxSolar: maxSolar === -Infinity ? null : round(maxSolar),
    maxGust: maxGust === -Infinity ? null : round(maxGust, 1),
    maxWbgt: maxWbgt === -Infinity ? null : round(maxWbgt, 1),
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

function renderHtml(payload) {
  const s = payload.stations;
  const g = payload.guidance;
  const lightningActive = Boolean(g.lightning?.active);
  const sortedStations = [...s].sort((a, b) => a.elevationFt - b.elevationFt);
  const diagnostics = [
    ["Local spread", f(g.localTempSpread, "degF"), "Temperature range across the Asheville-area readings."],
    ["High split", f(g.highStationSpread, "degF"), "Difference between the two high Asheville readings."],
    ["Mitchell drop", f(g.mitchellDrop, "degF"), "Cooling from Asheville-area readings to Mount Mitchell."],
    ["Fog risk", g.fogRisk, "Based on the tightest temperature/dew point spread."],
    ["Highest UV", f(g.maxUv), "Peak UV reading or estimate from the reporting sites."],
    ["Peak gust", f(g.maxGust, " mph"), "Highest gust among the reporting sites."]
  ];
  const trailCards = [
    lightningActive
      ? ["Best bet", "Sheltered low-elevation routes only if you must go; exposed terrain is a no-go until the lightning clears."]
      : ["Best bet", g.maxUv >= 5 || g.maxSolar >= 500 ? "Forested trails, shaded slopes, and routes with easy water breaks." : "Most nearby trails should feel comfortable."],
    lightningActive
      ? ["Use care", "Open ridges, balds, summits, overlooks, and pavement are the places to avoid."]
      : ["Use care", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open ridges, overlooks, pavement, and exposed rock." : "Typical mountain exposure: changing clouds, damp pockets, and breezy gaps."],
    ["Pack mindset", g.mitchellDrop >= 10 ? "Water and sun protection locally; add a layer for high peaks." : "Water, basic sun protection, and normal mountain layers."]
  ];
  const comparisonCards = [
    ["Mountain vs Asheville", g.mitchellDrop == null ? "Mount Mitchell comparison is unavailable right now." : `Mount Mitchell is about ${f(g.mitchellDrop, "degF")} cooler than the Asheville-area readings.`],
    ["Ridge vs Valley", g.highStationSpread != null && g.highStationSpread >= 4 ? "Nearby ridge readings show a microclimate split, so shade, slope, and exposure still matter." : "High Asheville readings broadly agree, but exposed ridges can still change the feel."],
    ["Sun exposure", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open overlooks, rock, and pavement need sun awareness and steady water." : "Sun exposure is manageable now, especially under canopy."],
    ["Wind check", g.maxGust >= 20 ? "Wind matters on exposed terrain and higher gaps." : "Wind is light at the reporting sites, so comfort is mostly about sun, shade, and layers."]
  ];
  const score = hikerScore(g);
  const scoreLabel = lightningActive ? "Alert" : score >= 82 ? "Great" : score >= 70 ? "Good" : score >= 55 ? "Mixed" : "Use care";
  const tldrBullets = [
    lightningActive ? "Tempest lightning is nearby. Avoid exposed terrain until the signal clears." : g.bestWindow,
    g.localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${f(g.localTempSpread, "degF")}.`,
    g.mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${f(g.mitchellDrop, "degF")} cooler than Asheville.`,
    g.maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light; sun exposure is the main watch item."
  ];
  const profileXs = sortedStations.map((_, index) => 145 + index * (810 / Math.max(1, sortedStations.length - 1)));
  const profileStations = sortedStations.map((x, index) => {
    const y = Math.round(440 - ((x.elevationFt - 1000) / 6000) * 320);
    const words = x.name.split(" ");
    const nameLines = words.length > 2 ? [words.slice(0, -1).join(" "), words.slice(-1)[0]] : [x.name];
    const zone = x.elevationFt >= 6000 ? "WNC high peak" : x.elevationFt >= 3200 ? "High Asheville ridge" : x.elevationFt >= 2300 ? "Mid Asheville" : "Lower Asheville";
    return { ...x, x: profileXs[index] ?? 900, y, nameLines, zone };
  });
  const ridgePath = profileStations.map((x, index) => `${index === 0 ? "M" : "L"} ${x.x} ${x.y}`).join(" ");
  const areaPath = `${ridgePath} L 1065 450 L 55 450 Z`;
  const lightningBanner = g.lightning?.active ? `
    <section class="lightning-banner" role="alert" aria-live="assertive">
      <div class="lightning-mark" aria-hidden="true">⚡</div>
      <div class="lightning-copy">
        <div class="lightning-kicker">Lightning alert</div>
        <h2>Tempest lightning may be in the vicinity of your hike</h2>
        <p>${htmlValue(g.lightning.summary)}</p>
        ${g.lightning.details ? `<div class="lightning-meta">${htmlValue(g.lightning.details)}</div>` : ""}
      </div>
    </section>
  ` : "";
  const elevationProfile = profileStations.map((x, index) => {
    const labelY = Math.max(72, x.y - 74);
    const bottomName = x.name.replace(" Weather Tower", "").replace("Asheville ", "");
    return `<g class="profile-site">
      <line class="profile-stem" x1="${x.x}" y1="${x.y + 13}" x2="${x.x}" y2="450" />
      <circle class="profile-dot" cx="${x.x}" cy="${x.y}" r="10" />
      <text class="profile-label" x="${x.x}" y="${labelY}" text-anchor="middle">
        ${x.nameLines.map((line, i) => `<tspan x="${x.x}" dy="${i === 0 ? 0 : 20}">${esc(line)}</tspan>`).join("")}
      </text>
      <text class="profile-elev" x="${x.x}" y="${labelY + (x.nameLines.length * 20) + 14}" text-anchor="middle">${f(x.elevationFt, " ft")}</text>
      <circle class="profile-base-dot" cx="${x.x}" cy="450" r="4" />
      <text class="profile-bottom-name" x="${x.x}" y="480" text-anchor="middle">${esc(bottomName)}</text>
      <text class="profile-bottom-temp" x="${x.x}" y="505" text-anchor="middle">${f(x.temperatureF, "°")}</text>
    </g>`;
  }).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>828 Hiking Guidance</title>
  <link rel="stylesheet" href="css/hiking.css?v=${Date.now()}" />
</head>
<body>
  <header class="hiking-header">
    <div>
      <div class="brand-title">828 Hiking Guidance</div>
      <div class="brand-sub">Elevation-aware trail weather for Asheville and the WNC high peaks</div>
    </div>
    <div class="status-pill">${esc(g.overall)}</div>
  </header>

  <main class="hiking-wrap">
    ${lightningBanner}
    <section class="hikerscore-hero panel panel-read ${g.lightning?.active ? "panel-lightning" : ""}">
      <div class="hikerscore-main">
        <div class="kicker">HikerScore</div>
        <div class="score-row">
          <div class="score-badge">
            <strong>${score}</strong>
            <span>${esc(scoreLabel)}</span>
          </div>
          <div class="score-copy">
            <div class="status-pill hero-status">${esc(g.lightning?.active ? "Lightning alert" : "Good, watch sun")}</div>
            <h1>${esc(g.bestWindow)}</h1>
          </div>
        </div>

        <div class="stat-chip-row" aria-label="Quick hiking stats">
          <div class="stat-chip"><span>Asheville spread</span><strong>${htmlValue(f(g.localTempSpread, "degF"))}</strong></div>
          <div class="stat-chip"><span>Mitchell drop</span><strong>${htmlValue(f(g.mitchellDrop, "degF"))}</strong></div>
          <div class="stat-chip"><span>Peak UV</span><strong>${esc(f(g.maxUv))}</strong></div>
        </div>

        <details class="hiker-details">
          <summary>Full hiker read</summary>
          <p>${htmlValue(g.hikerNarrative)}</p>
        </details>

        <div class="meta">Updated ${localTime(payload.generatedAt)} &middot; ${s.filter((x) => x.status === "live").length}/${s.length} readings live</div>
      </div>

      <aside class="tldr-card">
        <div class="kicker">TL;DR</div>
        <ul>${tldrBullets.map((b) => `<li>${htmlValue(b)}</li>`).join("")}</ul>
      </aside>
    </section>

    <section class="panel panel-choice">
      <div class="section-title"><span>Trail choice</span><h2>What this means on foot</h2></div>
      <div class="trail-grid trail-grid-three">${trailCards.map(([a, b]) => `<div class="mini-card"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("")}</div>
    </section>

    <section class="panel panel-profile">
      <div class="section-title"><span>Where these readings are</span><h2>Elevation profile</h2></div>
      <p class="profile-intro">A quick visual of the reporting sites, from lower Asheville up to Mount Mitchell. This helps explain what "high Asheville" and "high peaks" mean in the trail guidance.</p>
      <div class="profile-art" role="img" aria-label="Elevation profile of Asheville-area weather readings up to Mount Mitchell">
        <svg viewBox="0 0 1080 540" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="profileFill" x1="0" x2="1" y1="1" y2="0">
              <stop offset="0%" stop-color="#5bd27c" />
              <stop offset="52%" stop-color="#4eb4c8" />
              <stop offset="100%" stop-color="#357cff" />
            </linearGradient>
          </defs>
          <rect class="profile-bg" x="0" y="0" width="1080" height="540" rx="22" />
          <text class="profile-axis-title" x="96" y="90">ELEVATION (FT)</text>
          <line class="profile-axis" x1="94" y1="220" x2="94" y2="450" />
          ${[7000,6000,5000,4000,3000,2000,1000].map((tick) => {
            const y = Math.round(450 - ((tick - 1000) / 6000) * 320);
            return `<g><line class="profile-tick" x1="88" y1="${y}" x2="94" y2="${y}" /><text class="profile-tick-label" x="78" y="${y + 6}" text-anchor="end">${tick.toLocaleString()}</text></g>`;
          }).join("")}
          <path class="profile-area" d="${areaPath}" />
          <path class="profile-ridge" d="${ridgePath}" />
          <path class="profile-forest" d="M55 450 C110 405 158 428 205 392 C246 365 282 414 330 376 C372 344 420 390 468 354 C514 318 556 378 604 328 C650 286 704 354 750 294 C796 232 840 324 886 242 C922 170 948 214 984 112 C1020 158 1046 160 1065 176 L1065 450 Z" />
          ${elevationProfile}
        </svg>
      </div>
    </section>

    <section class="panel panel-compare">
      <div class="section-title"><span>Trail comparisons</span><h2>What changes by route type</h2></div>
      <div class="comparison-grid">${comparisonCards.map(([a, b]) => `<div class="comparison-card"><strong>${esc(a)}</strong><span>${htmlValue(b)}</span></div>`).join("")}</div>
    </section>

    <section class="panel panel-data">
      <div class="section-title"><span>Important hiker data</span><h2>Elevation and comfort signals</h2></div>
      <div class="diagnostic-grid">${diagnostics.map(([a, b, c]) => `<div class="metric-card"><span>${esc(a)}</span><strong>${htmlValue(b)}</strong><p>${esc(c)}</p></div>`).join("")}</div>
    </section>

    <section class="panel panel-table">
      <div class="section-title section-title-row"><span>Station check</span><h2>Current readings by elevation</h2><em>As of ${asOfTime(payload.generatedAt)}</em></div>
      <div class="station-grid">
        ${sortedStations.map((x) => {
          const feel = heatFeel(x);
          return `<a class="station-card" href="${esc(x.url)}">
          <div class="station-card-top">
            <div>
              <strong>${esc(x.name)}</strong>
              <span class="station-elevation">${f(x.elevationFt, " ft")}</span>
            </div>
            <div class="station-temp">${htmlValue(f(x.temperatureF, "°"))}</div>
          </div>
          <div class="station-feel"><span>${esc(feel.label)}</span><strong>${htmlValue(feel.detail)}</strong></div>
          <div class="station-metrics">
            <span><b>Source</b>${esc(x.source)}</span>
            <span><b>Dew</b>${htmlValue(f(x.dewPointF, "°"))}</span>
            <span><b>Humid</b>${f(x.humidityPct, "%")}</span>
            <span><b>Wind</b>${esc(friendlyWind(x))}</span>
            <span><b>UV</b>${esc(displayUv(x))}</span>
          </div>
        </a>`;
        }).join("")}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="footer-logo">828 Weather Direct</div>
        <div class="footer-tagline">
          Hyper-local weather, written for how it actually feels across Western North Carolina.
        </div>
      </div>

      <div class="footer-links">
        <a href="/">Home</a>
        <a href="/forecast.html">Forecast</a>
        <a href="/hiking.html">Hiking Guidance</a>
        <a href="https://www.linkedin.com/in/timballisty">About</a>
        <a href="mailto:tballisty@gmail.com">Contact</a>
      </div>

      <div class="footer-meta">
        <div>Data: Tempest • Weather Underground • NCHighPeaks WeeWX</div>
        <div>Serving Asheville and the greater 828 region</div>
        <div class="footer-disclaimer">
          For general awareness only—not a substitute for official forecasts, warnings, or trail advisories.
        </div>
      </div>

      <div class="footer-bottom">
        &copy; 2026 828 Weather Direct
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

const previous = await readPrevious();
const previousById = new Map((previous?.stations || []).map((s) => [s.id, s]));
const stations = [
  ...(await Promise.all(tempestStations.map((station) => withFallback(() => fetchTempest(station), `tempest-${station.id}`, previousById)))),
  await withFallback(fetchMaxPatch, "max-patch", previousById),
  await withFallback(fetchMitchell, "mount-mitchell", previousById)
];
const payload = {
  generatedAt: new Date().toISOString(),
  stations,
  guidance: analyze(stations)
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`Updated ${path.relative(root, jsonPath)}; live hiking page reads this data client-side.`);




