// /intel/pulse-utils.js
// ============================================================
// PULSE UTILITIES — Media, Preview, Timestamp
// Extracted from app.js with no behavior changes
// ============================================================

export function renderPulseMedia(url) {
  const container = document.getElementById("pulse-media");
  if (!container || !url) return;

  const isVideo =
    url.includes("/video/upload") ||
    url.endsWith(".mp4");

  container.innerHTML = isVideo
    ? `
      <video autoplay loop muted playsinline class="pulse-video">
        <source src="${url}" type="video/mp4">
      </video>
    `
    : `<img src="${url}" class="pulse-video" />`;
}

export function buildPulsePreview(html) {
  const div = document.createElement("div");
  div.innerHTML = html;
  const text = div.textContent || div.innerText || "";

  const sentences = text.split(/(?<=[.!?])\s+/);
  let preview = sentences[0] || "";

  if (preview.length < 120 && sentences.length > 1) {
    preview += " " + sentences[1];
  }

  if (preview.length > 200) {
    preview = preview.slice(0, 200).trim() + "…";
  }

  return preview;
}

export function formatTimeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "Updated just now";
  if (diff < 3600) return `Updated ${Math.floor(diff / 60)} min ago`;
  const hrs = Math.floor(diff / 3600);
  return `Updated ${hrs} hour${hrs === 1 ? "" : "s"} ago`;
}