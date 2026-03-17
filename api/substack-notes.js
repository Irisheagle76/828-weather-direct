export default async function handler(req, res) {
  const FEED_URL = "https://timothyballisty.substack.com/feed/notes";

  try {
    const response = await fetch(FEED_URL, {
     const response = await fetch(FEED_URL, {
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1"
  }
});

    if (!response.ok) throw new Error("Substack Notes RSS error");

    const xml = await response.text();
// ⭐ Add this temporary log:

    if (!xml || !xml.includes("<item>")) {
      console.error("Unexpected Substack response:", xml.slice(0, 200));
      throw new Error("Invalid RSS feed");
    }

    const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map(
      (match) => {
        const itemXml = match[1];

        const getTag = (tag) => {
          const m = itemXml.match(
            new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`)
          );
          return m ? m[1].trim() : "";
        };

        return {
          title: getTag("title"),
          link: getTag("link"),
          pubDate: getTag("pubDate"),
          description: getTag("description"),
        };
      }
    );

    res.status(200).json({
      success: true,
      notes: items.slice(0, 3),
    });

  } catch (err) {
    console.error("Error fetching Substack Notes:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Substack Notes.",
    });
  }
}
