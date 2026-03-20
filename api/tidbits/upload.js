import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  try {
    // Parse multipart/form-data
    const form = await req.formData();
    const file = form.get("file");

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Create a unique filename
    const filename = `pulse-${Date.now()}.jpg`;

    // Upload directly to Vercel Blob
    const { url } = await put(filename, file, {
      access: "public",
    });

    return res.status(200).json({ url });

  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
