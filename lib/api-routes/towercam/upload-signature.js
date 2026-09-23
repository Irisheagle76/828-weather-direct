import crypto from "node:crypto";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dz45rrije";
const PUBLIC_ID = "avlweather_towercam_latest";

function getHeader(req, name) {
  if (typeof req?.headers?.get === "function") return req.headers.get(name);
  return req?.headers?.[name] || req?.headers?.[name.toLowerCase()] || "";
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ""));
  const expectedBuffer = Buffer.from(String(expected || ""));
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function signUpload(params, apiSecret) {
  const payload = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto.createHash("sha1").update(`${payload}${apiSecret}`).digest("hex");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const expectedToken = process.env.TOWERCAM_REFRESH_TOKEN;
  const authorization = getHeader(req, "authorization");
  const suppliedToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!expectedToken || !safeEqual(suppliedToken, expectedToken)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!apiKey || !apiSecret) {
    return res.status(503).json({ error: "Cloudinary is not configured" });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    invalidate: "true",
    overwrite: "true",
    public_id: PUBLIC_ID,
    timestamp
  };

  return res.status(200).json({
    apiKey,
    cloudName: CLOUD_NAME,
    ...params,
    signature: signUpload(params, apiSecret)
  });
}
