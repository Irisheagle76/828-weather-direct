const DEFAULT_SUBSTACK_IMAGE = "/images/828-weather-update-default.png";

export default async function handler(req, res) {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(200).json({
        ogImage: DEFAULT_SUBSTACK_IMAGE,
        fallback: true,
      });
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      },
    });

    const status = response.status;
    const html = await response.text();

    if (status !== 200) {
      console.warn("OG fetcher: non-200 status", status, targetUrl);
    }

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
      ogImage: DEFAULT_SUBSTACK_IMAGE,
      fallback: true,
    });

  } catch (err) {
    console.error("OG fetcher error:", err);

    return res.status(200).json({
      ogImage: DEFAULT_SUBSTACK_IMAGE,
      fallback: true,
    });
  }
}
