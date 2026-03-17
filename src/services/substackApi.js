const NOTES_ENDPOINT = '/api/substack-notes';
const ARTICLES_ENDPOINT = '/api/substack-articles';

export async function fetchSubstackNotes() {
  const res = await fetch(NOTES_ENDPOINT);
  if (!res.ok) throw new Error('Failed to load Substack Notes');
  const data = await res.json();
  return data.notes || [];
}

export async function fetchSubstackLatestArticle() {
  const res = await fetch(ARTICLES_ENDPOINT);
  if (!res.ok) throw new Error('Failed to load Substack Articles');
  const data = await res.json();
  return data.article || null;
}
