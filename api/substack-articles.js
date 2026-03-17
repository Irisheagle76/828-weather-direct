export default async function handler(req, res) {
  const FEED_URL = "https://timothyballisty.substack.com/feed";

  try {
    const response = await fetch(FEED_URL);
    if (!response.ok) throw new Error("Substack RSS error");

    const xml = await response.text();

    // Extract first <item>
    const match = xml.match(/<item>([\s\\S]*?)<\\/item>/);
    if (!match) {
      return res.status(200).json({ success: true, article: null });
    }

    const itemXml = match[1];

    // Helper that extracts CDATA OR plain text
    const getTag = (tag) => {
      // CDATA version
      const cdata = itemXml.match(
        new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`)
      );
      if (cdata) return cdata[1].trim();

      // Plain version
      const plain = itemXml.match(
        new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
      );
      return plain ? plain[1].trim() : "";
    };

    // Substack sometimes uses <content:encoded>
    const description =
      getTag("description") || getTag("content:encoded") || "";

    const article = {
      title: getTag("title"),
      link: getTag("link"),
      pubDate: getTag("pubDate"),
      description
    };

    // ------------------------------------------------------------
    // ⭐ Fetch OG image (with safe base URL)
    // ------------------------------------------------------------
    let ogImage = null;

    try {
      const baseUrl =
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000";

      const ogRes = await fetch(
        `${baseUrl}/api/substack-og?url=${encodeURIComponent(article.link)}`
      );

      const ogData = await ogRes.json();
      ogImage = ogData.ogImage || null;
    } catch (err) {
      console.error("OG image fetch failed:", err);
    }

    article.ogImage = ogImage;

    res.status(200).json({ success: true, article });

  } catch (err) {
    console.error("Error fetching Substack Articles:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Substack Articles."
    });
  }
}
