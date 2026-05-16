// ============================================================
// SUBSTACK (UPDATE) - V3 PULSE-MATCHED
// ============================================================

export function renderSubstackV2(container, post) {
  if (!container) return;

  if (!post) {
    container.innerHTML = `
      <div class="content-card update-card">
        <div class="section-title">828 Weather Update</div>
        <div class="update-empty">No recent updates</div>
      </div>
    `;
    return;
  }

  const title = post.title || "Weather Update";
  const articleUrl = post.link || post.url || "";

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

  container.innerHTML = `
    <div class="content-card update-card">

      <div class="section-title update-title-row">
        <span class="update-heading">
          <span class="update-title-text">828 Weather Update</span>
          <span class="update-tagline">Deep dives. Weather insight. 828.</span>
        </span>

        <span class="update-brand">
          <img
            src="https://res.cloudinary.com/dz45rrije/image/upload/v1776884962/substack_avlweather.png"
            class="substack-icon"
            alt="Substack"
          />
        </span>

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

      <div class="update-body">
        <div class="update-excerpt">
          ${excerpt}
        </div>
        <div class="update-fade"></div>
      </div>

      ${articleUrl ? `
      <a class="update-toggle" href="${escapeAttr(articleUrl)}" target="_blank" rel="noopener noreferrer">
        Read full update
      </a>
      ` : ""}

    </div>
  `;
}

function cleanText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildExcerpt(text) {
  if (!text) return "";

  const cleaned = text
    .replace(/^Quick Highlights\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [];
  const teaser = sentences.length
    ? sentences.slice(0, 2).join(" ")
    : cleaned;

  return teaser.length > 275
    ? `${teaser.slice(0, 272).trim()}...`
    : teaser;
}

function extractImage(html) {
  if (!html) return null;

  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}

function escapeAttr(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatDate(dateStr) {
  if (!dateStr) return "";

  const d = new Date(dateStr);

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric"
  });
}

function isRecent(dateStr) {
  if (!dateStr) return false;

  const d = new Date(dateStr);
  const diff = (Date.now() - d.getTime()) / 1000;

  return diff < 86400;
}
