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

    const formattedDate = pubDate
      ? new Date(pubDate).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        })
      : "";

    // Extract first sentence as subheadline
    const cleanText = (description || "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const subheadline = cleanText
      ? cleanText.split(".")[0] + "."
      : "A fresh weather update from the 828.";

    container.innerHTML = `
      <div class="module-header">From 828 Weather Update</div>

      <div class="substack-article">

        ${ogImage ? `
          <img src="${ogImage}" class="substack-thumb" alt="Article thumbnail">
        ` : ""}

        <a href="${link}" target="_blank" rel="noopener" class="substack-title">
          ${title}
        </a>

        <div class="substack-date">${formattedDate}</div>

        <div class="substack-subheadline">
          ${subheadline}
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
