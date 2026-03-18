export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  try {
    const { html, imageUrl } = req.body || {};
    if (!html) {
      return res.status(400).json({ error: 'Missing html' });
    }

    const now = new Date().toISOString();
    const newEntry = {
      id: now,
      createdAt: now,
      html,
      imageUrl: imageUrl || '',
    };

    // TODO: read existing tidbits.json from GitHub, prepend newEntry, write back.
    // For now, just log and pretend success so you can feel the flow.
    console.log('New Pulse entry:', newEntry);

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
