// substack-render.js
// Renders ONLY the latest Substack Article (Notes removed)

import { fetchSubstackLatestArticle } from "./substack-api.js";

export async function renderSubstackArticle() {
  const container = document.getElementById("weather-articles-module");
  if (!container) return;

  container.innerHTML = `
    <div class="module-header">Latest Weather Article</div>
    <div class="substack-loading">Loading article…</div>
  `;

  try {
    const article = await fetchSubstackLatestArticle();

    if (!article) {
      container.innerHTML = `
        <div class="module-header">Latest Weather Article</div>
        <div class="substack-empty">No recent articles found.</div>
      `;
      return;
    }

    const { title, link, pubDate, description } = article;

    const formattedDate = pubDate
      ? new Date(pubDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "";

    container.innerHTML = `
      <div class="module-header">Latest Weather Article</div>
      <div class="substack-article">
        <a href="${link}" target="_blank" rel="noopener" class="substack-title">
          ${title}
        </a>
        <div class="substack-date">${formattedDate}</div>
        <div class="substack-description">
          ${description || ""}
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Error rendering Substack Article:", err);
    container.innerHTML = `
      <div class="module-header">Latest Weather Article</div>
      <div class="substack-error">Unable to load article.</div>
    `;
  }
}

// ⭐ Run immediately — NOT on DOMContentLoaded
renderSubstackArticle();
