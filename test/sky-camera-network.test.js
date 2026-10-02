import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fetchCameraFrame } from '../lib/sky/camera-fetch.js';
import { solarElevation } from '../lib/sky/daylight.js';
import { CAMERA_REGISTRY, analyzeFrame, buildObservation } from '../lib/api-routes/sky/current.js';
import { buildSkyState } from '../public/js/intel/sky-state.js';
import { generateSkyLanguage } from '../public/js/intel/sky-language.js';
const now = Date.parse('2026-10-02T17:00:00Z');
const observation = (source, coverageFraction, overrides = {}) => ({ source, coverageFraction, timestamp: new Date(now).toISOString(), available: true, quality: 'good', qualityScore: .9, confidence: .8, ...overrides });

test('Fairview remains regional, preserves north direction, and appears in the narrative', () => {
  const registry = CAMERA_REGISTRY.filter(c => ['fairview-north', 'downtown-asheville-west'].includes(c.id));
  const state = buildSkyState({ now, camera: { cameraRegistry: registry, observations: [
    observation('downtown-asheville-west', .05, { directional: { west: { coverageFraction: .05 } } }),
    observation('fairview-north', 1, { scope: 'regional', directional: { north: { coverageFraction: 1 } } })
  ] } });
  assert.equal(state.cloudCoverageFraction, .05);
  assert.equal(state.directional.north, undefined);
  assert.equal(state.regionalViews[0].direction, 'north');
  assert.match(generateSkyLanguage(state, { verbosity: 'narrative' }).detail, /Fairview toward Swannanoa, looking north: overcast/);
});

test('expired regional images cannot enter the narrative and remain visible as stale status', () => {
  const state = buildSkyState({ now, camera: { cameraRegistry: CAMERA_REGISTRY, observations: [observation('fairview-north', 1, { scope: 'regional', timestamp: new Date(now - 16 * 60000).toISOString() })] } });
  assert.equal(state.regionalViews.length, 0);
  assert.equal(state.cameraViews.find(v => v.source === 'fairview-north').status, 'stale');
  assert.equal(state.cameraViews.find(v => v.source === 'chamber-southwest').status, 'offline');
});

test('SSE, ENE and southwest views retain their actual bearings', () => {
  const state = buildSkyState({ now, camera: { observations: [observation('views', .5, { directional: { 'south-southeast': { coverageFraction: .4 }, 'east-northeast': { coverageFraction: .9 }, southwest: { coverageFraction: .2 } } })] } });
  assert.equal(state.directional['east-northeast'].coverageFraction, .9);
  assert.equal(state.directional['south-southeast'].coverageFraction, .4);
  assert.equal(state.directional.west, undefined);
});

test('Fairview sky sampling excludes timestamp and foreground', () => {
  const camera = CAMERA_REGISTRY.find(c => c.id === 'fairview-north');
  const width = 300, height = 200, data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(y < 10 || y >= 80 ? [255, 255, 255, 255] : [90, 150, 230, 255], (y * width + x) * 4);
  const metrics = analyzeFrame({ width, height, data }, camera);
  assert.equal(metrics.cloudCoverWest, 0);
  assert.equal(buildObservation(camera, metrics, new Date(now).toISOString()).scope, 'regional');
});

test('capture manifest must match the frame hash and source', async () => {
  const buffer = Buffer.from('camera-frame');
  const manifest = { source: 'chamber-southwest', status: 'ok', observedAt: new Date(now).toISOString(), sha256: createHash('sha256').update(buffer).digest('hex') };
  const camera = CAMERA_REGISTRY.find(c => c.id === manifest.source);
  const fetchImpl = async url => new Response(url.includes('.json') ? JSON.stringify(manifest) : buffer);
  assert.equal((await fetchCameraFrame(camera, { fetchImpl, now })).timestamp, manifest.observedAt);
  manifest.sha256 = 'mismatch';
  await assert.rejects(fetchCameraFrame(camera, { fetchImpl, now }), /updating/);
  manifest.source = 'wrong-camera';
  await assert.rejects(fetchCameraFrame(camera, { fetchImpl, now }), /verified/);
});

test('night exposure cannot stand in for daylight and UNCA uses its current university source', () => {
  assert.ok(solarElevation(Date.parse('2026-10-02T10:00:00Z')) < -3);
  assert.ok(solarElevation(now) > 40);
  assert.ok(solarElevation(Date.parse('2026-06-21T23:00:00Z')) > 0);
  assert.ok(solarElevation(Date.parse('2026-12-21T23:00:00Z')) < -3);
  assert.match(CAMERA_REGISTRY.find(c => c.id === 'unca-south').snapshotUrl, /www\.atms\.unca\.edu\/currwx\/towercam\.jpg/);
});
