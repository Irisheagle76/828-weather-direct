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
  const maxUv = Math.max(...usable.map((s) => s.uv ?? 0));
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
  const diagnostics = [
    ["Local spread", f(g.localTempSpread, "degF"), "Temperature range across the Asheville-area readings."],
    ["High split", f(g.highStationSpread, "degF"), "Difference between the two high Asheville readings."],
    ["Mitchell drop", f(g.mitchellDrop, "degF"), "Cooling from Asheville-area readings to Mount Mitchell."],
    ["Fog risk", g.fogRisk, "Based on the tightest temperature/dew point spread."],
    ["Peak sun", `${f(g.maxUv)} UV / ${f(g.maxSolar)} W/m2`, "Highest UV and solar signal from reporting sites."],
    ["Peak gust", f(g.maxGust, " mph"), "Highest gust among the reporting sites."]
  ];
  const trailCards = [
    ["Best bet", g.maxUv >= 5 || g.maxSolar >= 500 ? "Forested trails, shaded slopes, and routes with easy water breaks." : "Most nearby trails should feel comfortable."],
    ["Use care", g.maxUv >= 5 || g.maxSolar >= 500 ? "Open ridges, overlooks, pavement, and exposed rock." : "Typical mountain exposure: changing clouds, damp pockets, and breezy gaps."],
    ["Pack mindset", g.mitchellDrop >= 10 ? "Water and sun protection locally; add a layer for high peaks." : "Water, basic sun protection, and normal mountain layers."],
    ["Watch for", g.fogRisk === "Elevated" ? "Patchy fog, low cloud, wet leaves, and slick shaded spots." : "Quick comfort changes between shade and open sky."]
  ];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>828 Hiking Guidance</title>
  <link rel="stylesheet" href="/css/hiking.css?v=${Date.now()}" />
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
    <section class="hero">
      <div>
        <div class="kicker">Hiker read</div>
        <h1>${esc(g.bestWindow)}</h1>
        <p>${esc(g.hikerNarrative).replace(/degF/g, "°F")}</p>
        <div class="meta">Updated ${localTime(payload.generatedAt)} · ${s.filter((x) => x.status === "live").length}/${s.length} readings live</div>
      </div>
      <aside>
        <div class="kicker">TL;DR</div>
        <ul>${g.bullets.map((b) => `<li>${esc(b).replace(/degF/g, "°F")}</li>`).join("")}</ul>
      </aside>
    </section>

    <section class="panel">
      <div class="section-title"><span>Trail choice</span><h2>What this means on foot</h2></div>
      <div class="trail-grid">${trailCards.map(([a, b]) => `<div class="mini-card"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("")}</div>
    </section>

    <section class="panel">
      <div class="section-title"><span>Important hiker data</span><h2>Elevation and comfort signals</h2></div>
      <div class="diagnostic-grid">${diagnostics.map(([a, b, c]) => `<div class="metric-card"><span>${esc(a)}</span><strong>${esc(b).replace(/degF/g, "°F")}</strong><p>${esc(c)}</p></div>`).join("")}</div>
    </section>

    <section class="panel">
      <div class="section-title"><span>Station table</span><h2>Current readings by elevation</h2></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Place</th><th>Elev.</th><th>Temp</th><th>Dew pt</th><th>RH</th><th>Wind</th><th>Sun</th><th>Comfort</th></tr></thead>
          <tbody>
            ${s.sort((a, b) => a.elevationFt - b.elevationFt).map((x) => `<tr>
              <td><a href="${esc(x.url)}">${esc(x.name)}</a><br><span>${esc(x.role)} · ${esc(x.source)} · ${localTime(x.observedAt)}</span></td>
              <td>${f(x.elevationFt, " ft")}</td>
              <td>${f(x.temperatureF, "°")}</td>
              <td>${f(x.dewPointF, "°")}</td>
              <td>${f(x.humidityPct, "%")}</td>
              <td>${f(x.windMph, " mph")}${x.gustMph != null ? ` / ${f(x.gustMph)} gust` : ""} ${esc(x.windDirection || "")}</td>
              <td>${x.uv != null ? `UV ${f(x.uv)}` : ""}${x.solarWm2 != null ? ` · ${f(x.solarWm2)} W/m2` : ""}</td>
              <td>${x.wbgtF != null ? `WBGT ${f(x.wbgtF, "°")}` : "Layer check"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  </main>
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
