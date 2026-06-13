const ROUTE_BASE = "/api/router?route=";
const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };

const corridorPoints = [
  [35.542, -82.612],
  [35.557, -82.604],
  [35.575, -82.593],
  [35.588, -82.579],
  [35.596, -82.570],
  [35.606, -82.574],
  [35.620, -82.570]
];

let map;
let eventLayer;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function formatTime(value) {
  if (!value) return "Time not listed";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York"
  }).format(new Date(value));
}

function initMap() {
  if (!window.L) return;
  map = L.map("connectorMap", { scrollWheelZoom: false }).setView([35.586, -82.582], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.polyline(corridorPoints, {
    color: "#ffffff",
    weight: 13,
    opacity: 0.9,
    lineCap: "round",
    lineJoin: "round",
    interactive: false
  }).addTo(map);
  L.polyline(corridorPoints, {
    color: "#0d4fc7",
    weight: 7,
    opacity: 0.92,
    lineCap: "round",
    lineJoin: "round"
  }).bindPopup("<strong>Approximate I-26 Connector corridor</strong><br>Orientation reference only, not an engineering alignment.").addTo(map);

  addCorridorLabel([35.582, -82.588], "Approx. Connector corridor", "corridor-label", [150, 24], [-75, -12]);
  addCorridorLabel([35.548, -82.608], "Southern interchanges", "corridor-node", [120, 22], [-126, 7]);
  addCorridorLabel([35.596, -82.570], "French Broad / downtown", "corridor-node", [132, 22], [10, -10]);
  addCorridorLabel([35.620, -82.570], "North toward Woodfin", "corridor-node", [120, 22], [10, -10]);
  eventLayer = L.layerGroup().addTo(map);
}

function addCorridorLabel(position, label, className, iconSize, iconAnchor) {
  L.marker(position, {
    interactive: false,
    keyboard: false,
    icon: L.divIcon({
      className,
      html: className === "corridor-node" ? `<span>${label}</span>` : label,
      iconSize,
      iconAnchor
    })
  }).addTo(map);
}

function eventColor(event) {
  return event.fullClosure || event.condition.toLowerCase().includes("closed") ? "#c9352b" : "#f47b20";
}

function renderIncidents(incidents = []) {
  const list = document.querySelector("#incidentList");
  const closures = incidents.filter((event) => event.fullClosure || event.condition.toLowerCase().includes("closed"));
  document.querySelector("#incidentCount").textContent = incidents.length ? String(incidents.length) : "None listed";
  document.querySelector("#closureCount").textContent = String(closures.length);

  if (eventLayer) eventLayer.clearLayers();
  incidents.forEach((event) => {
    if (!eventLayer) return;
    const marker = L.circleMarker([event.latitude, event.longitude], {
      radius: event.fullClosure ? 9 : 7,
      color: "#fff",
      weight: 2,
      fillColor: eventColor(event),
      fillOpacity: 1
    });
    marker.bindPopup(`<strong>${escapeHtml(event.road)}</strong><br>${escapeHtml(event.description)}<br><a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">Open in DriveNC</a>`);
    marker.addTo(eventLayer);
  });

  if (!incidents.length) {
    list.innerHTML = '<article class="loading-card">No active NCDOT events are currently listed inside the Connector map area. Check DriveNC before travel.</article>';
    return;
  }

  list.innerHTML = incidents.slice(0, 8).map((event) => {
    const closure = event.fullClosure || event.condition.toLowerCase().includes("closed");
    return `<article class="incident-card">
      <div class="incident-top"><div class="incident-road">${escapeHtml(event.road)}</div><span class="event-tag ${closure ? "closure" : ""}">${closure ? "Closure" : "Road work"}</span></div>
      <p>${escapeHtml(event.description)}</p>
      <div class="incident-meta">${escapeHtml(event.lanesAffected || event.condition)}${event.updatedTime ? ` &bull; Updated ${formatTime(event.updatedTime)}` : ""}</div>
      <a href="${escapeHtml(event.url)}" target="_blank" rel="noopener noreferrer">Verify on DriveNC</a>
    </article>`;
  }).join("");
}

async function loadIncidents() {
  try {
    const response = await fetch(`${ROUTE_BASE}i26/incidents`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Incident feed unavailable");
    renderIncidents(data.incidents);
    document.querySelector("#lastUpdated").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(data.updatedAt));
  } catch (error) {
    console.error(error);
    document.querySelector("#incidentCount").textContent = "Unavailable";
    document.querySelector("#incidentList").innerHTML = '<article class="loading-card">The live incident feed is temporarily unavailable. Use the official DriveNC Asheville map for current conditions.</article>';
  }
}

function renderCameras(data) {
  const grid = document.querySelector("#cameraGrid");
  if (!data.configured || !data.cameras?.length) {
    grid.innerHTML = `<article class="camera-fallback"><h3>Official camera lists</h3><p>${escapeHtml(data.message || "No matching camera views are available in the feed right now.")} Use the roadway buttons below for the current DriveNC views.</p></article>`;
    return;
  }

  grid.innerHTML = data.cameras.slice(0, 9).map((camera) => `<article class="camera-card">
    <div class="camera-view">${escapeHtml(camera.roadway)} ${escapeHtml(camera.direction)}</div>
    <h3>${escapeHtml(camera.location)}</h3>
    <p>Status: ${escapeHtml(camera.status)}</p>
    <a href="${escapeHtml(camera.url)}" target="_blank" rel="noopener noreferrer">Open camera view</a>
  </article>`).join("");
}

async function loadCameras() {
  try {
    const response = await fetch(`${ROUTE_BASE}i26/cameras`);
    renderCameras(await response.json());
  } catch (error) {
    console.error(error);
    renderCameras({ configured: false, message: "The camera feed is temporarily unavailable." });
  }
}

function buildWeatherImpact(data) {
  const upcoming = (data.hourly || []).filter((hour) => hour.timestamp >= Date.now()).slice(0, 12);
  const current = data.current || {};
  const rainTotal = upcoming.reduce((sum, hour) => sum + (Number(hour.precipAmount ?? hour.precipitation) || 0), 0);
  const rainChance = Math.max(0, ...upcoming.map((hour) => Number(hour.precipProbability) || 0));
  const gust = Math.max(Number(current.windGust) || 0, ...upcoming.map((hour) => Number(hour.windGust) || 0));
  const humidity = Number(current.relativeHumidity ?? current.humidity) || 0;
  const clouds = Math.max(0, ...upcoming.slice(0, 6).map((hour) => Number(hour.cloudCover) || 0));
  const isRaining = Boolean(current.isRainingNow) || Number(current.precipRate) > 0;

  let level = "Low";
  let className = "";
  let headline = "Weather should have a limited effect on corridor travel and outdoor work.";
  let narrative = "Normal work-zone caution still applies. Watch lane shifts, reduced shoulders, and changing traffic patterns even when weather is quiet.";

  if (rainTotal >= 0.5 || gust >= 35) {
    level = "High";
    className = "high";
    headline = "Rain or strong gusts could meaningfully complicate the Connector corridor.";
    narrative = "Allow extra braking distance and expect reduced visibility near barriers, bridges, ramps, and active construction. Outdoor operations may change with site conditions.";
  } else if (isRaining || rainChance >= 0.5 || rainTotal >= 0.1 || gust >= 25 || (humidity >= 90 && clouds >= 0.8)) {
    level = "Elevated";
    className = "elevated";
    headline = "Weather may add friction to an already complex work-zone drive.";
    narrative = "Wet pavement, low cloud, spray, or gusts can make lane shifts and ramp approaches harder to read. Build in extra time and verify closures before leaving.";
  }

  return { level, className, headline, narrative, rainTotal, rainChance, gust, visibility: humidity >= 90 && clouds >= 0.8 ? "Fog possible" : isRaining ? "Rain / spray" : "Generally good" };
}

async function loadWeather() {
  try {
    const response = await fetch(`${ROUTE_BASE}weather&type=hourly&lat=${ASHEVILLE.lat}&lon=${ASHEVILLE.lon}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Weather unavailable");
    const impact = buildWeatherImpact(data);
    const badge = document.querySelector("#weatherImpactBadge");
    badge.textContent = `${impact.level} weather impact`;
    badge.className = `impact-badge ${impact.className}`;
    document.querySelector("#weatherImpactLabel").textContent = impact.level;
    document.querySelector("#weatherHeadline").textContent = impact.headline;
    document.querySelector("#weatherNarrative").textContent = impact.narrative;
    document.querySelector("#weatherSignals").innerHTML = `
      <div><span>Next 12 hours</span><strong>${Math.round(impact.rainChance * 100)}% peak rain chance</strong></div>
      <div><span>Peak wind gust</span><strong>${Math.round(impact.gust)} mph</strong></div>
      <div><span>Visibility signal</span><strong>${impact.visibility}</strong></div>`;
  } catch (error) {
    console.error(error);
    document.querySelector("#weatherImpactLabel").textContent = "Unavailable";
    document.querySelector("#weatherImpactBadge").textContent = "Weather feed unavailable";
    document.querySelector("#weatherHeadline").textContent = "Check the 828 forecast before traveling through the work zone.";
    document.querySelector("#weatherNarrative").textContent = "Live corridor weather guidance could not be calculated right now.";
  }
}

initMap();
Promise.allSettled([loadIncidents(), loadCameras(), loadWeather()]);
