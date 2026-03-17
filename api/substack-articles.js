// Serverless function: /api/substack-articles
// Fetches latest Substack Articles and returns only the single latest one

export default async function handler(req, res) {
  const FEED_URL = 'https://timothyballisty.substack.com/feed';

  try {
    const response = await fetch(FEED_URL);
    if (!response.ok) {
      throw new Error(`Substack Articles RSS error: ${response.status}`);
    }

    const xml = await response.text();

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

    const latest = items[0] || null;

    res.status(200).json({
      success: true,
      article: latest,
    });
  } catch (error) {
    console.error('Error fetching Substack Articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Substack Articles.',
    });
  }
}
