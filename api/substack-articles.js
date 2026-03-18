import Parser from "rss-parser";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  },
});

export default async function handler(req, res) {
  try {
    const feed = await parser.parseURL(
      "https://timothyballisty.substack.com/feed"
    );

    if (!feed || !feed.items || feed.items.length === 0) {
      return res.status(200).json({
        title: "No articles available",
        link: null,
        pubDate: null,
        description: null,
        ogImage: "/images/828-brand-card.png",
        fallback: true,
      });
    }

    const latest = feed.items[0];

    const articleUrl = latest.link;
    const description =
      latest["content:encodedSnippet"] ||
      latest.contentSnippet ||
      latest.content ||
      "";

    // --- Fetch OG image from your serverless OG fetcher ---
    let ogImage = "/images/828-brand-card.png";
    let fallback = true;

    try {
      const ogRes = await fetch(
        `${req.headers.host.startsWith("localhost") ? "http" : "https"}://${
          req.headers.host
        }/api/substack-og?url=${encodeURIComponent(articleUrl)}`
      );

      const ogJson = await ogRes.json();

      if (ogJson && ogJson.ogImage) {
        ogImage = ogJson.ogImage;
        fallback = ogJson.fallback ?? false;
      }
    } catch (err) {
      console.error("OG fetcher failed inside articles API:", err);
    }

    return res.status(200).json({
      title: latest.title || "Untitled",
      link: articleUrl,
      pubDate: latest.pubDate || null,
      description,
      ogImage,
      fallback,
    });
  } catch (err) {
    console.error("Substack Articles API error:", err);

    return res.status(200).json({
      title: "Error loading article",
      link: null,
      pubDate: null,
      description: null,
      ogImage: "/images/828-brand-card.png",
      fallback: true,
      error: "Articles API failed, using fallback",
    });
  }
}
