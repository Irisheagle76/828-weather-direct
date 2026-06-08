const SKY_INDEX_ENDPOINTS = [
  "/api/sky-index",
  "https://avlweather.com/api/sky-index"
];

const FALLBACK_CHARTS = [
  {
    name: "Mount Mitchell",
    url: "https://www.cleardarksky.com/c/MtMtchllNCcsk.gif"
  },
  {
    name: "Mount Pisgah",
    url: "https://www.cleardarksky.com/c/MtPisgah1NCcsk.gif"
  },
  {
    name: "Grassland Mountain",
    url: "https://www.cleardarksky.com/c/GssMtnObNCcsk.gif"
  },
  {
    name: "Max Patch North",
    url: "https://www.cleardarksky.com/c/WntHwkObTNcsk.gif"
  }
];

const els = {
  grid: document.querySelector("#summitIndexGrid"),
  updated: document.querySelector("#summitIndexUpdated")
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function score(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(Math.max(0, Math.min(100, n))) : 0;
}

function feet(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n).toLocaleString() : "--";
}

function formatUpdated(value) {
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "Sky index updated recently";
  return `Updated ${new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  })}`;
}

async function fetchSkyIndex() {
  let lastError = null;
  for (const endpoint of SKY_INDEX_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}?t=${Date.now()}`);
      if (!res.ok) throw new Error(`Sky index failed: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data?.sites)) throw new Error("Sky index payload missing sites");
      return data;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Sky index unavailable");
}

function renderFallback() {
  if (els.updated) els.updated.textContent = "Sky index unavailable";
  if (!els.grid) return;
  els.grid.innerHTML = `
    <article class="summit-index-fallback">
      <h3>Summit View Index unavailable right now.</h3>
      <p>The Clear Dark Sky source charts are still available while the index refreshes.</p>
      <div class="summit-fallback-actions">
        ${FALLBACK_CHARTS.map((chart) => `
          <a href="${chart.url}" target="_blank" rel="noopener noreferrer">${chart.name} sky chart</a>
        `).join("")}
      </div>
    </article>
  `;
}

function renderSite(site) {
  const scores = site.scores || {};
  const siteId = String(site.id || site.name || "summit").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
  const detailsId = `summit-details-${siteId}`;
  const minis = [
    ["View", scores.summitView],
    ["Sunset", scores.sunriseSunset],
    ["Stars", scores.nightSky],
    ["Undercast", scores.undercast]
  ];
  const window = Array.isArray(site.windows) ? site.windows[0] : null;
  const statusNote = site.status === "live-fog"
    ? `<div class="summit-window"><b>Live fog signal:</b> ${escapeHtml(site.liveSignal?.summary || "Current summit conditions are limiting visibility.")}</div>`
    : site.status === "camera-fog" || site.status === "camera-limited"
      ? `<div class="summit-window"><b>Camera check:</b> ${escapeHtml(site.liveSignal?.summary || "The live camera is limiting confidence in the chart-based score.")}</div>`
    : site.status && site.status !== "ok"
      ? `<div class="summit-window"><b>${escapeHtml(site.status)}:</b> Sky index is using a cautious fallback read. Open the chart before making a special drive.</div>`
    : "";

  return `
    <article class="summit-site-card">
      <div class="summit-site-top">
        <div>
          <strong class="summit-site-name">${escapeHtml(site.name)}</strong>
          <span class="summit-site-elevation">${feet(site.elevationFt)} ft &bull; Clear Dark Sky source</span>
          <span class="summit-rating">${escapeHtml(site.rating || "Unavailable")}</span>
        </div>
        <div class="summit-score" aria-label="${escapeHtml(site.name)} Summit View score">
          <strong>${score(scores.summitView)}</strong>
          <span>View</span>
        </div>
      </div>
      <p class="summit-headline">${escapeHtml(site.headline || "Sky-viewing signal is updating.")}</p>
      <button class="summit-toggle" type="button" aria-expanded="false" aria-controls="${detailsId}">View more</button>
      <div class="summit-details" id="${detailsId}" hidden>
        <div class="summit-mini-grid">
          ${minis.map(([label, value]) => `
            <div class="summit-mini">
              <b>${score(value)}</b>
              <span>${label}</span>
            </div>
          `).join("")}
        </div>
        <ul class="summit-bullets">
          ${(Array.isArray(site.bullets) ? site.bullets.slice(0, 3) : []).map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}
        </ul>
        ${window ? `
          <div class="summit-window">
            <b>${escapeHtml(window.label)}:</b> ${escapeHtml(window.summary || "Best window is updating.")}
          </div>
        ` : ""}
        ${statusNote}
        <div class="summit-actions">
          <a href="${escapeHtml(site.chartUrl)}" target="_blank" rel="noopener noreferrer">Open sky chart</a>
        </div>
      </div>
    </article>
  `;
}

async function hydrateSkyIndex() {
  if (!els.grid) return;
  try {
    const data = await fetchSkyIndex();
    if (els.updated) els.updated.textContent = formatUpdated(data.updated);
    els.grid.innerHTML = data.sites.map(renderSite).join("");
  } catch (error) {
    console.warn("Summit View Index unavailable", error);
    renderFallback();
  }
}

hydrateSkyIndex();

els.grid?.addEventListener("click", (event) => {
  const button = event.target.closest(".summit-toggle");
  if (!button) return;

  const details = document.getElementById(button.getAttribute("aria-controls"));
  if (!details) return;

  const isExpanded = button.getAttribute("aria-expanded") === "true";

  if (!isExpanded) {
    els.grid.querySelectorAll(".summit-toggle[aria-expanded='true']").forEach((openButton) => {
      const openDetails = document.getElementById(openButton.getAttribute("aria-controls"));
      openButton.setAttribute("aria-expanded", "false");
      openButton.textContent = "View more";
      if (openDetails) openDetails.hidden = true;
    });
  }

  button.setAttribute("aria-expanded", String(!isExpanded));
  button.textContent = isExpanded ? "View more" : "Show less";
  details.hidden = isExpanded;
});
