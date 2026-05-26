import crypto from "node:crypto";
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

function signUpload(params, apiSecret) {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${payload}${apiSecret}`)
    .digest("hex");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!requireAdminSession(req, res)) return;

  const { apiKey, apiSecret, cloudName } = getCloudinaryCredentials();

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: "Cloudinary credentials are not configured"
    });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    folder: PULSE_FOLDER,
    timestamp
  };

  return res.status(200).json({
    apiKey,
    cloudName,
    folder: PULSE_FOLDER,
    timestamp,
    signature: signUpload(params, apiSecret)
  });
}
