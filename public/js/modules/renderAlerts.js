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

  container.innerHTML = active.map(alert => `
    <a class="site-alert site-alert-${escapeAttr(alert.severity || "heads-up")}" href="${escapeAttr(alert.url || "/")}">
      <span class="site-alert-meta">${escapeHtml(formatType(alert.type))} - ${escapeHtml(alert.timing || "Now")}</span>
      <strong>${escapeHtml(alert.title)}</strong>
      <span>${escapeHtml(alert.message)}</span>
      ${alert.action ? `<em>${escapeHtml(alert.action)}</em>` : ""}
    </a>
  `).join("");
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
