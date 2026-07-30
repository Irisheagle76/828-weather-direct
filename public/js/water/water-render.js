import { getWaterPageInputs } from "./water-data.js?v=20260730-water-live2";
import { buildWaterfallIndex } from "./waterfall-index.js?v=20260730-water-live2";
import { ACTIVITY_LABELS, buildRiverIndex } from "./river-index.js?v=20260730-water-live2";

const els = {
  generatedAt: document.querySelector("#generatedAt"),
  dataStatus: document.querySelector("#dataStatus"),
  summaryGrid: document.querySelector("#summaryGrid"),
  visualDashboard: document.querySelector("#visualDashboard"),
  liveCameraWall: document.querySelector("#liveCameraWall"),
  waterMap: document.querySelector("#waterMap"),
  waterfallGrid: document.querySelector("#waterfallGrid"),
  riverGrid: document.querySelector("#riverGrid"),
  webcamGrid: document.querySelector("#webcamGrid"),
  webcamSummary: document.querySelector("#webcamSummary"),
  rainfallGrid: document.querySelector("#rainfallGrid"),
  rainfallNarrative: document.querySelector("#rainfallNarrative"),
  safetyList: document.querySelector("#safetyList")
};

let waterLeafletMap = null;

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatInches(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "--";
  return `${n.toFixed(2)}"`;
}

function formatDateTime(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Live data unavailable";
  return `Live data checked ${new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  })}`;
}

