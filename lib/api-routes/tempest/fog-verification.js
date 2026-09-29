import { timingSafeEqual } from 'node:crypto';
import { hasAdminSession } from '../../adminAuth.js';
import fogHandler from './fog.js';
import { createFogStore } from '../../fog/store.js';
import { makePrediction, validateLabel, verificationReport } from '../../fog/verification.js';

function isSampler(req) {
  const secret = process.env.CRON_SECRET;
  const actual = req.headers?.authorization || '';
  const expected = secret ? `Bearer ${secret}` : '';
  const actualBytes = Buffer.from(actual), expectedBytes = Buffer.from(expected);
  return !!secret && actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
async function currentFog() {
  let payload;
  await fogHandler({ method: 'GET' }, { setHeader() {}, status() { return this; }, json(value) { payload = value; } });
  return payload;
}
export function createVerificationHandler({ store = createFogStore(), clock = Date.now,
  admin = hasAdminSession, sampler = isSampler, loadFog = currentFog } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const action = req.query?.action || 'review';
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
    const authorized = action === 'sample' ? admin(req) || sampler(req) : admin(req);
    if (!authorized) return res.status(401).json({ error: 'Admin login required' });
    try {
      if (action === 'sample' && req.method === 'POST') {
        const payload = await loadFog();
        const issuedAt = clock();
        const predictions = (payload?.stations || []).map(s => makePrediction(s, issuedAt)).filter(Boolean);
        const saved = await Promise.all(predictions.map(p => store.savePrediction(p)));
        return res.status(saved.length ? 200 : 503).json({ ok: saved.length > 0, saved: saved.length,
          predictions: saved.map(p => ({ stationId: p.stationId, issuedAt: p.issuedAt, targetAt: p.targetAt })) });
      }
      if (action !== 'review') return res.status(400).json({ error: 'Invalid action or method' });
      if (req.method === 'POST') {
        let label;
        try { label = validateLabel(req.body, clock()); }
        catch (error) { return res.status(400).json({ error: error.message }); }
        const saved = await store.saveLabel(label);
        return res.status(200).json({ ok: true, label: saved });
      }
      const data = await store.load(clock());
      return res.status(200).json({ generatedAt: clock(), horizonMinutes: 60, toleranceMinutes: 10,
        reports: verificationReport(data.predictions, data.labels),
        labels: data.labels.sort((a, b) => b.observedAt - a.observedAt).slice(0, 100),
        recent: data.recent.sort((a, b) => b.issuedAt - a.issuedAt).slice(0, 100) });
    } catch {
      return res.status(503).json({ error: 'Unable to confirm this request: verification storage or station data unavailable. A write may have completed; reload the records before retrying.' });
    }
  };
}
export default createVerificationHandler();
