const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const reading = (value, unit) => Number.isFinite(value) ? `${Math.round(value)}${unit}` : "Unavailable";

// One shared popover stays outside the scrolling SVG so it cannot be clipped.
export function attachProfileDetails(profile, stations, { observationTime }) {
  const controller = new AbortController();
  const on = (target, event, handler, options = {}) => target.addEventListener(event, handler, { ...options, signal: controller.signal });
  const byId = new Map(stations.map(station => [station.id, station]));
  const panel = document.createElement("section");
  panel.id = "hikingProfileDetails";
  panel.className = "profile-popover";
  panel.setAttribute("aria-label", "Station conditions");
  panel.hidden = true;
  document.body.append(panel);
  let active = null;
  let pinned = false;
  let timer;
  let restoringFocus = false;
  const clearTimer = () => clearTimeout(timer);
  const siteFor = (target) => target instanceof Element ? target.closest("[data-profile-station]") : null;

  function hide(returnFocus = false) {
    clearTimer();
    const previous = active;
    active?.setAttribute("aria-expanded", "false");
    active?.removeAttribute("aria-describedby");
    active = null;
    pinned = false;
    panel.hidden = true;
    if (returnFocus && previous) {
      restoringFocus = true;
      previous.focus({ preventScroll: true });
      restoringFocus = false;
    }
  }

  function position() {
    if (!active) return;
    const dot = active.querySelector(".profile-dot").getBoundingClientRect();
    const chart = profile.getBoundingClientRect();
    if (dot.right < chart.left || dot.left > chart.right || dot.bottom < 0 || dot.top > innerHeight) return hide();
    const bounds = panel.getBoundingClientRect();
    const left = Math.max(16, Math.min(innerWidth - bounds.width - 16, dot.left + dot.width / 2 - bounds.width / 2));
    const below = dot.bottom + 12;
    const top = below + bounds.height <= innerHeight - 16 ? below : dot.top - bounds.height - 12;
    panel.style.left = `${left}px`;
    panel.style.top = `${Math.max(16, Math.min(innerHeight - bounds.height - 16, top))}px`;
  }

  function show(site) {
    clearTimer();
    const station = byId.get(site?.dataset.profileStation);
    if (!station) return;
    if (active !== site) {
      active?.setAttribute("aria-expanded", "false");
      active?.removeAttribute("aria-describedby");
      active = site;
      const metrics = [
        ["Temperature", reading(station.temperatureF, "°F")],
        ["Feels like", reading(station.feelsLikeF, "°F")],
        ["Dew point", reading(station.dewPointF, "°F")],
        ["Humidity", reading(station.humidityPct, "%")],
        ["Wind", reading(station.windMph, " mph")],
        ["Gust", reading(station.gustMph, " mph")]
      ];
      if (Number.isFinite(station.rainTodayIn)) metrics.push(["Rain today", `${station.rainTodayIn.toFixed(2)} in`]);
      if (Number.isFinite(station.uv)) metrics.push(["UV index", reading(station.uv, "")]);
      panel.innerHTML = `
        <button class="profile-popover-close" type="button" aria-label="Close station conditions">×</button>
        <h3>${escapeHtml(station.name)}</h3>
        <p class="profile-popover-source">${escapeHtml(station.elevationFt)} ft · ${escapeHtml(station.source || "Station")}</p>
        <p class="profile-popover-time">${escapeHtml(observationTime(station.observedAt))}${station.retrievalMode?.includes("fallback") ? " · fallback reading" : ""}</p>
        <dl>${metrics.map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl>
        ${/^https:\/\//i.test(station.url || "") ? `<a href="${escapeHtml(station.url)}" target="_blank" rel="noopener noreferrer">Open station →</a>` : ""}
      `;
    }
    site.setAttribute("aria-expanded", "true");
    site.setAttribute("aria-describedby", panel.id);
    panel.hidden = false;
    position();
  }

  function scheduleHide() {
    clearTimer();
    timer = setTimeout(() => {
      if (!pinned && !active?.contains(document.activeElement) && !panel.contains(document.activeElement)) hide();
    }, 160);
  }

  function toggle(site) {
    if (active === site && pinned) return hide();
    show(site);
    pinned = true;
  }

  on(profile, "pointerover", event => {
    const site = siteFor(event.target);
    if (site && event.pointerType !== "touch" && !pinned) show(site);
  });
  on(profile, "pointerout", event => {
    const site = siteFor(event.target);
    if (site && !site.contains(event.relatedTarget) && !panel.contains(event.relatedTarget)) scheduleHide();
  });
  on(profile, "focusin", event => {
    const site = siteFor(event.target);
    if (site && !restoringFocus) {
      if (active !== site) pinned = false;
      show(site);
    }
  });
  on(profile, "focusout", scheduleHide);
  on(profile, "click", event => {
    const site = siteFor(event.target);
    if (site) toggle(site);
  });
  on(profile, "keydown", event => {
    const site = siteFor(event.target);
    if (site && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      toggle(site);
    }
  });
  on(panel, "pointerenter", clearTimer);
  on(panel, "pointerleave", scheduleHide);
  on(panel, "focusin", clearTimer);
  on(panel, "focusout", scheduleHide);
  on(panel, "click", event => {
    if (event.target.closest(".profile-popover-close")) hide(true);
  });
  on(document, "pointerdown", event => {
    if (active && !panel.contains(event.target) && !active.contains(event.target)) hide();
  });
  on(document, "keydown", event => {
    if (active && event.key === "Escape") {
      event.preventDefault();
      hide(panel.contains(document.activeElement));
    }
  });
  on(window, "resize", position);
  on(document, "scroll", position, { capture: true, passive: true });
  return () => { hide(); controller.abort(); panel.remove(); };
}
