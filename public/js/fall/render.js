const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const formatUpdated = (value) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));

export function renderFallExplorer(model) {
  document.body.classList.remove("is-loading");
  setText("#updated", `Forecast updated ${formatUpdated(model.updated)}`);
  renderQualityNotice(model.quality);
  renderObservationMethod(model.quality?.observations, model.quality?.calibration);
  setText("#fallRating", model.today.rating.toUpperCase());
  setText("#fallScore", `${model.today.score} / 100`);
  setText("#viewsScore", `${model.today.viewsScore} / 100`);
  setText("#photoRating", model.today.photoRating.toUpperCase());
  setText("#leafDrop", model.today.leafDropRisk.toUpperCase());
  setText("#todaySummary", model.today.summary);
  renderPeakTiming(model.season.peakTiming);

  const recommendation = model.recommendations;
  $("#recommendations").innerHTML = [
    recommendationCard("🏆", "Best bet today", recommendation.bestBet.name, `${stars(recommendation.bestBet.score)} <span>Best: ${esc(recommendation.bestBet.window)}</span>`, recommendation.bestBet.reason),
    recommendationCard("📸", "Best photo window", recommendation.photoWindow.label, "Low-angle light", recommendation.photoWindow.reason),
    recommendationCard("👀", "Best long-range views", recommendation.bestViews.name, `Visibility signal: ${ratingForView(recommendation.bestViews.score)}`, "Forecast visibility is supported by 828 summit-view signals where available."),
    recommendation.avoid
      ? recommendationCard("⚠️", "Maybe skip", recommendation.avoid.name, "Comparatively weaker", recommendation.avoid.reason, "caution")
      : recommendationCard("✓", "No major weather concern", "No clear skip today", "Destinations are fairly even", "Recheck live cameras before committing to a high summit.", "good")
  ].join("");

  $("#elevationBands").innerHTML = model.elevation.bands.map((band) => `
    <div class="elevation-row">
      <div class="elevation-height">${esc(band.label)}</div>
      <div class="elevation-line"><span></span></div>
      <div class="elevation-temp">${Number.isFinite(band.temperatureF) ? `${band.temperatureF}°` : "--"}</div>
      <div class="elevation-status ${statusClass(band.status)}">${esc(band.status)}</div>
    </div>`).join("");
  renderThreshold(model.elevation.thresholds.temp32);
  $("#coldPool").hidden = !model.elevation.coldPoolRisk;

  $("#seasonTimeline").innerHTML = model.season.elevationBands.map((band) => `
    <div class="season-step ${band.status.toLowerCase().replace(/\s+/g, "-")}">
      <div class="season-elevation">${esc(band.label)}</div>
      <div class="season-rail"><span></span></div>
      <div><b>${band.status === "Reached" ? "●" : band.status === "Approaching" ? "◉" : "○"} ${esc(band.status)}</b><small>${band.date ? `First freeze · ${esc(band.date)}` : band.status === "Approaching" ? "Forecast nights near 32–36°F" : "First freeze not recorded"}</small></div>
    </div>`).join("");

  $("#outlookGrid").innerHTML = model.outlook.map((day) => `
    <article class="outlook-card ${day.key === model.bestOutlook?.key ? "best" : ""}">
      ${day.key === model.bestOutlook?.key ? '<div class="best-ribbon">🏆 Best fall day</div>' : ""}
      <div class="outlook-day">${esc(day.day)}</div><div class="outlook-icon">${day.icon}</div>
      <h3>${esc(day.rating)}</h3><div class="outlook-score">${day.score} / 100</div>
      <ul>${day.details.map((detail) => `<li>${esc(detail)}</li>`).join("")}</ul>
    </article>`).join("");
  const watch = model.leafDropWatch;
  if (watch && watch.leafDropRisk !== "Low") {
    $("#leafDropWatch").hidden = false;
    $("#leafDropWatch").innerHTML = `<b>🍂 Leaf Drop Watch — ${esc(watch.day)}</b><span>${esc(watch.leafDropReason)}</span>`;
  }

  $("#cameraGrid").innerHTML = model.cameras.map((camera) => `
    <article class="camera-card">
      <a class="camera-media" href="${esc(camera.sourceUrl)}" target="_blank" rel="noopener noreferrer">
        ${cameraMedia(camera)}
        <span class="live-badge"><i></i> ${camera.imageUrl ? "Live view" : "Live stream"}</span>
      </a>
      <div class="camera-copy"><div><h3>${esc(camera.name)}</h3><p>${camera.elevationFeet.toLocaleString()} ft · ${esc(camera.region)}</p></div><small data-camera-status="${esc(camera.id)}">${camera.imageUrl ? "Live source" : "Video source"} · tap to open</small></div>
    </article>`).join("");
  bindCameraStatus(model.cameras);
}

export function renderFailure() {
  document.body.classList.remove("is-loading");
  $("#dataNotice").hidden = false;
  $("#dataNotice").textContent = "Live fall intelligence is temporarily unavailable. The camera links below may still be used as direct visual checks.";
}

