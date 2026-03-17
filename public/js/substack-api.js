
export async function fetchSubstackLatestArticle() {
  const res = await fetch("/api/substack-articles");
  if (!res.ok) throw new Error("Failed to load Substack Articles");
  const data = await res.json();
  return data.article || null;
}