function averageRainfall(items, key) {
  const values = items
    .filter((item) => item.rainfall?.available !== false)
    .map((item) => item.rainfall?.[key])
    .filter((value) => Number.isFinite(Number(value)))
    .map(Number);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pickBestTubing(rivers) {
  const tubing = rivers
    .map((item) => ({
      river: item.river,
      rec: item.activityScores.find((score) => score.activity === "tubing")
    }))
    .filter((item) =>
      item.rec &&
      Number.isFinite(item.rec.score) &&
      !["Hazardous", "Not Applicable", "Data Limited"].includes(item.rec.rating)
    )
    .sort((a, b) => b.rec.score - a.rec.score)[0];
  return tubing ? `${tubing.river.name} ${tubing.river.segmentName}` : "No easy tubing pick";
}

function pickBestPaddling(rivers) {
  const paddling = rivers
    .flatMap((item) => item.activityScores
        .filter((score) =>
          ["canoeing", "kayaking", "rafting"].includes(score.activity) &&
          Number.isFinite(score.score) &&
          !["Not Applicable", "Data Limited"].includes(score.rating)
        )
      .map((score) => ({ river: item.river, rec: score })))
    .filter((item) => !["Hazardous"].includes(item.rec.rating))
    .sort((a, b) => b.rec.score - a.rec.score)[0];
  return paddling ? `${ACTIVITY_LABELS[paddling.rec.activity]}: ${paddling.river.name} ${paddling.river.segmentName}` : "Check outfitters first";
}

function mainSafetyConcern(waterfalls, rivers, weather) {
  const hazardFalls = waterfalls.filter((item) => item.category.tone === "hazard" || item.score >= 88);
  const riverHazards = rivers.flatMap((item) => item.activityScores.filter((score) => ["Hazardous", "Experts Only"].includes(score.rating)));
  if (riverHazards.length) return "Swift current possible on higher-flow stretches.";
  if (hazardFalls.length) return "Slick rocks and heavy spray near waterfalls.";
  if (Number(weather.thunderstormRisk || 0) >= 0.25) return "Thunderstorms can change creeks quickly.";
  return "Normal water awareness; check posted closures.";
}

function renderSummary(waterfalls, rivers, weather) {
  const bestFall = waterfalls.find((item) => Number.isFinite(item.score) && item.category.tone !== "hazard") ||
    waterfalls.find((item) => Number.isFinite(item.score));
  const cards = [
    {
      label: "Best Waterfall Pick Today",
      value: bestFall?.waterfall?.name || "Rainfall data unavailable",
      detail: bestFall ? `${bestFall.category.label} - ${bestFall.score}/100` : "No placeholder score is being shown",
      tone: "blue"
    },
    {
      label: "Best Tubing Pick Today",
      value: pickBestTubing(rivers),
      detail: "Based on live flow, seasonal normal, trend, runoff, and river character.",
      tone: "green"
    },
    {
      label: "Best Paddling Pick Today",
      value: pickBestPaddling(rivers),
      detail: "Whitewater and casual paddling are scored separately.",
      tone: "orange"
    },
    {
      label: "Main Safety Concern",
      value: mainSafetyConcern(waterfalls, rivers, weather),
      detail: "Conditions can shift quickly after mountain storms.",
      tone: "red"
    }
  ];

  els.summaryGrid.innerHTML = cards.map((card) => `
    <article class="summary-card ${card.tone}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      <p>${escapeHtml(card.detail)}</p>
    </article>
  `).join("");
}

function projectPoint(lat, lon) {
  const bounds = {
    north: 36.08,
    south: 35.08,
    west: -83.72,
    east: -81.85
  };
  const x = ((Number(lon) - bounds.west) / (bounds.east - bounds.west)) * 100;
  const y = ((bounds.north - Number(lat)) / (bounds.north - bounds.south)) * 100;
  return {
    x: Math.max(5, Math.min(95, x)),
    y: Math.max(7, Math.min(93, y))
  };
}

function renderCameraMedia(cam, featured = false) {
  if (cam.status === "available" && cam.embedType === "image" && cam.imageUrl) {
    return `
      <img
        class="camera-image"
        src="${escapeHtml(cam.imageUrl)}"
        alt="${escapeHtml(cam.name)}"
        loading="${featured ? "eager" : "lazy"}"
      >
    `;
  }

  if (cam.status !== "available" || cam.embedType !== "iframe") {
    const title = cam.status === "source" ? "Open live source" : "Camera limited";
    return `
      <div class="camera-placeholder">
        <div class="camera-river-art" aria-hidden="true"></div>
        <strong>${escapeHtml(title)}</strong>
        <span>${escapeHtml(cam.note)}</span>
      </div>
    `;
  }

  return `
    <iframe
      title="${escapeHtml(cam.name)}"
      src="${escapeHtml(cam.embedUrl || cam.url)}"
      loading="${featured ? "eager" : "lazy"}"
      allow="autoplay; fullscreen; picture-in-picture"
      referrerpolicy="no-referrer-when-downgrade"
    ></iframe>
  `;
}

function markerClassForKind(kind) {
  if (kind === "fall") return "orange";
  if (kind === "river") return "green";
  if (kind === "source") return "blue";
  if (kind === "limited") return "gold";
  return "cyan";
}

function renderLeafletMap(mapPins = []) {
  const mapEl = document.querySelector("#waterLeafletMap");
  if (!mapEl || !window.L) return;

  if (waterLeafletMap) {
    waterLeafletMap.remove();
    waterLeafletMap = null;
  }

  waterLeafletMap = window.L.map(mapEl, {
    scrollWheelZoom: false,
    zoomControl: true
  }).setView([35.55, -82.9], 8);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 14,
    attribution: "&copy; OpenStreetMap"
  }).addTo(waterLeafletMap);

  const markerGroup = window.L.featureGroup();
  mapPins.forEach((pin, index) => {
    const color = markerClassForKind(pin.kind);
    const marker = window.L.marker([pin.lat, pin.lon], {
      title: pin.name,
      icon: window.L.divIcon({
        className: `water-map-marker ${color}`,
        html: `<span>${index + 1}</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -18]
      })
    });
    marker.bindPopup(`
      <strong>${escapeHtml(pin.name)}</strong>
      <span>${escapeHtml(pin.location || pin.region || "")}</span>
    `);
    marker.addTo(markerGroup);
  });

  markerGroup.addTo(waterLeafletMap);
  if (mapPins.length) {
    waterLeafletMap.fitBounds(markerGroup.getBounds(), { padding: [24, 24] });
  }

  const refitMap = () => {
    if (!waterLeafletMap) return;
    waterLeafletMap.invalidateSize();
    if (mapPins.length) {
      waterLeafletMap.fitBounds(markerGroup.getBounds(), { padding: [28, 28] });
    }
  };
  requestAnimationFrame(() => {
    refitMap();
    setTimeout(refitMap, 300);
    setTimeout(refitMap, 900);
  });
}

function renderVisualDashboard(webcams = [], waterfalls = [], rivers = []) {
  if (!els.liveCameraWall || !els.waterMap) return;
  const featuredCams = webcams.filter((cam) => cam.status === "available" && ["iframe", "image"].includes(cam.embedType)).slice(0, 6);
  const bestFall = waterfalls[0];
  const bestRiver = rivers
    .flatMap((item) => item.activityScores.map((score) => ({ item, score })))
    .filter(({ score }) => ["Great", "Good"].includes(score.rating))
    .sort((a, b) => b.score.score - a.score.score)[0];

  els.liveCameraWall.innerHTML = featuredCams.map((cam, index) => `
    <article class="camera-tile">
      <div class="camera-frame">
        ${renderCameraMedia(cam, index === 0)}
        <div class="camera-live-badge">Live</div>
      </div>
      <div class="camera-caption">
        <span>${escapeHtml(cam.waterway)}</span>
        <strong>${escapeHtml(cam.name)}</strong>
        <a href="${escapeHtml(cam.url)}" target="_blank" rel="noopener noreferrer">Open source</a>
      </div>
    </article>
  `).join("");

  const mapPins = [
    ...webcams.filter((cam) => cam.status === "available" && ["iframe", "image"].includes(cam.embedType)).map((cam) => ({
      ...cam,
      kind: "cam",
      label: "cam"
    })),
    ...(bestFall ? [{
      name: bestFall.waterfall.name,
      location: bestFall.waterfall.region,
      lat: bestFall.waterfall.lat,
      lon: bestFall.waterfall.lon,
      kind: "fall",
      label: "falls"
    }] : []),
    ...(bestRiver ? [{
      name: `${bestRiver.item.river.name} ${bestRiver.item.river.segmentName}`,
      location: bestRiver.score.rating,
      lat: bestRiver.item.river.lat,
      lon: bestRiver.item.river.lon,
      kind: "river",
      label: "pick"
    }] : [])
  ];

  els.waterMap.innerHTML = `
    <div class="map-canvas real-map-canvas">
      <div class="map-ribbon">Western NC water locator</div>
      <div class="water-leaflet-map" id="waterLeafletMap" aria-label="Interactive map of water camera and featured condition locations"></div>
    </div>
    <div class="map-location-list" aria-label="Mapped water locations">
      <strong>Mapped locations</strong>
      ${mapPins.map((pin, index) => `
        <div class="map-location-row ${pin.kind}">
          <b>${index + 1}</b>
          <span>${escapeHtml(pin.name)}<small>${escapeHtml(pin.location || pin.region || "")}</small></span>
        </div>
      `).join("")}
    </div>
  `;
  renderLeafletMap(mapPins);
}

function renderWaterfalls(items) {
  const topPicks = items.slice(0, 3);
  els.waterfallGrid.innerHTML = `
    <div class="waterfall-rank-layout">
      <div class="waterfall-spotlights" aria-label="Top waterfall flow picks">
        ${topPicks.map(({ waterfall, rainfall, score, category }, index) => `
          <article class="waterfall-spotlight ${category.tone}">
            <div class="spotlight-rank">#${index + 1}</div>
            <div>
              <span class="region">${escapeHtml(waterfall.region)}</span>
              <h3>${escapeHtml(waterfall.name)}</h3>
            </div>
            <div class="score-badge compact">
              <strong>${Number.isFinite(score) ? score : "--"}</strong>
              <span>/100</span>
            </div>
            <div class="flow-label">
              <b>${escapeHtml(category.label)}</b>
            </div>
            <p>${escapeHtml(category.useCase)}</p>
            <div class="rain-mini">
              <span>24h ${formatInches(rainfall.rain24h)}</span>
              <span>3d ${formatInches(rainfall.rain3d)}</span>
            </div>
          </article>
        `).join("")}
      </div>
      <div class="waterfall-rank-list" aria-label="All waterfall flow scores">
        <div class="rank-list-head">
          <span>Rank</span>
          <span>Waterfall</span>
          <span>Index</span>
          <span>Details</span>
        </div>
        ${items.map(({ waterfall, rainfall, score, category, why }, index) => `
          <details class="waterfall-rank-row ${category.tone}" ${index < 3 ? "open" : ""}>
            <summary>
              <span class="rank-number">${index + 1}</span>
              <span class="rank-name">
                <b>${escapeHtml(waterfall.name)}</b>
                <small>${escapeHtml(waterfall.region)}</small>
              </span>
              <span class="rank-score">${Number.isFinite(score) ? score : "--"}<small>/100</small></span>
              <span class="rank-status">${escapeHtml(category.label)}</span>
            </summary>
            <div class="rank-detail">
              <p>${escapeHtml(category.explanation)}</p>
              <div class="use-case">${escapeHtml(category.useCase)}</div>
              <div class="why-line">
                Why: ${why.map(escapeHtml).join(" &middot; ")}
              </div>
              <div class="rain-mini">
                <span>24h ${formatInches(rainfall.rain24h)}</span>
                <span>3d ${formatInches(rainfall.rain3d)}</span>
                <span>7d ${formatInches(rainfall.rain7d)}</span>
              </div>
              <small class="data-source">${escapeHtml(rainfall.source || "Precipitation source unavailable")}</small>
            </div>
          </details>
        `).join("")}
      </div>
    </div>
  `;
}

function formatPercentNormal(gauge) {
  if (gauge?.percentNormal === null || gauge?.percentNormal === undefined || !Number.isFinite(Number(gauge.percentNormal))) {
    return "normal unavailable";
  }
  return `${Math.round(gauge.percentNormal)}% of normal`;
}

function formatFlowTrend(gauge) {
  if (gauge?.trend12hPct === null || gauge?.trend12hPct === undefined) return "";
  const trend = Number(gauge?.trend12hPct);
  if (!Number.isFinite(trend)) return "";
  const direction = trend >= 8 ? "rising" : trend <= -8 ? "falling" : "steady";
  const signed = trend > 0 ? `+${Math.round(trend)}` : `${Math.round(trend)}`;
  return `12h ${direction} (${signed}%) &middot; `;
}

function formatGaugeObservation(gauge) {
  if (!gauge?.observedAt) return "Current USGS observation time unavailable";
  const ts = new Date(gauge?.observedAt).getTime();
  if (!Number.isFinite(ts)) return "Current USGS observation time unavailable";
  return `USGS observation ${new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  })}`;
}

function normalFlowTone(percentNormal) {
  if (percentNormal === null || percentNormal === undefined || percentNormal === "") return "unknown";
  const pct = Number(percentNormal);
  if (!Number.isFinite(pct)) return "unknown";
  if (pct < 55) return "low";
  if (pct <= 140) return "normal";
  if (pct <= 220) return "high";
  return "very-high";
}

function normalFlowLabel(percentNormal) {
  const tone = normalFlowTone(percentNormal);
  if (tone === "low") return "Below normal";
  if (tone === "normal") return "Near normal";
  if (tone === "high") return "Above normal";
  if (tone === "very-high") return "Well above normal";
  return "Normal unavailable";
}

function formatQualityNumber(value, digits = 1) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n.toFixed(digits).replace(/\.0$/, "");
}

function renderWaterQualityBlock(gauge) {
  const q = gauge?.quality;
  if (!q) return "";
  const metrics = [
    { label: "Water temp", value: formatQualityNumber(q.waterTempF, 0), unit: "F" },
    { label: "Turbidity", value: formatQualityNumber(q.turbidity, 1), unit: "FNU" },
    { label: "Dissolved oxygen", value: formatQualityNumber(q.dissolvedOxygen, 1), unit: "mg/L" },
    { label: "pH", value: formatQualityNumber(q.ph, 1), unit: "" },
    { label: "Conductance", value: formatQualityNumber(q.specificConductance, 0), unit: "uS/cm" }
  ].filter((metric) => metric.value !== null);

  if (!metrics.length) return "";

  return `
    <div class="water-quality-block">
      <div class="water-quality-head">
        <div>
          <span>Water quality</span>
          <strong>Live station readings</strong>
        </div>
        <small>Not a bacteria/swim-safety test</small>
      </div>
      <div class="quality-metrics">
        ${metrics.map((metric) => `
          <div class="quality-metric">
            <span>${escapeHtml(metric.label)}</span>
            <strong>${escapeHtml(metric.value)}${metric.unit ? ` <small>${escapeHtml(metric.unit)}</small>` : ""}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderRivers(items) {
  const featuredActivities = ["tubing", "kayaking", "fishing", "swimming"];
  const activityLeaders = featuredActivities.map((activity) => {
    const candidates = items
      .flatMap((item) => item.activityScores
        .filter((score) =>
          score.activity === activity &&
          Number.isFinite(score.score) &&
          !["Not Applicable", "Hazardous", "Data Limited"].includes(score.rating)
        )
        .map((score) => ({ item, score })))
      .sort((a, b) => b.score.score - a.score.score);
    return { activity, leader: candidates[0] || null };
  });

  els.riverGrid.innerHTML = `
    <div class="river-module">
      <div class="activity-leaders" aria-label="Best river choices by activity">
        ${activityLeaders.map(({ activity, leader }) => `
          <article class="activity-leader ${leader?.score?.tone || "muted"}">
            <span>${escapeHtml(ACTIVITY_LABELS[activity] || activity)}</span>
            <strong>${leader ? `${escapeHtml(leader.item.river.name)} ${escapeHtml(leader.item.river.segmentName)}` : "No easy pick"}</strong>
            <p>${leader ? escapeHtml(leader.score.rating) : "Check details below"}</p>
          </article>
        `).join("")}
      </div>
      <div class="river-accordion" aria-label="Expandable river activity details">
        ${items.map(({ river, gauge, activityScores, bestActivity, fallbackNotice }, index) => `
          <details class="river-row" ${index < 2 ? "open" : ""}>
            <summary>
              <span class="rank-number">${index + 1}</span>
              <span class="rank-name">
                <b>${escapeHtml(river.name)}</b>
                <small>${escapeHtml(river.segmentName)} · ${escapeHtml(river.riverType.replace("_", " "))}</small>
              </span>
              <span class="river-best">
                <b>${escapeHtml(bestActivity ? ACTIVITY_LABELS[bestActivity.activity] || bestActivity.activity : "Best use")}</b>
                <small>${escapeHtml(bestActivity?.rating || "Check")}</small>
              </span>
              <span class="rank-score river-cfs">
                ${gauge?.dischargeCfs !== null && gauge?.dischargeCfs !== undefined && Number.isFinite(Number(gauge.dischargeCfs)) ? Math.round(gauge.dischargeCfs).toLocaleString() : "--"}
                <small>cfs</small>
              </span>
            </summary>
            <div class="river-detail">
              ${fallbackNotice ? `<div class="fallback-note">${escapeHtml(fallbackNotice)}</div>` : ""}
              <div class="streamflow-context ${normalFlowTone(gauge?.percentNormal)}">
                <div>
                  <span>Streamflow vs normal</span>
                  <strong>${escapeHtml(formatPercentNormal(gauge))}</strong>
                  <small>${escapeHtml(normalFlowLabel(gauge?.percentNormal))}${gauge?.normalMedianCfs ? ` · normal ${Math.round(gauge.normalMedianCfs).toLocaleString()} cfs` : ""}</small>
                </div>
                <a href="${escapeHtml(river.usgsUrl || `https://waterdata.usgs.gov/monitoring-location/USGS-${river.usgsGaugeId}/`)}" target="_blank" rel="noopener noreferrer">USGS gauge</a>
              </div>
              ${renderWaterQualityBlock(gauge)}
              <div class="activity-list compact">
                ${activityScores.map((item) => `
                  <div class="activity-row ${item.tone}">
                    <div>
                      <b>${escapeHtml(ACTIVITY_LABELS[item.activity] || item.activity)}</b>
                      <span>${escapeHtml(item.guidance)}</span>
                    </div>
                    <strong>${escapeHtml(item.rating)}</strong>
                  </div>
                `).join("")}
              </div>
              <p class="river-note">${escapeHtml(river.notes)}</p>
              <div class="why-line">
                ${gauge?.gaugeHeightFt !== null && gauge?.gaugeHeightFt !== undefined && Number.isFinite(Number(gauge.gaugeHeightFt)) ? `Gauge height ${Number(gauge.gaugeHeightFt).toFixed(1)} ft &middot; ` : ""}${gauge?.waterTempF !== null && gauge?.waterTempF !== undefined && Number.isFinite(Number(gauge.waterTempF)) ? `Water ${Math.round(gauge.waterTempF)}F &middot; ` : ""}${formatFlowTrend(gauge)}${gauge?.normalSampleCount ? `${gauge.normalSampleCount} years in normal comparison &middot; ` : ""}USGS ${escapeHtml(river.usgsGaugeId)}
              </div>
              <small class="data-source">${escapeHtml(formatGaugeObservation(gauge))}</small>
            </div>
          </details>
        `).join("")}
      </div>
    </div>
  `;
}

function renderWebcams(webcams = []) {
  if (!els.webcamGrid) return;
  const available = webcams.filter((cam) => cam.status === "available" && ["iframe", "image"].includes(cam.embedType));

  if (els.webcamSummary) {
    els.webcamSummary.textContent = available.length
      ? `${available.length} embedded live view${available.length === 1 ? "" : "s"} available on this page.`
      : "No reliable live water cameras are available right now.";
  }

  els.webcamGrid.innerHTML = available.map((cam) => {
    const statusLabel = "Live view";
    const statusTone = "available";
    return `
      <article class="webcam-card ${statusTone}">
        <div class="webcam-media">
          ${renderCameraMedia(cam)}
        </div>
        <div class="webcam-top">
          <div>
            <span class="region">${escapeHtml(cam.region)}</span>
            <h3>${escapeHtml(cam.name)}</h3>
            <p class="segment">${escapeHtml(cam.waterway)} · ${escapeHtml(cam.location)}</p>
          </div>
          <span class="webcam-status">${escapeHtml(statusLabel)}</span>
        </div>
        <p>${escapeHtml(cam.note)}</p>
        <div class="webcam-tags">
          ${(cam.bestFor || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="webcam-footer">
          <span>${escapeHtml(cam.provider)}</span>
          <a href="${escapeHtml(cam.url)}" target="_blank" rel="noopener noreferrer">Open camera</a>
        </div>
      </article>
    `;
  }).join("");
}

function renderRainfallSnapshot(waterfallInputs, riverInputs) {
  const combined = [...waterfallInputs, ...riverInputs];
  const rain24h = averageRainfall(combined, "rain24h");
  const rain3d = averageRainfall(combined, "rain3d");
  const rain7d = averageRainfall(combined, "rain7d");
  const rain14d = averageRainfall(combined, "rain14d");
  const wetBoost = rain3d >= 1.25 || rain7d >= 2;
  const availableCount = combined.filter((item) => item.rainfall?.available !== false).length;

  els.rainfallGrid.innerHTML = [
    ["24-hour rainfall", rain24h],
    ["3-day rainfall", rain3d],
    ["7-day rainfall", rain7d],
    ["14-day wetness", rain14d]
  ].map(([label, value]) => `
    <article class="rain-card">
      <strong>${formatInches(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `).join("");

  els.rainfallNarrative.textContent = !availableCount
    ? "Basin precipitation estimates are temporarily unavailable. Waterfall scores are withheld until the feed returns."
    : wetBoost
      ? `Radar-estimated and modeled basin rainfall is elevated across ${availableCount} locations. Fast creeks respond first; check access and slick-rock conditions.`
      : `Radar-estimated and modeled rainfall is modest across ${availableCount} locations, so smaller waterfalls and creeks may be quieter.`;
}

function renderSafetyNotes() {
  const notes = [
    "Conditions can change quickly, especially after thunderstorms.",
    "Always check local closures, posted warnings, and your own skill level before entering the water.",
    "Avoid entering the water during hazardous flow, swift current, or when rocks are visibly slick.",
    "Experienced paddlers only means the river may be useful for skilled whitewater users, not casual recreation."
  ];

  els.safetyList.innerHTML = notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("");
}

export async function renderWaterPage() {
  const data = await getWaterPageInputs();
  const rainfallById = Object.fromEntries(data.waterfallRainfall.map((item) => [item.waterfallId, item.rainfall]));
  const riverInputById = Object.fromEntries(data.riverInputs.map((item) => [item.riverId, item]));
  const waterfalls = buildWaterfallIndex(data.waterfalls, rainfallById);
  const rivers = buildRiverIndex(data.rivers, riverInputById, data.weather);

  if (els.generatedAt) els.generatedAt.textContent = formatDateTime(data.meta?.generatedAt);
  if (els.dataStatus) {
    els.dataStatus.textContent = data.meta?.status === "live"
      ? "Radar-estimated basin rainfall and live USGS gauges are feeding this read."
      : data.meta?.status === "partial"
        ? "Some live inputs are unavailable; affected scores are clearly withheld."
        : "Live inputs are unavailable; placeholder scores are not being used.";
  }
  renderSummary(waterfalls, rivers, data.weather);
  renderVisualDashboard(data.webcams || [], waterfalls, rivers);
  renderWaterfalls(waterfalls);
  renderRivers(rivers);
  renderWebcams(data.webcams || []);
  renderRainfallSnapshot(
    data.waterfallRainfall.map((item) => ({ rainfall: item.rainfall })),
    data.riverInputs.map((item) => ({ rainfall: item.rainfall }))
  );
  renderSafetyNotes();
}

try {
  await renderWaterPage();
} catch (error) {
  console.warn("Water page failed to render", error);
  if (els.summaryGrid) {
    els.summaryGrid.innerHTML = `
      <article class="summary-card red">
        <span>Water conditions</span>
        <strong>Unable to load</strong>
        <p>The page could not build the current water estimate. Please check back shortly.</p>
      </article>
    `;
  }
}
