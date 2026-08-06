const CSU_PAGE_URL = "https://schumacher.atmos.colostate.edu/weather/VIS_anim.php?region=se";
const CSU_ORIGIN = "https://schumacher.atmos.colostate.edu";

export function parseVisibleFrames(html = "") {
  const listSource = String(html).match(/var\s+imageURLs\s*=\s*\[([\s\S]*?)\]\s*;/i)?.[1] || "";

  return [...listSource.matchAll(/["']([^"']*VIS_se_[^"']+\.gif)["']/gi)]
    .map((match) => new URL(match[1], CSU_PAGE_URL).href)
    .filter((url) => {
      const parsed = new URL(url);
      return parsed.origin === CSU_ORIGIN && parsed.pathname.includes("/weather/real_time/VIS_se/");
    });
}

export default async function handler(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(CSU_PAGE_URL, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "828 Weather Direct satellite viewer"
      }
    });

    if (!response.ok) {
      throw new Error(`Colorado State animation returned ${response.status}`);
    }

    const frames = parseVisibleFrames(await response.text());
    if (!frames.length) {
      throw new Error("No Southeast visible-satellite frames were found");
    }

    res.setHeader("Cache-Control", "public, s-maxage=180, stale-while-revalidate=300");
    return res.status(200).json({
      frames,
      source: CSU_PAGE_URL,
      frameCount: frames.length,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("CSU visible satellite feed failed:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: "The Southeast visible-satellite loop is temporarily unavailable",
      source: CSU_PAGE_URL
    });
  } finally {
    clearTimeout(timeout);
  }
}
