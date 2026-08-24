(() => {
const SITE_LINKS = [
  ["Home", "/"],
  ["Forecast", "/forecast.html"],
  ["Radar & Satellite", "/radar.html"],
  ["FEELSCORE", "/se_feelscore.html"],
  ["Hiking", "/hiking.html"],
  ["Water Conditions", "/water.html"],
  ["I-26 Connector", "/i26-connector.html"],
  ["Weather Pulse", "/pulse.html"],
  ["Fall Explorer", "/fall.html"],
  ["Sunset Radiance", "/828-sunset-radiance.html"],
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
  nav.replaceChildren(...SITE_LINKS.map(([label, href]) => buildLink(label, href)));
});

document.querySelectorAll("[data-site-brand]").forEach((brand) => {
  brand.classList.add("site-brand-lockup");
  brand.innerHTML = `
    <span class="site-brand-title"><span class="site-brand-828">828</span> Weather Direct</span>
    <span class="site-brand-sub">Hyper-local Asheville forecast built by Tim Ballisty</span>
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
      <div class="global-footer-logo">828 Weather Direct</div>
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
