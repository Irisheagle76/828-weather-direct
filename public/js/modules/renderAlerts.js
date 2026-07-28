export async function loadAndRenderAlerts(container) {
  if (!container) return;

  try {
    const res = await fetch("/api/router?route=alerts/latest", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderAlerts(container, data.alerts || []);
  } catch (err) {
    console.error("Alert load error:", err);
    container.innerHTML = "";
  }
}

function renderAlerts(container, alerts = []) {
  const active = alerts.filter(alert => !isExpired(alert));
  if (!active.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = active.map(buildAlertMarkup).join("");
}

export function buildAlertMarkup(alert = {}) {
  const imageUrl = normalizePublicImageUrl(alert.imageUrl);

  return `
    <a class="site-alert site-alert-${escapeAttr(alert.severity || "heads-up")}" href="${escapeAttr(alert.url || "/")}">
      ${imageUrl ? `<img class="site-alert-image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(alert.title ? `${alert.title} alert image` : "Alert image")}" loading="lazy" />` : ""}
      <span class="site-alert-meta">${escapeHtml(formatType(alert.type))} - ${escapeHtml(alert.timing || "Now")}</span>
      <strong>${escapeHtml(alert.title)}</strong>
      <span>${escapeHtml(alert.message)}</span>
      ${alert.action ? `<em>${escapeHtml(alert.action)}</em>` : ""}
    </a>
  `;
}

function normalizePublicImageUrl(value) {
  const imageUrl = String(value || "").trim();
  if (!imageUrl) return "";

  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function isExpired(alert) {
  if (!alert?.expiresAt) return false;
  return new Date(alert.expiresAt).getTime() <= Date.now();
}

function formatType(type = "") {
  if (type === "heat-cold" || type === "temperature") return "Temperature";

  return String(type)
    .replace(/-/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
