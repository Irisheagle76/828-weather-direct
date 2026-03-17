export default async function handler(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: "Missing ?url=" });
    }

    const response = await fetch(url);
    const html = await response.text();

    const match = html.match(
      /<meta property="og:image" content="([^"]+)"\/?>/i
    );

    const ogImage = match ? match[1] : null;

    res.status(200).json({ ogImage });
  } catch (err) {
    console.error("OG fetch error:", err);
    res.status(500).json({ error: "Failed to fetch OG image" });
  }
}
