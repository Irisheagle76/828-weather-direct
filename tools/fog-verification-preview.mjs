// Isolated synthetic review sandbox: no production credentials, storage or labels.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createVerificationHandler } from '../lib/api-routes/tempest/fog-verification.js';
import { makePrediction } from '../lib/fog/verification.js';
const now = Date.now();
const examples = ['127602', '144737'].map((stationId, i) => ({ stationId, available: true,
  observedAt: now, version: 'wnc-fog-v1', low: i ? 45 : 75, high: i ? 55 : 85,
  coverage: 90, parts: [], missing: ['Rain'], humidity: 97 }));
const predictions = examples.map(s => makePrediction({ ...s, observedAt: now - 3600000 }, now - 3600000));
const labels = [];
const store = {
  async savePrediction(p) { const old = predictions.find(x => x.id === p.id); if (old) return old; predictions.push(p); return p; },
  async saveLabel(l) { const i = labels.findIndex(x => x.id === l.id); if (i >= 0) labels[i] = l; else labels.push(l); return l; },
  async load() { return { predictions: [...predictions], labels: [...labels], recent: [...predictions] }; }
};
const handler = createVerificationHandler({ store, admin: () => true, loadFog: async () => ({ stations: examples.map(s => ({ ...s, observedAt: Date.now() })) }) });
const files = { '/': ['index.html', 'text/html'], '/admin/fog/index.html': ['index.html', 'text/html'],
  '/admin/fog/console.js': ['console.js', 'text/javascript'], '/admin/fog/style.css': ['style.css', 'text/css'] };
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/router') {
      req.query = Object.fromEntries(url.searchParams); let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 10000) throw new Error('Too large'); }
      req.body = body ? JSON.parse(body) : {};
      return await handler(req, { setHeader: (k, v) => res.setHeader(k, v), status(n) { res.statusCode = n; return this; }, json(data) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); } });
    }
    const file = files[url.pathname]; if (!file) { res.writeHead(404); return res.end(); }
    let content = await readFile(new URL(`../public/admin/fog/${file[0]}`, import.meta.url), 'utf8');
    if (file[1] === 'text/html') content = content.replace('<main>', '<main><p><strong>LOCAL DEMO · synthetic predictions · reports saved only in memory, never to production</strong></p>');
    res.setHeader('Content-Type', `${file[1]}; charset=utf-8`); res.end(content);
  } catch { res.writeHead(500); res.end('Preview request failed'); }
}).listen(4194, '127.0.0.1', () => console.log('Isolated fog verification demo: http://127.0.0.1:4194'));
