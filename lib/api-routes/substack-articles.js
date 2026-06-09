import Parser from "rss-parser";

const parser = new Parser({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  },
});

export default async function handler(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store, max-age=0");

    const feedUrl = `https://timothyballisty.substack.com/feed?t=${Date.now()}`;
    const feedResponse = await fetch(feedUrl, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!feedResponse.ok) {
      throw new Error(`Substack feed returned ${feedResponse.status}`);
    }

    const feedXml = await feedResponse.text();
    const feed = await parser.parseString(feedXml);

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

    // ---------------------------------------------------------
    // SAFE BASE URL BUILDER
    // ---------------------------------------------------------
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : req.headers.host
        ? `https://${req.headers.host}`
        : "http://localhost:3000");

    // ---------------------------------------------------------
    // FETCH OG IMAGE (SAFE JSON PARSE)
    // ---------------------------------------------------------
    let ogImage = latest.enclosure?.url || "/images/828-brand-card.png";
    let fallback = !latest.enclosure?.url;

    try {
      const ogRes = await fetch(
        `${baseUrl}/api/router?route=substack-og&url=${encodeURIComponent(articleUrl)}`
      );

      const raw = await ogRes.text();
      let ogJson = null;

      try {
        ogJson = JSON.parse(raw);
      } catch (err) {
        console.warn("OG fetcher returned non‑JSON:", raw.slice(0, 200));
      }

      if (ogJson && ogJson.ogImage && !ogJson.fallback) {
        ogImage = ogJson.ogImage;
        fallback = ogJson.fallback ?? false;
      }
    } catch (err) {
      console.error("OG fetcher failed inside articles API:", err);
    }

    // ---------------------------------------------------------

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
