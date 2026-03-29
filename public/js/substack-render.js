// /js/substack-render.js
// ============================================================
// MODERNIZED SUBSTACK RENDERER — MATCHES substack.css EXACTLY
// ============================================================

import { fetchSubstackLatestArticle } from "./substack-api.js";

export async function renderSubstackArticle() {
  const container = document.getElementById("weather-articles-module");
  if (!container) return;

  // Initial loading state
  container.innerHTML = `
    <div class="substack-card fade-in">
      <div class="substack-header">
        <img src="/substack-icon.png" class="substack-icon" alt="Substack icon">
        <div class="substack-title">From 828 Weather Update</div>
      </div>
      <div class="substack-meta">Loading latest article…</div>
    </div>
  `;

  try {
    const article = await fetchSubstackLatestArticle();

    if (!article) {
      container.innerHTML = `
        <div class="substack-empty fade-in">
          No recent articles found.
        </div>
      `;
      return;
    }

    const { title, link, pubDate, description, ogImage } = article;

    // Format date
    const formattedDate = pubDate
      ? new Date(pubDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "";

    // Clean description → plain text
    const cleanText = (description || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Shorten to ~140 chars
    const shortDesc =
      cleanText.length > 140
        ? cleanText.substring(0, 140).trim() + "…"
        : cleanText;

    // Render final card
    container.innerHTML = `
      <div class="substack-card fade-in">

        <!-- Header -->
        <div class="substack-header">
          <img src="/substack-icon.png" class="substack-icon" alt="Substack icon">
          <div class="substack-title">${title}</div>
        </div>

        <!-- Thumbnail -->
        <div class="substack-thumb">
          <img src="${ogImage}" alt="Article thumbnail">
        </div>

        <!-- Metadata -->
        <div class="substack-meta">${formattedDate}</div>

        <!-- Description -->
        <div class="substack-description">
          ${shortDesc}
        </div>

        <!-- Read More -->
        <div class="substack-readmore">
          <a href="${link}" target="_blank" rel="noopener">Read full article →</a>
        </div>

      </div>
    `;
  } catch (err) {
    console.error("Error rendering Substack Article:", err);

    container.innerHTML = `
      <div class="substack-error fade-in">
        Unable to load article.
      </div>
    `;
  }
}

renderSubstackArticle();