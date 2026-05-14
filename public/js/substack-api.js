// /js/substack-api.js
// ============================================================
// 828 WEATHER — FRONTEND API WRAPPER
// Fetches from your serverless proxy (no CORS issues)
// ============================================================

export async function fetchSubstackLatestArticle() {
  try {
    const res = await fetch("/api/router?route=substack-articles");
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error("Substack API error:", err);
    return null;
  }
}
