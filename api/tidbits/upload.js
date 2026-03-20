import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Required for file uploads
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Generate a unique filename
    const filename = `pulse-${Date.now()}.jpg`;

    // Upload to Vercel Blob
    const blob = await put(filename, buffer, {
      access: 'public',
    });

    // blob.url is the public URL
    return res.status(200).json({ url: blob.url });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
