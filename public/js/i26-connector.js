const ROUTE_BASE = "/api/router?route=";
const ASHEVILLE = { lat: 35.5951, lon: -82.5515 };
const CONNECTOR_PLAN_LAYER = {
  name: "New DOT RW - 2018 Plan",
  url: "https://services6.arcgis.com/VLA0ImJ33zhtGEaP/arcgis/rest/services/I_26_RW_Plans/FeatureServer/0/query?where=1%3D1&outFields=OBJECTID&returnGeometry=true&outSR=4326&f=geojson"
};

let map;
let eventLayer;
let connectorPlanLayer;
let cameraRefreshTimer;
let trafficRotatorTimer;
let trafficRotatorIndex = 0;
const incidentMarkers = new Map();
let emailAlertState = { alerts: [], updatedAt: null, loaded: false, error: false };
let incidentState = { incidents: [], updatedAt: null, loaded: false, error: false };

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

function alertTimingMarkup(item = {}) {
  const rows = [
    ["Start time", item.startTime],
    ["Anticipated end", item.endTime]
  ].filter(([, value]) => value);

  if (!rows.length) return "";

  return `<dl class="alert-timing">
    ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(formatShortDate(value))}</dd></div>`).join("")}
  </dl>`;
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
  connectorPlanLayer = L.layerGroup().addTo(map);
  loadConnectorPlanLayer();
  eventLayer = L.layerGroup().addTo(map);
}

async function loadConnectorPlanLayer() {
  if (!connectorPlanLayer || !window.L) return;

  try {
    const response = await fetch(CONNECTOR_PLAN_LAYER.url);
    if (!response.ok) throw new Error("Connector plan layer unavailable");
    const geojson = await response.json();
    const layer = L.geoJSON(geojson, {
      style: {
        color: "#0d4fc7",
        fillColor: "#2f80ff",
        fillOpacity: 0.32,
        opacity: 0.9,
        weight: 2
      },
      onEachFeature: (_feature, featureLayer) => {
        featureLayer.bindPopup(`<strong>${escapeHtml(CONNECTOR_PLAN_LAYER.name)}</strong><br>Official ArcGIS right-of-way plan geometry.`);
      }
    }).addTo(connectorPlanLayer);

    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [28, 28] });

    const note = document.querySelector("#projectPlanStatus");
    if (note) note.textContent = `${geojson.features?.length || 0} plan features loaded`;
  } catch (error) {
    console.warn(error);
    const note = document.querySelector("#projectPlanStatus");
    if (note) note.textContent = "Plan layer unavailable";
  }
}

function eventColor(event) {
  return event.fullClosure || event.condition.toLowerCase().includes("closed") ? "#c9352b" : "#f47b20";
}

function renderIncidents(incidents = []) {
  const closures = incidents.filter((event) => event.fullClosure || event.condition.toLowerCase().includes("closed"));
  document.querySelector("#incidentCount").textContent = incidents.length ? String(incidents.length) : "None listed";
  document.querySelector("#closureCount").textContent = String(closures.length);

  if (eventLayer) eventLayer.clearLayers();
  incidentMarkers.clear();
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
    incidentMarkers.set(String(event.id), marker);
  });

  renderUnifiedUpdates();
}

function showIncidentOnMap(eventId) {
  const marker = incidentMarkers.get(String(eventId));
  const mapElement = document.querySelector("#connectorMap");
  if (!marker || !map || !mapElement) return;

  mapElement.scrollIntoView({ behavior: "smooth", block: "center" });
  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 15), { duration: 0.8 });
  window.setTimeout(() => {
    marker.openPopup();
    const markerElement = marker.getElement();
    if (!markerElement) return;
    markerElement.classList.remove("incident-map-pulse");
    void markerElement.getBoundingClientRect();
    markerElement.classList.add("incident-map-pulse");
  }, 850);
}

function connectMapButtons(container) {
  container?.querySelectorAll("[data-map-event]").forEach((button) => {
    button.addEventListener("click", () => showIncidentOnMap(button.dataset.mapEvent));
  });
}

async function loadIncidents() {
  try {
    const response = await fetch(`${ROUTE_BASE}i26/incidents`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Incident feed unavailable");
    incidentState = { incidents: Array.isArray(data.incidents) ? data.incidents : [], updatedAt: data.updatedAt, loaded: true, error: false };
    renderIncidents(data.incidents);
    document.querySelector("#lastUpdated").textContent = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(data.updatedAt));
  } catch (error) {
    console.error(error);
    incidentState = { incidents: [], updatedAt: null, loaded: true, error: true };
    document.querySelector("#incidentCount").textContent = "Unavailable";
    renderUnifiedUpdates();
  }
}

function compactText(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function compactEventKey(item = {}) {
  return String(item.eventId || item.id || "").trim();
}

function normalizeUpdateTime(value) {
  const timestamp = new Date(value || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function emailCoversIncident(alert, incident) {
  const alertKey = compactEventKey(alert);
  const incidentKey = compactEventKey(incident);
  if (alertKey && incidentKey && alertKey === incidentKey) return true;

  const alertText = compactText(`${alert.road || ""} ${alert.description || ""}`);
  const incidentText = compactText(`${incident.road || ""} ${incident.description || ""}`);
  if (!alertText || !incidentText) return false;

  return alertText.includes(incidentText.slice(0, 70)) || incidentText.includes(alertText.slice(0, 70));
}

function normalizeEmailUpdate(alert, matchingIncident) {
  return {
    id: alert.id,
    eventId: alert.eventId,
    sourceKind: "email",
    sourceLabel: "Email alert",
    road: alert.road || "Connector area",
    title: alert.title || "DriveNC alert",
    description: alert.description || "DriveNC notification for the I-26 Connector area.",
    badge: alert.cleared ? "Cleared" : alert.typeLabel || "Alert",
    severity: alert.severity || "advisory",
    active: !alert.cleared,
    url: alert.url || "https://www.drivenc.gov/region/Asheville",
    primaryTime: alert.receivedAt || alert.updatedAt,
    mapEventId: matchingIncident?.id || "",
    startTime: alert.startTime || alert.startTimeText || "",
    endTime: alert.endTime || alert.endTimeText || "",
    meta: formatRelativeTime(alert.receivedAt || alert.updatedAt)
  };
}

function normalizeIncidentUpdate(event) {
  const condition = event.condition || "";
  const closure = event.fullClosure || condition.toLowerCase().includes("closed");
  const timing = [event.updatedTime ? `Updated ${formatTime(event.updatedTime)}` : "", event.lanesAffected || condition]
    .filter(Boolean)
    .join(" - ");

  return {
    id: event.id,
    eventId: event.id,
    sourceKind: "record",
    sourceLabel: "Active DriveNC record",
    road: event.road || "Connector area",
    title: `${closure ? "Closure" : "Road work"} - DriveNC record`,
    description: event.description || "Active NCDOT event near the Connector.",
    badge: closure ? "Closure" : "Road work",
    severity: closure ? "closure" : "advisory",
    active: true,
    url: event.url || "https://www.drivenc.gov/region/Asheville",
    primaryTime: event.updatedTime || event.startTime || Date.now(),
    mapEventId: event.id || "",
    startTime: event.startTime || "",
    endTime: event.endTime || "",
    meta: timing
  };
}

function buildUnifiedUpdates() {
  const emailAlerts = Array.isArray(emailAlertState.alerts) ? emailAlertState.alerts : [];
  const incidents = Array.isArray(incidentState.incidents) ? incidentState.incidents : [];
  const incidentAdditions = incidents
    .filter((event) => !emailAlerts.some((alert) => emailCoversIncident(alert, event)))
    .map(normalizeIncidentUpdate);

  const normalizedEmailAlerts = emailAlerts.map((alert) => normalizeEmailUpdate(
    alert,
    incidents.find((incident) => emailCoversIncident(alert, incident))
  ));

  return [...normalizedEmailAlerts, ...incidentAdditions]
    .sort((a, b) => normalizeUpdateTime(b.primaryTime) - normalizeUpdateTime(a.primaryTime))
    .slice(0, 12);
}

function setTrafficRotatorSlide(index) {
  const cards = Array.from(document.querySelectorAll("#trafficRotator .traffic-rotator-card"));
  const dots = Array.from(document.querySelectorAll("#trafficRotatorDots button"));
  if (!cards.length) return;

  trafficRotatorIndex = ((index % cards.length) + cards.length) % cards.length;
  cards.forEach((card, cardIndex) => {
    const active = cardIndex === trafficRotatorIndex;
    card.classList.toggle("is-active", active);
    card.setAttribute("aria-hidden", active ? "false" : "true");
  });
  dots.forEach((dot, dotIndex) => {
    dot.classList.toggle("is-active", dotIndex === trafficRotatorIndex);
    dot.setAttribute("aria-current", dotIndex === trafficRotatorIndex ? "true" : "false");
  });
}

function startTrafficRotator(count) {
  clearInterval(trafficRotatorTimer);
  if (count <= 1) return;
  trafficRotatorTimer = setInterval(() => {
    setTrafficRotatorSlide(trafficRotatorIndex + 1);
  }, 6500);
}

function renderTrafficSpotlight(updates = [], loaded = false) {
  const rotator = document.querySelector("#trafficRotator");
  const dots = document.querySelector("#trafficRotatorDots");
  if (!rotator || !dots) return;

  const spotlightItems = updates.slice(0, 5);
  clearInterval(trafficRotatorTimer);

  if (!loaded && !spotlightItems.length) {
    rotator.innerHTML = `<article class="traffic-rotator-card is-active" aria-hidden="false">
      <span>Loading live feed</span>
      <h3>Checking the newest DriveNC Connector updates.</h3>
      <p>The five most recent incidents will rotate here when the traffic desk connects.</p>
    </article>`;
    dots.innerHTML = "";
    trafficRotatorIndex = 0;
    return;
  }

  if (!spotlightItems.length) {
    rotator.innerHTML = `<article class="traffic-rotator-card is-active" aria-hidden="false">
      <span>No current incidents</span>
      <h3>No Connector-area traffic updates are currently listed.</h3>
      <p>Use DriveNC before travel for the official current status.</p>
      <a href="https://www.drivenc.gov/region/Asheville" target="_blank" rel="noopener noreferrer">Verify on DriveNC</a>
    </article>`;
    dots.innerHTML = "";
    trafficRotatorIndex = 0;
    return;
  }

  trafficRotatorIndex = Math.min(trafficRotatorIndex, spotlightItems.length - 1);
  rotator.innerHTML = spotlightItems.map((item, index) => {
    const classes = ["traffic-rotator-card", `severity-${item.severity || "advisory"}`, index === trafficRotatorIndex ? "is-active" : ""].join(" ");
    return `<article class="${classes}" aria-hidden="${index === trafficRotatorIndex ? "false" : "true"}">
      <div class="traffic-rotator-meta">
        <span>${escapeHtml(item.road || "Connector area")}</span>
        <b>${escapeHtml(item.badge || "Update")}</b>
      </div>
      <h3>${escapeHtml(item.title || "DriveNC update")}</h3>
      <p>${escapeHtml(item.description)}</p>
      ${alertTimingMarkup(item)}
      ${item.mapEventId ? `<button type="button" class="show-on-map alert-map-cta" data-map-event="${escapeHtml(item.mapEventId)}">Show this alert on the Connector map</button>` : `<a class="alert-map-cta" href="#connectorMap">View the Connector map</a>`}
      <div class="traffic-rotator-footer">
        <span>${escapeHtml(item.sourceLabel || "DriveNC")}</span>
        <time>${escapeHtml(formatRelativeTime(item.primaryTime))}</time>
        <a href="${escapeHtml(item.url || "https://www.drivenc.gov/region/Asheville")}" target="_blank" rel="noopener noreferrer">Verify</a>
      </div>
    </article>`;
  }).join("");
  connectMapButtons(rotator);

  dots.innerHTML = spotlightItems.map((_item, index) => `<button type="button" aria-label="Show traffic update ${index + 1}" aria-current="${index === trafficRotatorIndex ? "true" : "false"}" class="${index === trafficRotatorIndex ? "is-active" : ""}"></button>`).join("");
  dots.querySelectorAll("button").forEach((button, index) => {
    button.addEventListener("click", () => {
      setTrafficRotatorSlide(index);
      startTrafficRotator(spotlightItems.length);
    });
  });
  setTrafficRotatorSlide(trafficRotatorIndex);
  startTrafficRotator(spotlightItems.length);
}

function renderUnifiedUpdates() {
  const list = document.querySelector("#emailAlertList");
  const summary = document.querySelector("#emailAlertSummary");

  const loaded = emailAlertState.loaded && incidentState.loaded;
  const updates = buildUnifiedUpdates();
  renderTrafficSpotlight(updates, loaded);
  if (!list || !summary) return;

  const active = updates.filter((item) => item.active);
  const latest = updates[0];

  summary.innerHTML = `
    <article><span>Feed items</span><strong>${loaded ? updates.length || "None" : "Loading"}</strong></article>
    <article><span>Active notices</span><strong>${active.length}</strong></article>
    <article><span>Newest update</span><strong>${latest ? formatRelativeTime(latest.primaryTime) : loaded ? "None yet" : "Connecting"}</strong></article>`;

  if (!loaded && !updates.length) {
    list.innerHTML = '<article class="loading-card">Loading Connector traffic and construction updates...</article>';
    return;
  }

  if (!updates.length) {
    list.innerHTML = '<article class="loading-card">No Connector-area traffic or construction updates are currently listed. Check DriveNC before travel.</article>';
    return;
  }

  list.innerHTML = updates.map((item) => {
    const classes = ["email-alert-card", `severity-${item.severity || "advisory"}`, `source-${item.sourceKind}`].join(" ");
    return `<article class="${classes}">
      <div class="email-alert-top">
        <div>
          <span>${escapeHtml(item.road || "Connector area")}</span>
          <h3>${escapeHtml(item.title || "DriveNC update")}</h3>
        </div>
        <b>${escapeHtml(item.badge || "Update")}</b>
      </div>
      <div class="update-source">${escapeHtml(item.sourceLabel)}</div>
      <p>${escapeHtml(item.description)}</p>
      ${alertTimingMarkup(item)}
      <div class="email-alert-meta">${escapeHtml(item.meta || formatRelativeTime(item.primaryTime))}</div>
      <div class="alert-actions">
        ${item.mapEventId ? `<button type="button" class="show-on-map" data-map-event="${escapeHtml(item.mapEventId)}">Show this alert on the Connector map</button>` : `<a href="#connectorMap">View the Connector map</a>`}
        <a href="${escapeHtml(item.url || "https://www.drivenc.gov/region/Asheville")}" target="_blank" rel="noopener noreferrer">Verify on DriveNC</a>
      </div>
    </article>`;
  }).join("");
  connectMapButtons(list);
}

async function loadEmailAlerts() {
  try {
    const response = await fetch(`${ROUTE_BASE}i26/email-alerts`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Email alert feed unavailable");
    emailAlertState = { alerts: Array.isArray(data.alerts) ? data.alerts : [], updatedAt: data.updatedAt, loaded: true, error: false };
    renderUnifiedUpdates();
  } catch (error) {
    console.error(error);
    emailAlertState = { alerts: [], updatedAt: null, loaded: true, error: true };
    renderUnifiedUpdates();
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
        : `<button type="button" class="connector-news-image-button" data-lightbox-src="${safeMedia}" aria-label="Enlarge image: ${escapeHtml(item.title || "Connector update")}">
            <img src="${safeMedia}" alt="${escapeHtml(item.title || "Connector update media")}" loading="lazy" />
            <span class="connector-news-image-hint" aria-hidden="true">Click to enlarge</span>
          </button>`;
    }).join("")}
  </div>`;
}

function initConnectorImageLightbox() {
  const dialog = document.querySelector("#connectorImageLightbox");
  const lightboxImage = document.querySelector("#connectorImageLightboxImage");
  const lightboxTitle = document.querySelector("#connectorImageLightboxTitle");
  const closeButton = dialog?.querySelector(".connector-image-lightbox-close");
  if (!dialog || !lightboxImage || !lightboxTitle || !closeButton) return;

  const closeLightbox = () => {
    if (dialog.open) dialog.close();
  };

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-lightbox-src]");
    if (!trigger) return;

    const preview = trigger.querySelector("img");
    const imageTitle = preview?.alt || "Connector update image";
    lightboxImage.src = trigger.dataset.lightboxSrc || "";
    lightboxImage.alt = imageTitle;
    lightboxTitle.textContent = imageTitle;
    dialog.showModal();
  });

  closeButton.addEventListener("click", closeLightbox);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeLightbox();
  });
  dialog.addEventListener("close", () => {
    lightboxImage.removeAttribute("src");
    lightboxImage.alt = "";
  });
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

initConnectorImageLightbox();
initMap();
startCameraRefresh();
Promise.allSettled([loadEmailAlerts(), loadConnectorNews(), loadIncidents(), loadCameras(), loadWeather()]);
