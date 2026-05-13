import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data");
const jsonPath = path.join(outDir, "hiking-guidance.json");
const htmlPath = path.join(root, "public", "hiking.html");
const weatherFlowKey = "6bff2f89-84ab-463c-886e-fc0f443da4cf";

const tempestStations = [
  { id: "144737", name: "Lower Asheville", role: "lower trailhead feel", elevationFt: 2137, url: "https://tempestwx.com/station/144737/grid", lat: 35.60675829810566, lon: -82.54793450070898 },
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

function parseClimateValue(text, code) {
  const i = text.indexOf(code);
  if (i < 0) return null;
  const snip = text.slice(Math.max(0, i - 160), i + 220);
  const match = snip.match(new RegExp(`${code} (-?[0-9.]+|-) ([^ ]+)`));
  return match && match[1] !== "-" ? n(match[1]) : null;
}

async function fetchUnca() {
  const response = await fetch("https://api.climate.ncsu.edu/locations?id=UNCA", {
    headers: { "user-agent": userAgent }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const html = await response.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const overview = text.match(/UNCA Latest Conditions Overview ([\s\S]*?) Station Active/)?.[1]?.trim();
  const observedAt = overview ? new Date(`${overview} EDT`).toISOString() : new Date().toISOString();
  const windDirDegrees = parseClimateValue(text, "winddir10m");
  return {
    source: "NC Climate Office",
    id: "unca",
    name: "UNCA Weather Tower",
    role: "instrumented comfort reference",
    elevationFt: 2367,
    url: "https://api.climate.ncsu.edu/locations?id=UNCA",
    lat: 35.62233,
    lon: -82.56646,
    status: "live",
    observedAt,
    conditions: "Current conditions",
    temperatureF: parseClimateValue(text, "airtemp2m"),
    feelsLikeF: parseClimateValue(text, "airtemp2m"),
    airTemp9mF: parseClimateValue(text, "airtemp9m"),
    dewPointF: parseClimateValue(text, "dewtemp2m"),
    humidityPct: parseClimateValue(text, "rh2m"),
    windMph: parseClimateValue(text, "windspeed10m"),
    gustMph: parseClimateValue(text, "gustspeed10m"),
    windDirection: windDirDegrees == null ? null : `${Math.round(windDirDegrees)}deg`,
    uv: null,
    solarWm2: parseClimateValue(text, "rad2m_total"),
    blackGlobeF: parseClimateValue(text, "blackglobetemp2m"),
    wbgtF: parseClimateValue(text, "wbgt2m"),
    wetBulbF: parseClimateValue(text, "wetbulbtemp2m"),
    rainTodayIn: parseClimateValue(text, "precip1m"),
    rainRateInHr: 0,
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
  const asheville = stations.filter((s) => s.id.startsWith("tempest-") || s.id === "unca");
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
  const fogRisk = minDewSpread == null ? "Unknown" : minDewSpread <= 4 ? "Elevated" : minDewSpread <= 8 ? "Patchy pockets" : "Low";
  const overall = maxTemp >= 84 || maxWbgt >= 78 ? "Warm, choose shade" : maxUv >= 7 ? "Good, watch sun" : maxGust >= 25 ? "Good, watch wind" : "Good for most hikes";
  const bestWindow = maxTemp >= 78 || maxUv >= 7
    ? "Forest shade is the friendliest choice; open ridges and pavement will feel warmer."
    : fogRisk === "Elevated"
      ? "Good overall, but expect damp pockets, wet leaves, or low cloud early."
      : "Most nearby trails look friendly, with normal mountain checks.";
  const hikerNarrative = `If you are heading out, Asheville-area trails look ${overall.toLowerCase()}. The nearby readings sit within about ${f(localTempSpread, "degF")} of each other, so elevation alone may not change the feel very much. The two high Asheville readings ${highStationSpread != null && highStationSpread >= 4 ? "differ enough to show local microclimates at work" : "are telling a similar ridge story"}, which means shade, slope, and open exposure still matter. Mount Mitchell is about ${f(mitchellDrop, "degF")} cooler than the Asheville-area readings, so high-peak hikes deserve an extra layer and a separate comfort check. ${fogRisk === "Elevated" ? "Moisture is close enough for fog, low cloud, or wet leaves in sheltered spots." : "Fog is not the main signal right now."} ${maxSolar >= 500 || maxUv >= 5 ? "Open routes need sun awareness and steady water; forested trails should feel more forgiving." : "Sun exposure is manageable, especially under canopy."}`;
  const bullets = [
    `${overall}: ${bestWindow}`,
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
    maxWbgt: maxWbgt === -Infinity ? null : round(maxWbgt, 1)
  };
}

function renderHtml(payload) {
  const s = payload.stations;
  const g = payload.guidance;
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
    ["Best bet", g.maxUv >= 5 || g.maxSolar >= 500 ? "Forested trails, shaded slopes, and routes with easy water breaks." : "Most nearby trails should feel comfortable."],
    ["Use care", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open ridges, overlooks, pavement, and exposed rock." : "Typical mountain exposure: changing clouds, damp pockets, and breezy gaps."],
    ["Pack mindset", g.mitchellDrop >= 10 ? "Water and sun protection locally; add a layer for high peaks." : "Water, basic sun protection, and normal mountain layers."]
  ];
  const comparisonCards = [
    ["Mountain vs Asheville", g.mitchellDrop == null ? "Mount Mitchell comparison is unavailable right now." : `Mount Mitchell is about ${f(g.mitchellDrop, "degF")} cooler than the Asheville-area readings.`],
    ["Ridge vs Valley", g.highStationSpread != null && g.highStationSpread >= 4 ? "Nearby ridge readings show a microclimate split, so shade, slope, and exposure still matter." : "High Asheville readings broadly agree, but exposed ridges can still change the feel."],
    ["Sun exposure", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open overlooks, rock, and pavement need sun awareness and steady water." : "Sun exposure is manageable now, especially under canopy."],
    ["Wind check", g.maxGust >= 20 ? "Wind matters on exposed terrain and higher gaps." : "Wind is light at the reporting sites, so comfort is mostly about sun, shade, and layers."]
  ];
  const score = hikerScore(g);
  const scoreLabel = score >= 82 ? "Great" : score >= 70 ? "Good" : score >= 55 ? "Mixed" : "Use care";
  const tldrBullets = [
    g.bestWindow,
    g.localTempSpread == null ? "Local temperature spread unavailable." : `Asheville-area spread is about ${f(g.localTempSpread, "degF")}.`,
    g.mitchellDrop == null ? "Mount Mitchell comparison unavailable." : `Mount Mitchell is about ${f(g.mitchellDrop, "degF")} cooler than Asheville.`,
    g.maxGust >= 20 ? "Wind matters on exposed terrain." : "Wind is light; sun exposure is the main watch item."
  ];
  const profileXs = [145, 305, 455, 635, 790, 955];
  const profileStations = sortedStations.map((x, index) => {
    const y = Math.round(440 - ((x.elevationFt - 1000) / 6000) * 320);
    const words = x.name.split(" ");
    const nameLines = x.name === "UNCA Weather Tower" ? ["UNCA", "Weather Tower"] : words.length > 2 ? [words.slice(0, -1).join(" "), words.slice(-1)[0]] : [x.name];
    const zone = x.elevationFt >= 6000 ? "WNC high peak" : x.elevationFt >= 3200 ? "High Asheville ridge" : x.elevationFt >= 2300 ? "Mid Asheville" : "Lower Asheville";
    return { ...x, x: profileXs[index] ?? 900, y, nameLines, zone };
  });
  const ridgePath = profileStations.map((x, index) => `${index === 0 ? "M" : "L"} ${x.x} ${x.y}`).join(" ");
  const areaPath = `${ridgePath} L 1065 450 L 55 450 Z`;
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
    <section class="hikerscore-hero panel panel-read">
      <div class="hikerscore-main">
        <div class="kicker">HikerScore</div>
        <div class="score-row">
          <div class="score-badge">
            <strong>${score}</strong>
            <span>${esc(scoreLabel)}</span>
          </div>
          <div class="score-copy">
            <div class="status-pill hero-status">Good, watch sun</div>
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
      <div class="section-title"><span>Station table</span><h2>Current readings by elevation</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Place</th><th>Elev.</th><th>Air</th><th>Dew pt</th><th>Humidity</th><th>Wind</th><th>UV</th><th>Heat feel</th></tr></thead>
          <tbody>
            ${sortedStations.map((x) => `<tr>
              <td><a href="${esc(x.url)}">${esc(x.name)}</a><br><span>${esc(x.role)} · ${esc(x.source)} · ${localTime(x.observedAt)}</span></td>
              <td class="nowrap">${f(x.elevationFt, " ft")}</td>
              <td>${f(x.temperatureF, "°")}</td>
              <td>${f(x.dewPointF, "°")}</td>
              <td>${f(x.humidityPct, "%")}</td>
              <td>${esc(friendlyWind(x))}</td>
              <td>${esc(displayUv(x))}</td>
              <td><strong>${esc(heatFeel(x).label)}</strong><br><span>${esc(heatFeel(x).detail)}</span></td>
            </tr>`).join("")}
          </tbody>
        </table>
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
        <div>Data: Tempest • NC Climate Office • NCHighPeaks WeeWX</div>
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
  await withFallback(fetchUnca, "unca", previousById),
  await withFallback(fetchMitchell, "mount-mitchell", previousById)
];
const payload = {
  generatedAt: new Date().toISOString(),
  stations,
  guidance: analyze(stations)
};

await fs.mkdir(outDir, { recursive: true });
await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await fs.writeFile(htmlPath, renderHtml(payload), "utf8");
console.log(`Updated ${path.relative(root, jsonPath)} and ${path.relative(root, htmlPath)}`);




