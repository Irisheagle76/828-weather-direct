import { getAssessment } from '../../awpi/service.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.CRON_SECRET || req.headers?.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Unauthorized' });
  const value = await getAssessment({ refresh: true });
  return res.status(value.status === 'unavailable' || value.refreshError || value.persistence !== 'durable' ? 503 : 200).json(value);
}
