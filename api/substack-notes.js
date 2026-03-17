export default async function handler(req, res) {
  const FEED_URL = "https://openrss.org/substack.com/@timothyballisty";

  try {
    const response = await fetch(FEED_URL);

    if (!response.ok) {
      console.error("OpenRSS status:", response.status, response.statusText);
      throw new Error("OpenRSS Notes RSS error");
    }

    const xml = await response.text();

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
    console.error("Error fetching Notes via OpenRSS:", err);
    res.status(500).json({
      success: false,
      error: "Failed to fetch Notes.",
    });
  }
}
