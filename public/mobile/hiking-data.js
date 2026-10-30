import { selectHikingProfileStations } from "../js/hiking-profile.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const usable = station => station.health?.usable !== false && Number.isFinite(station.temperatureF);
const reading = (value, unit) => Number.isFinite(value) ? `${Math.round(value)}${unit}` : "Unavailable";

export function hikingReportState(payload = {}, now = Date.now()) {
  const age = now - Date.parse(payload.generatedAt);
  const stations = payload.stations || [];
  const available = Number.isFinite(payload.quality?.availableStations) ? payload.quality.availableStations : stations.filter(usable).length;
  const requested = Number.isFinite(payload.quality?.requestedStations) ? payload.quality.requestedStations : stations.length;
  const stale = !Number.isFinite(age) || age > 45 * 60000 || age < -5 * 60000 || available === 0 || payload.quality?.status === "unavailable";
  const partial = available < requested || payload.quality?.status === "partial";
  const fallback = payload.quality?.fallbackStations || stations.filter(station => usable(station) && station.retrievalMode?.includes("fallback")).length;
  const score = !stale && Number.isFinite(payload.guidance?.hikerScore) ? Math.min(100, Math.max(0, Math.round(payload.guidance.hikerScore))) : null;
  return { stale, partial, available, requested, fallback, score };
}

function stationReadings(station) {
  if (!usable(station)) return '<p class="body-copy">Current readings unavailable. This site is excluded from the guidance.</p>';
  const timestamp = Date.parse(station.observedAt);
  const observed = Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York", timeZoneName: "short" }) : "Time unavailable";
  const metrics = [["Feels like", reading(station.feelsLikeF, "°F")], ["Dew point", reading(station.dewPointF, "°F")], ["Humidity", reading(station.humidityPct, "%")], ["Wind", reading(station.windMph, " mph")], ["Gust", reading(station.gustMph, " mph")]];
  if (Number.isFinite(station.rainTodayIn)) metrics.push(["Rain today", `${station.rainTodayIn.toFixed(2)} in`]);
  return `<p class="hiking-station-time">${escapeHtml(station.source || "Station")} · Observed ${escapeHtml(observed)}${station.retrievalMode?.includes("fallback") ? " · saved fallback reading" : ""}</p>${station.conditions ? `<p class="body-copy">${escapeHtml(station.conditions)}</p>` : ""}<dl class="hiking-station-metrics">${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}

function stationDetail(station, profile = false) {
  const elevation = Number.isFinite(station.elevationFt) ? `${Math.round(station.elevationFt).toLocaleString()} ft` : "Elevation unavailable";
  const bar = profile ? `<div class="elevation-bar-track" aria-hidden="true"><span style="width:${Math.min(100, Math.max(0, station.elevationFt / 6684 * 100))}%"></span></div>` : "";
  const link = /^https:\/\//i.test(station.url || "") ? `<a class="product-link" href="${escapeHtml(station.url)}" target="_blank" rel="noopener noreferrer">Open station →</a>` : "";
  return `<details class="hiking-station-detail" data-station-id="${escapeHtml(station.id)}"><summary class="${profile ? "elevation-chart-row" : "hiking-station-summary"}"><span><strong>${escapeHtml(station.name)}</strong><small>${elevation}</small></span>${bar}<span class="elevation-weather"><strong>${usable(station) ? reading(station.temperatureF, "°F") : "Unavailable"}</strong><small>Tap for readings</small></span></summary>${stationReadings(station)}${link}</details>`;
}

export function hikingNetworkMarkup(payload = {}, { now = Date.now() } = {}) {
  const report = hikingReportState(payload, now);
  const all = (payload.stations || []).slice().sort((a, b) => (a.elevationFt || 0) - (b.elevationFt || 0));
  const profile = selectHikingProfileStations(all);
  return `<section class="panel hiking-network${report.partial ? " is-partial" : ""}"><p class="kicker">Station coverage</p><h2>${report.available} of ${report.requested} sites reporting</h2>
    ${report.stale ? '<p class="body-copy">This report needs an update. Saved readings below are not a current trail assessment.</p>' : ""}
    ${report.partial ? '<p class="body-copy">Coverage is reduced. Unavailable sites cannot rule out wind, rain, or lightning on your route.</p>' : ""}
    ${report.fallback ? `<p class="body-copy">${report.fallback} ${report.fallback === 1 ? "site uses a recent saved reading" : "sites use recent saved readings"}; check the observation times.</p>` : ""}
    <p class="body-copy">Lightning observations come from available Asheville-area Tempest stations; they do not cover every hiking area.</p>
    </section>
    <section class="panel elevation-profile"><p class="kicker">${report.stale ? "Last published" : "Observed"} elevation profile</p><h2>Conditions up the mountain</h2><p class="body-copy">${profile.length} selected sites span Asheville through the high country. Tap a station for its readings.</p><div class="elevation-chart">${profile.map(station => stationDetail(station, true)).join("") || '<p class="body-copy">Usable station readings are unavailable.</p>'}</div><small>Bar length shows elevation relative to 6,684 ft.</small></section>
    <section class="panel"><details class="hiking-all-stations"><summary>All ${all.length} station readings</summary><p class="body-copy">Every configured site is listed, including stations outside the selected profile.</p>${all.map(station => stationDetail(station)).join("")}</details></section>`;
}
