import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFrame } from "../lib/api-routes/sky/current.js";

function frame(width, height, paint) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 255;
    }
  }
  return { width, height, data };
}

test("clear blue sky is not replaced by textured terrain in a deep camera crop", () => {
  const image = frame(600, 400, (x, y) => {
    if (y < 145) return [105 + (x % 7), 160 + (y % 5), 225];
    return (x + y) % 12 < 6 ? [34, 78, 28] : [92, 64, 35];
  });

  const metrics = analyzeFrame(image, { skyCrop: 0.62 });

  assert.ok(metrics.cloudCoverWest <= 5, `expected a clear read, got ${metrics.cloudCoverWest}%`);
  assert.equal(metrics.buildingCloudStructureSignal, false);
  assert.ok(metrics.blueShare >= 0.95);
});

test("courthouse timestamp overlay cannot become mostly-cloudy coverage", () => {
  const image = frame(600, 300, (x, y) => {
    const inOverlay = x < 190 && y < 28;
    if (inOverlay) return (x + y) % 8 < 4 ? [255, 255, 255] : [55, 55, 55];
    if (y < 80) return [115, 166, 224];
    return [55, 85, 48];
  });

  const metrics = analyzeFrame(image, { skyCrop: 0.2 });

  assert.ok(metrics.cloudCoverWest < 25, `overlay inflated coverage to ${metrics.cloudCoverWest}%`);
  assert.equal(metrics.buildingCloudStructureSignal, false);
  assert.ok(metrics.blueShare > 0.75);
});

test("pixel-classified clouds still produce a cloudy coverage read", () => {
  const image = frame(600, 300, (x, y) => {
    if (y < 80) return x < 300 ? [125, 174, 226] : [205, 207, 210];
    return [70, 75, 65];
  });

  const metrics = analyzeFrame(image, { skyCrop: 0.2 });

  assert.ok(metrics.cloudCoverWest >= 45 && metrics.cloudCoverWest <= 55);
});
