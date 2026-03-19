export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(200).json({
        ogImage: "/images/828-brand-card.png",
        fallback: true,
      });
    }

    const html = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    }).then(r => r.text());

    const match = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );

    if (match && match[1]) {
      return res.status(200).json({
        ogImage: match[1],
        fallback: false,
      });
    }

    return res.status(200).json({
      ogImage: "/images/828-brand-card.png",
      fallback: true,
    });

  } catch (err) {
    console.error("OG fetcher error:", err);

    return res.status(200).json({
      ogImage: "/images/828-brand-card.png",
      fallback: true,
    });
  }
}
