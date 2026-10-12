import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { ASHEVILLE_STATIONS } from '../lib/asheville-spread/stations.js';

test('Microscope plotting codes cover every enabled core station without duplicate labels', async () => {
  const html = await readFile(new URL('../public/asheville-microscope.html', import.meta.url), 'utf8');
  const match = html.match(/const codeByStationId = (\{[\s\S]*?\});/);
  assert.ok(match, 'plotting code registry exists');
  const codes = vm.runInNewContext(`(${match[1]})`, {}, { timeout: 1000 });
  for (const station of ASHEVILLE_STATIONS.filter(s => s.enabled !== false && (s.scope || 'core') === 'core')) {
    assert.ok(codes[station.id], `${station.name} must be eligible for plotting`);
  }
  assert.equal(new Set(Object.values(codes)).size, Object.values(codes).length);
});
