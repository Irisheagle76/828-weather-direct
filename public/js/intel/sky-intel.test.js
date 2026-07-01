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

test("does not let a stale fog flag override a bright blue open-view camera scene", () => {
  const read = computeSkyIntel({
    camera: cameraWith({
      cloudCoverWest: 28,
      brightness: 0.58,
      contrast: 0.12,
      visibilityScore: 1,
      obscuredView: true,
      sunlightDetected: true,
      sunlightLevel: "strong",
      groundBrightness: 0.31,
      groundContrast: 0.16,
      skyBlueSignal: 1.14
    })
  });

  assert.notEqual(read.atmosphericState, "fog");
  assert.equal(read.visualObscured, false);
  assert.equal(read.cloudCoverReliable, true);
});

test("uses strong Tempest solar radiation as another veto against false fog", () => {
  const read = computeSkyIntel({
    camera: cameraWith({
      cloudCoverWest: 48,
      brightness: 0.5,
      contrast: 0.1,
      visibilityScore: 1,
      obscuredView: true,
      sunlightDetected: true,
      sunlightLevel: "moderate",
      groundBrightness: 0.28,
      groundContrast: 0.14,
      skyBlueSignal: 1.02
    }),
    weatherContext: {
      solarRadiation: 540,
      uvIndex: 5
    }
  });

  assert.notEqual(read.atmosphericState, "fog");
  assert.equal(read.visualObscured, false);
  assert.equal(read.stationLightSignal, "bright");
});

test("rejects live false fog when blue sky and Tempest light contradict zero visibility", () => {
  const read = computeSkyIntel({
    camera: cameraWith({
      cloudCoverWest: 0,
      brightness: 0.39,
      contrast: 0.03,
      visibilityScore: 0,
      obscuredView: true,
      sunlightDetected: false,
      sunlightLevel: "weak",
      groundBrightness: 0.42,
      groundContrast: 0.11,
      softShadowSignal: true,
      skyBlueSignal: 1.4,
      satelliteCloudFraction: 0.12
    }),
    weatherContext: {
      solarRadiation: 217,
      uvIndex: 2
    }
  });

  assert.notEqual(read.atmosphericState, "fog");
  assert.equal(read.visualObscured, false);
  assert.equal(read.cloudCoverReliable, true);
  assert.equal(read.sunlightDetected, true);
  assert.equal(read.sunlightLevel, "moderate");
});

test("still marks genuinely flat low-visibility scenes as fog", () => {
  const read = computeSkyIntel({
    camera: cameraWith({
      cloudCoverWest: 8,
      brightness: 0.38,
      contrast: 0.05,
      visibilityScore: 1,
      obscuredView: true,
      sunlightDetected: false,
      sunlightLevel: "weak",
      groundBrightness: 0.12,
      groundContrast: 0.05,
      skyBlueSignal: 0.82
    })
  });

  assert.equal(read.atmosphericState, "fog");
  assert.equal(read.visualObscured, true);
  assert.equal(read.cloudCoverReliable, false);
});

test("does not let Tempest solar override a flat gray low-visibility camera scene by itself", () => {
  const read = computeSkyIntel({
    camera: cameraWith({
      cloudCoverWest: 8,
      brightness: 0.38,
      contrast: 0.05,
      visibilityScore: 1,
      obscuredView: true,
      sunlightDetected: false,
      sunlightLevel: "weak",
      groundBrightness: 0.12,
      groundContrast: 0.05,
      skyBlueSignal: 0.82
    }),
    weatherContext: {
      solarRadiation: 540,
      uvIndex: 5
    }
  });

  assert.equal(read.atmosphericState, "fog");
  assert.equal(read.visualObscured, true);
});
