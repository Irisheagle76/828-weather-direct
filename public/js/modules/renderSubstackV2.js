// ============================================================
// SUBSTACK (UPDATE) — V2 CLEAN
// ============================================================

export function renderSubstackV2(container, post) {
  if (!container) return;

  // ------------------------------------------------------------
  // EMPTY STATE
  // ------------------------------------------------------------
  if (!post) {
    container.innerHTML = `
      <div class="content-card update-card">
        <div class="section-title">828 Weather Update</div>
        <div class="update-empty">No recent updates</div>
      </div>
    `;
    return;
  }

  // ------------------------------------------------------------
  // NORMALIZE INPUT
  // ------------------------------------------------------------
  const title = post.title || "Weather Update";
  const link = post.link || "#";

  const rawHtml =
    post.content ||
    post.content_html ||
    post.description ||
    "";

  const clean = cleanText(rawHtml);
  const excerpt = buildExcerpt(clean);

  const date = post.pubDate || post.isoDate;
  const formattedDate = formatDate(date);

  const thumb =
    post.image ||
    extractImage(rawHtml) ||
    null;

  const isNew = isRecent(date);

// ------------------------------------------------------------
// RENDER
// ------------------------------------------------------------
container.innerHTML = `
  <div class="content-card update-card">

    <div class="section-title update-title-row">
      <span class="update-title-text">828 Weather Update</span>

      <img 
  src="https://res.cloudinary.com/dz45rrije/image/upload/v1776884962/substack_avlweather.png"
  class="substack-icon"
  alt="Substack"
/>

      ${isNew ? `<span class="update-new">NEW</span>` : ""}
    </div>

    <div class="update-title">
      ${title}
    </div>

    ${thumb ? `
      <div class="update-media">
        <img src="${thumb}" alt="Update image" />
      </div>
    ` : ""}

    <div class="update-date">
      ${formattedDate}
    </div>

    <div class="update-excerpt">
      ${excerpt}
    </div>

    <a 
      href="${link}" 
      target="_blank" 
      rel="noopener noreferrer" 
      class="update-cta"
    >
      Read full update →
    </a>

  </div>
`;

// ============================================================
// HELPERS
// ============================================================

// strip HTML
function cleanText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// smarter excerpt (less robotic cut-off)
function buildExcerpt(text) {
  if (!text) return "";

  // try to end on sentence
  const sentence = text.split(". ")[0];
  if (sentence.length > 60) return sentence + ".";

  // fallback to length cap
  const max = 180;
  return text.length <= max
    ? text
    : text.slice(0, max).trim() + "…";
}

// extract first image from HTML
function extractImage(html) {
  if (!html) return null;

  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}

// format date nicely
function formatDate(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

// detect "new" (last 24 hours)
function isRecent(dateStr) {
  if (!dateStr) return false;

  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;

  return diff < 86400;
}
}