// ============================================================
// SUBSTACK (UPDATE) — V2 RENDER
// ============================================================

export function renderSubstackV2(container, post) {
  if (!container) return;

  // ------------------------------------------------------------
  // EMPTY STATE
  // ------------------------------------------------------------
  if (!post) {
    container.innerHTML = `
      <div class="content-card update-card">
        <div class="section-title">UPDATE</div>
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
    extractImage(rawHtml);

  const isNew = isRecent(date);

  // ------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------
  container.innerHTML = `
    <div class="content-card update-card">

      <div class="section-title">
        UPDATE ${isNew ? `<span class="update-new">NEW</span>` : ""}
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

      <a href="${link}" target="_blank" class="update-cta">
        Read full update →
      </a>

    </div>
  `;
}

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

// excerpt builder
function buildExcerpt(text) {
  if (!text) return "";

  const max = 180;

  if (text.length <= max) return text;

  return text.slice(0, max).trim() + "…";
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