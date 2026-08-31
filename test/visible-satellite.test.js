import test from "node:test";
import assert from "node:assert/strict";
import { analyzeVisibleSatelliteFrame, VALLEY_MASK } from "../lib/sky/visible-satellite.js";

const WIDTH = 610;
const HEIGHT = 673;

function frame(level = 55) {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let index = 0; index < data.length; index += 4) {
    data[index] = level; data[index + 1] = level; data[index + 2] = level; data[index + 3] = 255;
  }
  return { width: WIDTH, height: HEIGHT, data };
}

function paintDisc(target, x, y, radius, level) {
  for (let py = Math.max(0, Math.floor(y - radius)); py <= Math.min(HEIGHT - 1, Math.ceil(y + radius)); py += 1) {
    for (let px = Math.max(0, Math.floor(x - radius)); px <= Math.min(WIDTH - 1, Math.ceil(x + radius)); px += 1) {
      if (Math.hypot(px - x, py - y) > radius) continue;
      const index = (py * WIDTH + px) * 4;
      target.data[index] = level; target.data[index + 1] = level; target.data[index + 2] = level;
    }
  }
}

function paintLine(target, points, level = 175) {
  const scaled = points.map(([x, y]) => [x * WIDTH / VALLEY_MASK.canonicalWidth, y * HEIGHT / VALLEY_MASK.canonicalHeight]);
  for (let index = 1; index < scaled.length; index += 1) {
    const [ax, ay] = scaled[index - 1], [bx, by] = scaled[index];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
    for (let step = 0; step <= steps; step += 1) paintDisc(target, ax + (bx - ax) * step / steps, ay + (by - ay) * step / steps, 5, level);
  }
}

test("valley-shaped reflectance is recognized along both Asheville corridors", () => {
  const target = frame();
  paintLine(target, VALLEY_MASK.frenchBroad);
  paintLine(target, VALLEY_MASK.swannanoa);
  const analysis = analyzeVisibleSatelliteFrame(target, { observedAt: "2026-08-28T16:00:00.000Z", now: Date.parse("2026-08-28T16:05:00.000Z") });
  assert.equal(analysis.quality, "good");
  assert.equal(analysis.valleyPattern, "likely");
  assert.ok(analysis.corridors.frenchBroad.ridgeContrast > 0.1);
  assert.ok(analysis.corridors.swannanoa.ridgeContrast > 0.1);
});

test("a uniform reflective field is classified as a broad deck instead of valley fog", () => {
  const analysis = analyzeVisibleSatelliteFrame(frame(155), { observedAt: "2026-08-28T16:00:00.000Z", now: Date.parse("2026-08-28T16:05:00.000Z") });
  assert.equal(analysis.broadDeck, "likely");
  assert.notEqual(analysis.valleyPattern, "likely");
});

test("a weakening valley signature is marked as dissipating", () => {
  const weak = frame(); paintLine(weak, VALLEY_MASK.frenchBroad, 75); paintLine(weak, VALLEY_MASK.swannanoa, 75);
  const latest = analyzeVisibleSatelliteFrame(weak, {
    observedAt: "2026-08-28T16:00:00.000Z", now: Date.parse("2026-08-28T16:05:00.000Z"),
    previous: { valleyFogScore: 1 }
  });
  assert.equal(latest.trend, "dissipating");
  assert.equal(latest.valleyPattern, "possible");
});

test("a previous fog peak cannot keep a weaker current frame likely", () => {
  const weak = frame(); paintLine(weak, VALLEY_MASK.frenchBroad, 75); paintLine(weak, VALLEY_MASK.swannanoa, 75);
  const latest = analyzeVisibleSatelliteFrame(weak, {
    observedAt: "2026-08-28T16:00:00.000Z", now: Date.parse("2026-08-28T16:05:00.000Z"),
    previous: { valleyFogScore: 0.95 }
  });
  assert.ok(latest.valleyFogScore < 0.52);
  assert.equal(latest.valleyPattern, "possible");
});
