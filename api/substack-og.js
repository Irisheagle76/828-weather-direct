export default async function handler(req, res) {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({ ogImage: null, error: "Missing ?url=" });
    }

    // Fetch the article HTML
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        Accept: "text/html",
      },
    });

    const html = await response.text();

    // Extract OG image
    const match = html.match(
      /<meta property="og:image" content="([^"]+)"\/?>/i
    );

    const ogImage = match ? match[1] : null;

    // If Substack has no OG image → return your fallback
    if (!ogImage) {
      return res.status(200).json({
        ogImage: "/images/828-brand-card.png",
        fallback: true,
      });
    }

    return res.status(200).json({ ogImage, fallback: false });
  } catch (err) {
    console.error("OG fetch error:", err);

    // On ANY error → return fallback instead of crashing
    return res.status(200).json({
      ogImage: "/images/828-brand-card.png",
      fallback: true,
      error: "OG fetch failed, using fallback",
    });
  }
}
