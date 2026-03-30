// /js/substack-api.js
// ============================================================
// 828 WEATHER — SUBSTACK API NORMALIZER
// Ensures consistent fields regardless of feed source
// ============================================================

// Your Substack feed URL (RSS or JSON proxy)
const FEED_URL = "https://timothyballisty.substack.com/feed";

// ------------------------------------------------------------
// FETCH + PARSE FEED
// ------------------------------------------------------------
export async function fetchSubstackLatestArticle() {
  try {
    const res = await fetch(FEED_URL);
    const text = await res.text();

    // Try JSON first (OpenRSS or custom proxy)
    if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
      return parseJsonFeed(JSON.parse(text));
    }

    // Otherwise parse RSS/XML
    return parseRssFeed(text);

  } catch (err) {
    console.error("Substack API error:", err);
    return null;
  }
}

// ------------------------------------------------------------
// JSON FEED PARSER (OpenRSS, custom proxies, etc.)
// ------------------------------------------------------------
function parseJsonFeed(json) {
  const item =
    json.items?.[0] ||
    json[0] ||
    json.posts?.[0] ||
    null;

  if (!item) return null;

  return {
    title: item.title || "",
    link: item.url || item.link || "",
    pubDate: item.published_at || item.pubDate || item.date || null,
    description: item.content_html || item.content || item.summary || "",
    ogImage:
      item.image ||
      item.thumbnail ||
      extractImageFromHtml(item.content_html || item.content || "") ||
      null
  };
}

// ------------------------------------------------------------
// RSS/XML PARSER (native Substack feed)
// ------------------------------------------------------------
function parseRssFeed(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  const item = doc.querySelector("item");
  if (!item) return null;

  const title = getText(item, "title");
  const link = getText(item, "link");
  const pubDate = getText(item, "pubDate");
  const description = getText(item, "description");

  const ogImage =
    extractImageFromHtml(description) ||
    extractImageFromHtml(getText(item, "content:encoded")) ||
    null;

  return {
    title,
    link,
    pubDate,
    description,
    ogImage
  };
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------
function getText(parent, tag) {
  const el = parent.getElementsByTagName(tag)[0];
  return el ? el.textContent : "";
}

function extractImageFromHtml(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src="([^">]+)"/i);
  return match ? match[1] : null;
}
