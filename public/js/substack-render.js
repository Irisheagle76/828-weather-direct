// substack-render.js
import { fetchSubstackLatestArticle } from "./substack-api.js";

export async function renderSubstackArticle() {
  const container = document.getElementById("weather-articles-module");
  if (!container) return;

  container.innerHTML = `
    <div class="module-header">From 828 Weather Update</div>
    <div class="substack-loading">Loading…</div>
  `;

  try {
    const article = await fetchSubstackLatestArticle();
    if (!article) {
      container.innerHTML = `
        <div class="module-header">From 828 Weather Update</div>
        <div class="substack-empty">No recent articles found.</div>
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

    // Extract clean text
    const cleanText = (description || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Limit to ~120 characters
    let subheadline = cleanText;
    if (subheadline.length > 120) {
      subheadline = subheadline.substring(0, 120).trim() + "...";
    }

    // Determine if article is NEW (published within last 24 hours)
    let isNew = false;
    if (pubDate) {
      const published = new Date(pubDate).getTime();
      const now = Date.now();
      const hours = (now - published) / (1000 * 60 * 60);
      isNew = hours <= 24;
    }

    // Render module
    container.innerHTML = `
      <div class="module-header">From 828 Weather Update</div>

      <div class="substack-article">

        <div class="substack-thumb-wrapper">
          <img src="${ogImage}" class="substack-thumb" alt="Article thumbnail">
          <div class="substack-thumb-gradient"></div>
        </div>

        <a href="${link}" target="_blank" rel="noopener" class="substack-title">
          ${title}
        </a>

        ${isNew ? `<span class="substack-new-badge">NEW</span>` : ""}

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

renderSubstackArticle();
