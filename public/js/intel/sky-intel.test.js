import test from "node:test";
import assert from "node:assert/strict";
import { computeSkyIntel } from "./sky-intel.js";

function cameraWith(metrics = {}) {
  return {
    metrics: {
      cloudCoverWest: 12,
      brightness: 0.41,
      contrast: 0.15,
      visibilityScore: 3,
      sunlightDetected: true,
      sunlightLevel: "strong",
      groundBrightness: 0.32,
      groundContrast: 0.17,
      softShadowSignal: false,
      skyBlueSignal: 1.15,
      mode: "day",
      ...metrics
    }
  };
}

test("keeps a sunny low-cloud sky mostly clear when satellite clouds are only moving nearby", () => {
  const read = computeSkyIntel({
    camera: cameraWith({ satelliteCloudMotionSignal: true })
  });

  assert.equal(read.atmosphericState, "mostly_clear");
  assert.equal(read.cloud, 12);
  assert.equal(read.sunlightLevel, "strong");
});

test("still treats satellite motion as filtered sunshine when cloud cover is meaningful", () => {
  const read = computeSkyIntel({
    camera: cameraWith({ cloudCoverWest: 42, satelliteCloudMotionSignal: true })
  });

  assert.equal(read.atmosphericState, "filtered_sunshine");
});
