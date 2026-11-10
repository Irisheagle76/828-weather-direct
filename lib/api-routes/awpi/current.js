import { getAssessment } from '../../awpi/service.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  try { const result = await getAssessment(); return res.status(result.status === 'unavailable' ? 503 : 200).json(result); }
  catch { return res.status(503).json({ status: 'unavailable', error: 'AWPI is temporarily unavailable.' }); }
}
