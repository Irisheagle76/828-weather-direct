// substack-api.js
// Fetches ONLY the latest Substack Article (Notes removed)

export async function fetchSubstackLatestArticle() {
  try {
    const res = await fetch("/api/substack-articles");
    if (!res.ok) throw new Error("Failed to load Substack Articles");

    const data = await res.json();
    return data.article || null;
  } catch (err) {
    console.error("Error fetching Substack Article:", err);
    return null;
  }
}
