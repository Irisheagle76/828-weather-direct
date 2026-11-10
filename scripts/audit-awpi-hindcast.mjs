import fs from 'node:fs';
import path from 'node:path';
// Recompute verification scores from original predictions; this does not refit models.
const root = process.argv[2];
if (!root) throw new Error('Usage: node scripts/audit-awpi-hindcast.mjs <research-directory-with-v04-and-v05>');
const parse = file => { const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/); const keys = lines.shift().split(','); return lines.map(line => Object.fromEntries(line.split(',').map((v, i) => [keys[i], v]))); };
const results = [];
for (const version of ['v04', 'v05']) {
  const rows = parse(path.join(root, version, `awpi_${version}_results`, 'predictions.csv'));
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.target}/${r.horizon}/${r.model}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  for (const [key, cases] of groups) {
    const [target, horizon, model] = key.split('/');
    const baseline = groups.get(`${target}/${horizon}/persistence`);
    if (!baseline) throw new Error('Missing persistence baseline');
    const references = new Map(baseline.map(r => [`${r.date}/${r.winter}`, r]));
    let error = 0, referenceError = 0;
    for (const r of cases) {
      const ref = references.get(`${r.date}/${r.winter}`);
      if (!ref || ref.y !== r.y || ![0,1].includes(+r.y) || !Number.isFinite(+r.p) || +r.p < 0 || +r.p > 1) throw new Error('Invalid paired predictions');
      error += (+r.p - +r.y) ** 2; referenceError += (+ref.p - +ref.y) ** 2;
    }
    results.push({ version, target, horizon, model, n: cases.length, winterStart: Math.min(...cases.map(r => +r.winter)), winterEnd: Math.max(...cases.map(r => +r.winter)), brier: error / cases.length, bssPercent: 100 * (1 - error / referenceError) });
  }
}
console.log(JSON.stringify({ verification: 'Recomputed from saved predictions only; model training and confidence intervals not independently reproduced.', results }, null, 2));
