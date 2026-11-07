(() => {
const SITE_LINKS = [
  ["Home", "/"],
  ["Forecast", "/forecast.html"],
  ["Radar & Satellite", "/radar.html"],
  ["FEELSCORE", "/se_feelscore.html"],
  ["Sky & Sunset", "/828-sunset-radiance.html"],
  ["Microscope", "/asheville-microscope.html"],
  ["Hiking", "/hiking.html"],
  ["Water Conditions", "/water.html"],
  ["I-26 Connector", "/i26-connector.html"],
  ["Weather Pulse", "/pulse.html"],
];

const currentPath = window.location.pathname.replace(/\/$/, "") || "/";

function isCurrent(href) {
  const target = href.replace(/\/$/, "") || "/";
  return currentPath === target || (currentPath === "/index.html" && target === "/");
}

function buildLink(label, href) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.textContent = label;
  if (isCurrent(href)) {
    anchor.classList.add("active");
    anchor.setAttribute("aria-current", "page");
  }
  return anchor;
}

document.querySelectorAll("[data-site-nav]").forEach((nav) => {
  const more = document.createElement("details");
  more.className = "site-nav-more";
  const summary = document.createElement("summary");
  summary.textContent = "More";
  const menu = document.createElement("div");
  menu.className = "site-nav-menu";
  menu.append(...SITE_LINKS.slice(7).map(([label, href]) => buildLink(label, href)));
  if (SITE_LINKS.slice(7).some(([, href]) => isCurrent(href))) summary.classList.add("active");
  more.append(summary, menu);
  nav.replaceChildren(...SITE_LINKS.slice(0, 7).map(([label, href]) => buildLink(label, href)), more);
  const notificationButton = nav.closest("[data-site-header]")?.querySelector("#enableNotificationsBtn");
  if (notificationButton) {
    const desktopPosition = document.createComment("Notification button desktop position");
    notificationButton.before(desktopPosition);
    const mobileLayout = window.matchMedia("(max-width: 900px)");
    const positionNotifications = () => {
      if (mobileLayout.matches) menu.append(notificationButton);
      else desktopPosition.after(notificationButton);
    };
    positionNotifications();
    mobileLayout.addEventListener("change", positionNotifications);
  }
  document.addEventListener("click", (event) => {
    if (!more.contains(event.target)) more.open = false;
  });
  more.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      more.open = false;
      summary.focus();
    }
  });
});

document.querySelectorAll("[data-site-brand]").forEach((brand) => {
  brand.classList.add("site-brand-lockup");
  brand.innerHTML = `
    <img class="site-brand-emblem" src="/images/mountain-sunrise.png" alt="" width="150" height="50">
    <span class="site-brand-title"><span class="site-brand-828">828</span> Weather Direct</span>
    <span class="site-brand-sub">Hyper-local Asheville forecast by Tim Ballisty</span>
  `;
});

const footerLinks = [
  ...SITE_LINKS,
  ["About", "https://www.linkedin.com/in/timballisty"],
  ["Contact", "mailto:tballisty@gmail.com"],
  ["Support", "https://ko-fi.com/irisheagle"],
];

document.querySelectorAll("[data-site-footer]").forEach((footer) => {
  footer.className = "global-site-footer";
  footer.replaceChildren();

  const inner = document.createElement("div");
  inner.className = "global-footer-inner";
  inner.innerHTML = `
    <div class="global-footer-brand">
      <div class="global-footer-brand-heading">
        <a class="global-footer-mark" href="/" aria-label="828 Weather Direct home">
          <img src="/images/828-weather-direct-logo.webp" alt="" width="64" height="64" loading="lazy" decoding="async">
        </a>
        <div class="global-footer-logo">828 Weather Direct</div>
      </div>
      <p class="global-footer-tagline">Hyper-local weather, sky context, and outdoor timing for Asheville, Western North Carolina, and the greater 828 region.</p>
    </div>
    <nav class="global-footer-links" aria-label="Footer navigation"></nav>
    <div class="global-footer-meta">
      <span>Serving Asheville, Western North Carolina, and the greater 828 region.</span>
      <span class="global-footer-bottom">&copy; 2026 828 Weather Direct</span>
      <span class="global-footer-disclaimer">For general awareness only—not a substitute for official forecasts, warnings, road information, or outdoor-safety guidance.</span>
    </div>
  `;

  const nav = inner.querySelector(".global-footer-links");
  footerLinks.forEach(([label, href]) => nav.append(buildLink(label, href)));
  footer.append(inner);
});
})();
