const NCAR_PAGE_URL = "https://weather.rap.ucar.edu/satellite/displaySat.php?region=CLT&itype=color";
const NCAR_ORIGIN = "https://weather.rap.ucar.edu";

export function parseVisibleImage(html = "") {
  const imageSources = [...String(html).matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)];

  for (const match of imageSources) {
    const imageUrl = new URL(match[1], NCAR_PAGE_URL);
    const isNcarImage = imageUrl.origin === NCAR_ORIGIN
      && /^\/data\/satellite\/\d{8}\/CLT\/color\/\d{8}_\d{6}_CLT\.jpg$/i.test(imageUrl.pathname);

    if (isNcarImage) return imageUrl.href;
  }

  return null;
}

export function getObservedAt(imageUrl = "") {
  const match = String(imageUrl).match(/\/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_CLT\.jpg$/i);
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  return new Date(Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )).toISOString();
}

export default async function handler(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(NCAR_PAGE_URL, {
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "828 Weather Direct satellite viewer"
      }
    });

    if (!response.ok) {
      throw new Error(`NCAR satellite page returned ${response.status}`);
    }

    const image = parseVisibleImage(await response.text());
    if (!image) {
      throw new Error("No North Carolina visible-satellite image was found");
    }

    res.setHeader("Cache-Control", "public, s-maxage=180, stale-while-revalidate=300");
    return res.status(200).json({
      image,
      source: NCAR_PAGE_URL,
      observedAt: getObservedAt(image),
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("NCAR visible satellite feed failed:", error);
    res.setHeader("Cache-Control", "no-store");
    return res.status(502).json({
      error: "The North Carolina visible-satellite image is temporarily unavailable",
      source: NCAR_PAGE_URL
    });
  } finally {
    clearTimeout(timeout);
  }
}
