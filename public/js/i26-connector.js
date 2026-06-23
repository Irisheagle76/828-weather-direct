const ROUTE_BASE = "/api/router?route=";
const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };
const PROJECT_PLAN_LAYERS = [
  {
    name: "DOT right-of-way",
    url: "https://services6.arcgis.com/VLA0ImJ33zhtGEaP/arcgis/rest/services/I_26_RW_Plans/FeatureServer/1/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&f=geojson",
    color: "#1f8f5f",
    fillColor: "#47d16c",
    fillOpacity: 0.12,
    weight: 1.5
  },
  {
    name: "New DOT right-of-way - 2018 plan",
    url: "https://services6.arcgis.com/VLA0ImJ33zhtGEaP/arcgis/rest/services/I_26_RW_Plans/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&f=geojson",
    color: "#0d4fc7",
    fillColor: "#2f80ff",
    fillOpacity: 0.32,
    weight: 2
  }
];

let map;
let eventLayer;
let projectPlanLayer;
let cameraRefreshTimer;

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

function formatShortDate(value) {
  if (!value) return "Not listed";
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York"
  }).format(new Date(value));
}

function formatRelativeTime(value) {
  if (!value) return "Not listed";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not listed";

  const diffMinutes = Math.round((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function sanitizeNewsHtml(html = "") {
  const template = document.createElement("template");
  template.innerHTML = String(html || "");
  const allowedTags = new Set(["A", "B", "BR", "EM", "I", "LI", "OL", "P", "STRONG", "U", "UL"]);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    Array.from(node.attributes).forEach((attr) => {
      if (node.tagName === "A" && attr.name === "href" && /^https?:\/\//i.test(attr.value)) return;
      node.removeAttribute(attr.name);
    });

    if (node.tagName === "A") {
      node.target = "_blank";
      node.rel = "noopener noreferrer";
    }
  });

  return template.innerHTML;
}

function initMap() {
  if (!window.L) return;
  map = L.map("connectorMap", { scrollWheelZoom: false }).setView([35.586, -82.582], 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  projectPlanLayer = L.layerGroup().addTo(map);
  loadProjectPlanLayers();
  eventLayer = L.layerGroup().addTo(map);
}

function geoJsonStyle(config) {
  return {
    color: config.color,
    fillColor: config.fillColor,
    fillOpacity: config.fillOpacity,
    opacity: 0.85,
    weight: config.weight
  };
}

async function loadProjectPlanLayers() {
  if (!projectPlanLayer || !window.L) return;

  const results = await Promise.allSettled(PROJECT_PLAN_LAYERS.map(async (config) => {
    const response = await fetch(config.url);
    if (!response.ok) throw new Error(`${config.name} unavailable`);
    const geojson = await response.json();
    return { config, geojson };
  }));

  const bounds = [];
  let loadedCount = 0;
  results.forEach((result) => {
    if (result.status !== "fulfilled") {
      console.warn("Project plan layer failed to load", result.reason);
      return;
    }

    const { config, geojson } = result.value;
    const layer = L.geoJSON(geojson, {
      style: geoJsonStyle(config),
      onEachFeature: (_feature, featureLayer) => {
        featureLayer.bindPopup(`<strong>${escapeHtml(config.name)}</strong><br>Source-backed ArcGIS plan geometry.`);
      }
    }).addTo(projectPlanLayer);
    const layerBounds = layer.getBounds();
    if (layerBounds.isValid()) bounds.push(layerBounds);
    loadedCount += geojson.features?.length || 0;
  });

  if (bounds.length) {
    const combinedBounds = bounds.reduce((merged, layerBounds) => merged.extend(layerBounds), bounds[0]);
    map.fitBounds(combinedBounds, { padding: [28, 28] });
  }

  const note = document.querySelector("#projectPlanStatus");
  if (note) note.textContent = loadedCount ? `${loadedCount} ArcGIS plan features loaded` : "Plan layer unavailable";
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

function renderEmailAlerts(data = {}) {
  const list = document.querySelector("#emailAlertList");
  const summary = document.querySelector("#emailAlertSummary");
  if (!list || !summary) return;

  const alerts = Array.isArray(data.alerts) ? data.alerts : [];
  const active = alerts.filter((alert) => !alert.cleared);
  const latest = alerts[0];

  summary.innerHTML = `
    <article><span>Recent alerts</span><strong>${alerts.length ? alerts.length : "None"}</strong></article>
    <article><span>Active notices</span><strong>${active.length}</strong></article>
    <article><span>Last email</span><strong>${latest ? formatRelativeTime(latest.receivedAt) : "None yet"}</strong></article>`;

  if (!alerts.length) {
    list.innerHTML = '<article class="loading-card">No DriveNC notification emails have been published to this feed yet. Standing DriveNC records remain below.</article>';
    return;
  }

  list.innerHTML = alerts.slice(0, 8).map((alert) => {
    const classes = ["email-alert-card", `severity-${alert.severity || "advisory"}`].join(" ");
    const timing = [alert.startTime ? `Starts ${formatShortDate(alert.startTime)}` : alert.startTimeText, alert.endTime ? `Ends ${formatShortDate(alert.endTime)}` : alert.endTimeText]
      .filter(Boolean)
      .join(" • ");

    return `<article class="${classes}">
      <div class="email-alert-top">
        <div>
          <span>${escapeHtml(alert.road || "Connector area")}</span>
          <h3>${escapeHtml(alert.title || "DriveNC alert")}</h3>
        </div>
        <b>${escapeHtml(alert.cleared ? "Cleared" : alert.typeLabel || "Alert")}</b>
      </div>
      <p>${escapeHtml(alert.description || "DriveNC notification for the I-26 Connector area.")}</p>
      <div class="email-alert-meta">${escapeHtml(formatRelativeTime(alert.receivedAt))}${timing ? ` • ${escapeHtml(timing)}` : ""}</div>
      <a href="${escapeHtml(alert.url || "https://www.drivenc.gov/region/Asheville")}" target="_blank" rel="noopener noreferrer">Verify on DriveNC</a>
    </article>`;
  }).join("");
}

async function loadEmailAlerts() {
  try {
    const response = await fetch(`${ROUTE_BASE}i26/email-alerts`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Email alert feed unavailable");
    renderEmailAlerts(data);
  } catch (error) {
    console.error(error);
    document.querySelector("#emailAlertSummary").innerHTML = `
      <article><span>Recent alerts</span><strong>Unavailable</strong></article>
      <article><span>Active notices</span><strong>--</strong></article>
      <article><span>Last email</span><strong>--</strong></article>`;
    document.querySelector("#emailAlertList").innerHTML = '<article class="loading-card">DriveNC email notifications are temporarily unavailable. Use the official DriveNC map before travel.</article>';
  }
}

function newsMediaMarkup(item) {
  const mediaItems = Array.isArray(item.mediaItems) && item.mediaItems.length
    ? item.mediaItems
    : item.mediaUrl
      ? [{ mediaUrl: item.mediaUrl, mediaType: item.mediaType }]
      : [];

  const visible = mediaItems.filter((media) => media?.mediaUrl).slice(0, 8);
  if (!visible.length) return "";

  return `<div class="connector-news-media ${visible.length > 1 ? "gallery" : ""}">
    ${visible.map((media) => {
      const mediaUrl = media.mediaUrl || "";
      const safeMedia = escapeHtml(mediaUrl);
      const isVideo = media.mediaType === "video" || mediaUrl.endsWith(".mp4") || mediaUrl.includes("/video/");
      return isVideo
        ? `<video controls playsinline src="${safeMedia}"></video>`
        : `<img src="${safeMedia}" alt="${escapeHtml(item.title || "Connector update media")}" loading="lazy" />`;
    }).join("")}
  </div>`;
}

function renderConnectorNews(items = []) {
  const list = document.querySelector("#connectorNewsList");
  if (!list || !items.length) return;

  list.innerHTML = items.slice(0, 6).map((item) => `
    <article class="connector-news-item">
      ${newsMediaMarkup(item)}
      <div class="connector-news-meta">
        <time>${escapeHtml(formatShortDate(item.timestamp))}</time>
        <span>${escapeHtml(item.label || "Connector update")}</span>
      </div>
      <h3>${escapeHtml(item.title || "Connector update")}</h3>
      <div class="connector-news-text">${sanitizeNewsHtml(item.text || "")}</div>
      ${item.sourceUrl ? `<a class="connector-news-source" href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.sourceLabel || "Read more")}</a>` : ""}
    </article>
  `).join("");
}

async function loadConnectorNews() {
  try {
    const response = await fetch(`${ROUTE_BASE}i26/news-feed`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Connector news unavailable");
    if (!data.fallback && Array.isArray(data.items)) renderConnectorNews(data.items);
  } catch (error) {
    console.warn("Connector news using static fallback", error);
  }
}

function renderCameras(data) {
  const grid = document.querySelector("#cameraGrid");
  if (!data.configured || !data.cameras?.length) {
    grid.innerHTML = `<article class="camera-fallback"><h3>Official camera lists</h3><p>${escapeHtml(data.message || "No matching camera views are available in the feed right now.")} Use the roadway buttons below for the current DriveNC views.</p></article>`;
    return;
  }

  const refreshToken = Math.floor(Date.now() / 60000);
  grid.innerHTML = data.cameras.map((camera) => `<article class="camera-card">
    <a class="camera-view" href="${escapeHtml(camera.url)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(camera.label || camera.location)} on DriveNC">
      <img src="${escapeHtml(camera.imageUrl)}?t=${refreshToken}" data-camera-image="${escapeHtml(camera.imageUrl)}" alt="Near-live NCDOT camera view: ${escapeHtml(camera.label || camera.location)}" loading="lazy" />
      <span class="camera-live-badge">Near live</span>
    </a>
    <div class="camera-route">${escapeHtml(camera.roadway)}${camera.direction ? ` &bull; ${escapeHtml(camera.direction)}` : ""}</div>
    <h3>${escapeHtml(camera.label || camera.location)}</h3>
    <p>${escapeHtml(camera.location)}</p>
    <div class="camera-meta"><span>Refreshes every minute</span><a href="${escapeHtml(camera.url)}" target="_blank" rel="noopener noreferrer">Open on DriveNC</a></div>
  </article>`).join("");

  startCameraRefresh();
}

function startCameraRefresh() {
  clearInterval(cameraRefreshTimer);
  cameraRefreshTimer = setInterval(() => {
    const refreshToken = Math.floor(Date.now() / 60000);
    document.querySelectorAll("[data-camera-image]").forEach((image) => {
      image.classList.add("is-refreshing");
      image.addEventListener("load", () => image.classList.remove("is-refreshing"), { once: true });
      image.src = `${image.dataset.cameraImage}?t=${refreshToken}`;
    });
  }, 60 * 1000);
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
Promise.allSettled([loadEmailAlerts(), loadConnectorNews(), loadIncidents(), loadCameras(), loadWeather()]);
