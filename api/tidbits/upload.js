export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  // TODO: wire to real storage (S3, R2, etc.)
  // For now, just return a placeholder so the flow works alright.
  return res.status(200).json({ url: '/images/pulse/placeholder.jpg' });
}
