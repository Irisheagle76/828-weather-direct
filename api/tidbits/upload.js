import { put } from "@vercel/blob";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filename = `pulse-${Date.now()}.jpg`;

    const { url } = await put(filename, file, {
      access: "public",
    });

    return res.status(200).json({ url });

  } catch (err) {
    console.error("Upload error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
}