function recommendationCard(icon, kicker, title, meta, copy, kind = "") { return `<article class="recommendation-card ${kind}"><div class="recommendation-icon">${icon}</div><div class="eyebrow">${esc(kicker)}</div><h3>${esc(title)}</h3><div class="recommendation-meta">${meta}</div><p>${esc(copy)}</p></article>`; }
function stars(score) { const count = Math.max(1, Math.min(5, Math.round(score / 20))); return `<span aria-label="${count} out of 5 stars">${"★".repeat(count)}${"☆".repeat(5 - count)}</span>`; }
function ratingForView(score) { return score >= 85 ? "Excellent" : score >= 72 ? "Very good" : score >= 58 ? "Good" : score >= 42 ? "Mixed" : "Poor"; }
function statusClass(status) { return status.toLowerCase().replace(/\s+/g, "-"); }
function renderThreshold(threshold) {
  const label = threshold?.ambiguous
    ? "No single threshold — multiple cold pockets are possible"
    : threshold?.reached && threshold.range
      ? `Approximately ${threshold.range[0].toLocaleString()}–${threshold.range[1].toLocaleString()} ft`
      : "Not indicated in tonight's destination forecast";
  setText("#freezeThreshold", label);
}
function renderPeakTiming(peak) {
  if (!peak) return;
  setText("#peakMidpoint", peak.midpoint);
  setText("#peakWindow", peak.planningWindow);
  setText("#peakSeptember", `${peak.septemberMeanF.toFixed(1)}°F`);
  setText("#peakInputLabel", peak.inputLabel);
  setText("#peakScope", peak.model.elevationRange);
  setText("#peakConfidence", peak.confidence);
  const shift = peak.shiftDays > 0
    ? `${peak.shiftDays.toFixed(1)} days later than the 64.7°F baseline`
    : peak.shiftDays < 0
      ? `${Math.abs(peak.shiftDays).toFixed(1)} days earlier than the 64.7°F baseline`
      : "No shift from the 64.7°F baseline";
  setText("#peakShift", shift);
  setText("#peakCaveat", peak.caveat);
}
function renderObservationMethod(observations, calibration) {
  if (!observations || !Number.isFinite(observations.availableAnchors)) {
    setText("#observationMethod", "Forecast status ≠ observed milestone");
    return;
  }
  const reducedWeight = (observations.anchors || []).filter((anchor) => Number(anchor.weight) < 1).length;
  const supportingText = reducedWeight ? `; ${reducedWeight} sheltered terrain reference${reducedWeight === 1 ? "" : "s"} used at reduced weight` : "";
  const calibrationText = calibration?.samples ? ` ${calibration.samples} forecast comparisons recorded in shadow mode; observations are not correcting the forecast yet.` : " Observations are diagnostic-only during calibration.";
  setText("#observationMethod", `${observations.availableAnchors}/${observations.requestedAnchors} fresh observation anchors${supportingText}.${calibrationText}`);
}
function renderQualityNotice(quality = {}) {
  const notice = $("#dataNotice");
  if (!notice) return;
  if (quality.status === "partial") {
    notice.hidden = false;
    notice.textContent = `NOAA/NWS guidance is available for ${quality.availableDestinations} of ${quality.requestedDestinations} destinations. Recommendations exclude unavailable locations.`;
  } else if (quality.status === "stale") {
    notice.hidden = false;
    notice.textContent = "NOAA/NWS is temporarily unavailable. Showing the last successful Fall Explorer forecast with a stale-data warning.";
  } else if (["stale", "unavailable"].includes(quality.observations?.status)) {
    notice.hidden = false;
    notice.textContent = "NOAA/NWS guidance is current, but local elevation observations are unavailable or too old to use. Forecast calculations remain available without the ground-truth confidence check.";
  } else {
    notice.hidden = true;
  }
}
function setText(selector, value) { const el = $(selector); if (el) el.textContent = value; }
function cacheBust(url) { return `${url}${url.includes("?") ? "&" : "?"}fall=${Math.floor(Date.now() / 300000)}`; }
function cameraMedia(camera) {
  if (camera.imageUrl) return `<img src="${esc(cacheBust(camera.imageUrl))}" alt="${esc(camera.alt)}" loading="lazy" data-camera-id="${esc(camera.id)}">`;
  return `<div class="camera-placeholder" role="img" aria-label="${esc(camera.alt)}"><span aria-hidden="true">▶</span><b>Open live stream</b><small>Hosted by the camera provider</small></div>`;
}
function bindCameraStatus(cameras) { cameras.filter((camera) => camera.imageUrl).forEach((camera) => { const img = document.querySelector(`[data-camera-id="${camera.id}"]`); const status = document.querySelector(`[data-camera-status="${camera.id}"]`); img?.addEventListener("load", () => { status.textContent = `Checked ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date())}`; }); img?.addEventListener("error", () => { status.textContent = "Image unavailable · open source"; }); }); }
