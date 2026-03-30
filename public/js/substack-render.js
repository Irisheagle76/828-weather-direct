// /js/substack-render.js
// ============================================================
// 828 WEATHER — SUBSTACK ARTICLE RENDERER (2026 Edition)
// Matches substack.css exactly and works with the normalized API
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
  const container = document.getElementById("weather-articles-module");
  if (!container) return;

  // Initial loading state
  container.innerHTML = `
    <div class="module-header">From 828 Weather Update</div>
    <div class="substack-loading">Loading…</div>
  `;

  try {
    const article = await fetchSubstackLatestArticle();

    // ------------------------------------------------------------
    // NO ARTICLE FOUND
    // ------------------------------------------------------------
    if (!article) {
      container.innerHTML = `
        <div class="module-header">From 828 Weather Update</div>
        <div class="substack-empty">No recent articles found.</div>
      `;
      return;
    }

    const { title, link, pubDate, description, ogImage } = article;

    // ------------------------------------------------------------
    // DATE FORMATTING
    // ------------------------------------------------------------
    const formattedDate = pubDate
      ? new Date(pubDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "";

    // ------------------------------------------------------------
    // CLEAN EXCERPT
    // ------------------------------------------------------------
    const cleanText = extractCleanText(description);
    let subheadline = cleanText.length > 140
      ? cleanText.substring(0, 140).trim() + "…"
      : cleanText;

    // ------------------------------------------------------------
    // NEW BADGE (published within 24 hours)
    // ------------------------------------------------------------
    let isNew = false;
    if (pubDate) {
      const published = new Date(pubDate).getTime();
      const hours = (Date.now() - published) / (1000 * 60 * 60);
      isNew = hours <= 24;
    }

    // ------------------------------------------------------------
    // FALLBACK IMAGE
    // ------------------------------------------------------------
    const thumb = ogImage || "/828-brand-card.png";

    // ------------------------------------------------------------
    // FINAL RENDER
    // ------------------------------------------------------------
    container.innerHTML = `
      <div class="module-header">From 828 Weather Update</div>

      <div class="substack-article">

        <div class="substack-thumb-wrapper">
          <img src="${thumb}" class="substack-thumb" alt="Article thumbnail">
          <div class="substack-thumb-gradient"></div>
        </div>

        <div class="substack-title-row">
          <a href="${link}" target="_blank" rel="noopener" class="substack-title">
            ${title}
          </a>
          ${isNew ? `<span class="substack-new-badge">NEW</span>` : ""}
        </div>

        <div class="substack-date">${formattedDate}</div>

        <div class="substack-subheadline">
          ${subheadline}
        </div>

        <div class="substack-footer-link">
          <a href="${link}" target="_blank" rel="noopener">Read full article →</a>
        </div>

      </div>
    `;

  } catch (err) {
    console.error("Error rendering Substack Article:", err);

    container.innerHTML = `
      <div class="module-header">From 828 Weather Update</div>
      <div class="substack-error">Unable to load article.</div>
    `;
  }
}

// Auto-run
renderSubstackArticle();
