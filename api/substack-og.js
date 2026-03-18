// Build absolute URL safely for both localhost and Vercel
const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:3000`;

let ogImage = "/images/828-brand-card.png";
let fallback = true;

try {
  const ogRes = await fetch(
    `${baseUrl}/api/substack-og?url=${encodeURIComponent(articleUrl)}`
  );

  const ogJson = await ogRes.json();

  if (ogJson && ogJson.ogImage) {
    ogImage = ogJson.ogImage;
    fallback = ogJson.fallback ?? false;
  }
} catch (err) {
  console.error("OG fetcher failed inside articles API:", err);
}
