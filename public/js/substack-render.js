// /js/substack-render.js
// ============================================================
// 828 WEATHER — SUBSTACK ARTICLE RENDERER (CLEAN + FIXED)
// Fully aligned with substack.css
// ============================================================

import { fetchSubstackLatestArticle } from "./substack-api.js";

// ------------------------------------------------------------
// CLEAN TEXT EXTRACTOR
// ------------------------------------------------------------
function extractCleanText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------
// MAIN RENDERER
// ------------------------------------------------------------
export async function renderSubstackArticle() {
  const container = document.getElementById("substack-content");
  if (!container) return;

  // ------------------------------------------------------------
  // LOADING STATE
  // ------------------------------------------------------------
 container.innerHTML = `
  <div class="substack-card">
    <div class="substack-header-label">From 828 Weather Update</div>
    <div class="substack-loading">Loading…</div>
  </div>
`;

  try {
    const article = await fetchSubstackLatestArticle();

    // ------------------------------------------------------------
    // NO ARTICLE
    // ------------------------------------------------------------
    if (!article) {
      container.innerHTML = `
        <div class="substack-header-label">From 828 Weather Update</div>
        <div class="substack-empty">No recent articles found.</div>
      `;
      return;
    }

    const { title, link, pubDate, description, ogImage } = article;

    // ------------------------------------------------------------
    // DATE
    // ------------------------------------------------------------
    const formattedDate = pubDate
      ? new Date(pubDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "";

    // ------------------------------------------------------------
    // EXCERPT
    // ------------------------------------------------------------
    const cleanText = extractCleanText(description);

    const excerpt = cleanText.length > 140
      ? cleanText.substring(0, 140).trim() + "…"
      : cleanText;

    // ------------------------------------------------------------
    // NEW BADGE
    // ------------------------------------------------------------
    let isNew = false;
    if (pubDate) {
      const published = new Date(pubDate).getTime();
      const hours = (Date.now() - published) / (1000 * 60 * 60);
      isNew = hours <= 24;
    }

    // ------------------------------------------------------------
    // IMAGE
    // ------------------------------------------------------------
    const thumb = ogImage || "/828-brand-card.png";

    // ------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------
 container.innerHTML = `
  <div class="substack-card">

    <div class="substack-header-label">From 828 Weather Update</div>

    <div class="substack-article">

      <div class="substack-thumb-wrapper">
        <img src="${thumb}" class="substack-thumb" alt="Article thumbnail">
      </div>

      <div class="substack-title-row">
        <a href="${link}" target="_blank" rel="noopener" class="substack-title">
          ${title}
        </a>
        ${isNew ? `<span class="substack-new-badge">NEW</span>` : ""}
      </div>

      <div class="substack-date">${formattedDate}</div>

      <div class="substack-excerpt">
        ${excerpt}
      </div>

      <a href="${link}" target="_blank" rel="noopener" class="substack-readmore">
        Read full article →
      </a>

    </div>

  </div>
`;

  } catch (err) {
    console.error("Error rendering Substack Article:", err);

    container.innerHTML = `
      <div class="substack-header-label">From 828 Weather Update</div>
      <div class="substack-error">Unable to load article.</div>
    `;
  }
}

// ------------------------------------------------------------
// AUTO RUN
// ------------------------------------------------------------
renderSubstackArticle();