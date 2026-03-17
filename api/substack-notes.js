// Serverless function: /api/substack-notes
// Fetches latest Substack Notes and returns a compact JSON payload

export default async function handler(req, res) {
  const FEED_URL = 'https://timothyballisty.substack.com/feed/notes';

  try {
    const response = await fetch(FEED_URL);
    if (!response.ok) {
      throw new Error(`Substack Notes RSS error: ${response.status}`);
    }

    const xml = await response.text();

    // Very lightweight XML parsing using DOMParser-like approach via regex
    // (Good enough for Substack's consistent RSS structure)
    const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(match => {
      const itemXml = match[1];

      const getTag = (tag) => {
        const m = itemXml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
        return m ? m[1].trim() : '';
      };

      const title = getTag('title');
      const link = getTag('link');
      const pubDate = getTag('pubDate');
      const description = getTag('description');

      return { title, link, pubDate, description };
    });

    // Keep only the 3 most recent Notes
    const latestNotes = items.slice(0, 3);

    res.status(200).json({
      success: true,
      notes: latestNotes,
    });
  } catch (error) {
    console.error('Error fetching Substack Notes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Substack Notes.',
    });
  }
}
