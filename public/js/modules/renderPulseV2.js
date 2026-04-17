// /js/modules/renderPulseV2.js

export function renderPulseV2(container, pulse) {
  if (!container) return;

  if (!pulse) {
    container.innerHTML = `
      <div class="content-card pulse-card">
        <div class="section-title">PULSE</div>
        <div class="pulse-empty">No recent updates</div>
      </div>
    `;
    return;
  }

  const time = formatTimeAgo(new Date(pulse.timestamp));
  const text = cleanText(pulse.text || pulse.body || "");
  const preview = buildPreview(text);

  const media = pulse.mediaUrl || pulse.image;

  container.innerHTML = `
    <div class="content-card pulse-card">

      <div class="section-title">PULSE</div>

      ${media ? `
        <div class="pulse-media">
          <img src="${media}" />
        </div>
      ` : ""}

      <div class="pulse-meta">${time}</div>

      <div class="pulse-text">
        ${preview}
      </div>

      <div class="pulse-expand">Tap for full update</div>

    </div>
  `;
}

// -----------------------------
// HELPERS (simplified)
// -----------------------------

function cleanText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPreview(text) {
  if (!text) return "";
  return text.length > 140
    ? text.slice(0, 140).trim() + "…"
    : text;
}

function formatTimeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}