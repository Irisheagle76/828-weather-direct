import { fetchSubstackNotes, fetchSubstackLatestArticle } from "./substack-api.js";

// --- UTILITIES ----------------------------------------------------

function formatTimeAgo(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (minutes >= 1) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  return "Just now";
}

function sanitizeHtmlSnippet(html) {
  if (!html) return "";
  let cleaned = html.replace(
    /<(script|style)[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  cleaned = cleaned.replace(
    /<(?!\/?(b|strong|i|em|br|p)\b)[^>]*>/gi,
    ""
  );
  return cleaned.trim();
}

// --- RENDER NOTES ----------------------------------------------------

export async function renderWeatherNotes() {
  const container = document.getElementById("weather-notes-module");
  if (!container) return;

  container.innerHTML = `<div class="module-title">Loading notes…</div>`;

  try {
    const notes = await fetchSubstackNotes();

    if (!notes.length) {
      container.innerHTML = `<div class="module-title">Weather Notes</div><p>No recent notes.</p>`;
      return;
    }

    container.innerHTML = `
      <h2 class="module-title">Weather Notes</h2>
      <ul class="substack-notes-list">
        ${notes
          .map((note) => {
            const snippet = sanitizeHtmlSnippet(note.description).slice(0, 220);
            const ellipsis = snippet.length === 220 ? "…" : "";
            return `
              <li class="substack-note-item">
                <div class="substack-note-meta">
                  <span class="substack-note-time">${formatTimeAgo(
                    note.pubDate
                  )}</span>
                </div>
                <div class="substack-note-snippet">${snippet}${ellipsis}</div>
                <a href="${note.link}" target="_blank" class="substack-note-link">
                  Read on Substack →
                </a>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  } catch (err) {
    container.innerHTML = `<p>Error loading notes.</p>`;
  }
}

// --- RENDER ARTICLES ----------------------------------------------------

export async function renderWeatherArticles() {
  const container = document.getElementById("weather-articles-module");
  if (!container) return;

  container.innerHTML = `<div class="module-title">Loading article…</div>`;

  try {
    const article = await fetchSubstackLatestArticle();

    if (!article) {
      container.innerHTML = `<h2 class="module-title">Weather Articles</h2><p>No recent articles.</p>`;
      return;
    }

    const snippet = sanitizeHtmlSnippet(article.description).slice(0, 500);
    const ellipsis = snippet.length === 500 ? "…" : "";

    container.innerHTML = `
      <h2 class="module-title">Weather Articles</h2>
      <header class="substack-article-header">
        <h3 class="substack-article-title">${article.title}</h3>
        <span class="substack-article-time">${formatTimeAgo(
          article.pubDate
        )}</span>
      </header>
      <div class="substack-article-snippet">${snippet}${ellipsis}</div>
      <a href="${article.link}" target="_blank" class="substack-article-link">
        Read full article →
      </a>
    `;
  } catch (err) {
    container.innerHTML = `<p>Error loading article.</p>`;
  }
}

// --- AUTO-RUN ----------------------------------------------------

renderWeatherNotes();
renderWeatherArticles();
