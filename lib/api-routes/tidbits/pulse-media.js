import { requireAdminSession } from "../../adminAuth.js";

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "dz45rrije";
const PULSE_FOLDER = "828-weather-pulse";

function getCloudinaryCredentials() {
  if (process.env.CLOUDINARY_URL) {
    try {
      const url = new URL(process.env.CLOUDINARY_URL);
      return {
        apiKey: url.username,
        apiSecret: url.password,
        cloudName: url.hostname || CLOUD_NAME
      };
    } catch (err) {
      console.error("Invalid CLOUDINARY_URL:", err);
    }
  }

  return {
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    cloudName: CLOUD_NAME
  };
}

function basicAuth(apiKey, apiSecret) {
  return Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
}

function withUploadTransform(url, resourceType, transform) {
  if (!url) return "";
  const marker = `/${resourceType}/upload/`;
  return url.includes(marker) ? url.replace(marker, `${marker}${transform}/`) : url;
}

function toPickerAsset(resource) {
  const resourceType = resource.resource_type === "video" ? "video" : "image";
  const mediaUrl = resource.secure_url;
  const thumbTransform = resourceType === "video"
    ? "so_0,c_fill,w_320,h_180,q_auto,f_jpg"
    : "c_fill,w_320,h_180,q_auto,f_auto";

  return {
    id: resource.asset_id || resource.public_id,
    publicId: resource.public_id,
    mediaUrl,
    mediaType: resourceType,
    thumbnailUrl: withUploadTransform(mediaUrl, resourceType, thumbTransform),
    createdAt: resource.created_at,
    bytes: resource.bytes || 0,
    format: resource.format || ""
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  const { apiKey, apiSecret, cloudName } = getCloudinaryCredentials();

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: "Cloudinary credentials are not configured"
    });
  }

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/resources/search`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth(apiKey, apiSecret)}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        expression: `folder="${PULSE_FOLDER}"`,
        max_results: 30,
        sort_by: [{ created_at: "desc" }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Cloudinary search error:", data);
      return res.status(response.status).json({
        error: "Unable to load Cloudinary media"
      });
    }

    const assets = (data.resources || [])
      .filter((resource) => resource.resource_type === "image" || resource.resource_type === "video")
      .map(toPickerAsset);

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ assets });
  } catch (err) {
    console.error("Pulse media search error:", err);
    return res.status(500).json({ error: "Unable to load Cloudinary media" });
  }
}
