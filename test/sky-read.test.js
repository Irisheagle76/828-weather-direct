import test from "node:test";
import assert from "node:assert/strict";
import { buildSkyConditionRead, buildSkyObservationContext, isTransientValleyFog } from "../public/js/intel/sky-read.js";
import { august14ValleyFogFixture } from "./fixtures/august-14-2026-valley-fog.js";

function cameraWith(metrics = {}) {
  return {
    metrics: {
      cloudCoverWest: 10,
      brightness: 0.55,
      contrast: 0.14,
      visibilityScore: 3,
      sunlightDetected: true,
      sunlightLevel: "strong",
      groundBrightness: 0.34,
      groundContrast: 0.18,
      skyBlueSignal: 1.2,
      mode: "day",
      ...metrics
    }
  };
}

test("does not let model cloud cover erase an uncorroborated clear camera read", () => {
  const result = buildSkyConditionRead({
    camera: cameraWith(),
    weatherContext: { cloudCover: 1 }
  });

  assert.equal(result.skyIntel.atmosphericState, "mostly_clear");
  assert.equal(result.skyIntel.weatherContextCloudOverride, undefined);
  assert.equal(result.cloudMetric, "10%");
});

test("uses high model cloud cover when camera cloud clues corroborate it", () => {
  const result = buildSkyConditionRead({
    camera: cameraWith({
      cloudCoverWest: 12,
      softShadowSignal: true,
      satelliteHighCloudSignal: true
    }),
    weatherContext: { cloudCover: 1 }
  });

  assert.equal(result.skyIntel.atmosphericState, "mostly_cloudy_filtered");
  assert.equal(result.skyIntel.weatherContextCloudOverride, true);
  assert.equal(result.cloudMetric, "100%");
});

test("keeps aerosol-cleared sky from receiving a model overcast override", () => {
  const result = buildSkyConditionRead({
    camera: cameraWith({
      cloudCoverWest: 100,
      warmHazeSignal: true,
      satelliteCloudFraction: 0.07
    }),
    weatherContext: {
      cloudCover: 1,
      airQuality: { pm25: 30, usAqiPm25: 82, aerosolOpticalDepth: 0.45, dust: 1 }
    }
  });

  assert.equal(result.skyIntel.atmosphericState, "clear_smoke");
  assert.equal(result.label, "Clear + Smoke");
  assert.match(result.narrative.headline, /wildfire smoke/i);
});

test("August 14 Asheville valley fog resolves to a two-layer regime, never Mostly Clear", () => {
  const result = buildSkyConditionRead({ camera: august14ValleyFogFixture });

  assert.equal(result.label, "Valley Fog • Clear Above");
  assert.equal(result.skyIntel.skyRegime, "VALLEY_FOG_CLEAR_ABOVE");
  assert.equal(result.skyIntel.surfaceCondition, "Fog");
  assert.equal(result.skyIntel.skyAboveLowLayer, "Mostly Clear Above");
  assert.equal(result.skyIntel.fogDepth, "Shallow");
  assert.equal(result.skyIntel.fogFootprint, "Mainly Asheville valleys");
  assert.equal(result.skyIntel.spatialDisagreement.cause, "valley_fog");
  assert.equal(result.skyIntel.spatialDisagreement.coherent, true);
  assert.equal(result.skyIntel.surfaceObservationContext.downtownSaturationSupport, true);
  assert.equal(result.skyIntel.sunsetImpact, "minimal");
  assert.equal(isTransientValleyFog(result.skyIntel), true);
  assert.ok(result.skyIntel.confidence >= 0.9);
  assert.doesNotMatch(`${result.label} ${result.narrative.headline}`, /^Mostly Clear/i);
  assert.match(result.narrative.headline, /shallow fog/i);
  assert.match(result.narrative.detail, /Grove Arcade observation confirms saturated air/i);
});

test("KAVL clear conditions cannot erase a foggy Asheville surface camera", () => {
  const fixture = {
    ...august14ValleyFogFixture,
    cameras: {
      downtownSurface: august14ValleyFogFixture.cameras.downtownSurface
    },
    satellite: null
  };
  const result = buildSkyConditionRead({ camera: fixture });

  assert.notEqual(result.label, "Mostly Clear");
  assert.equal(result.skyIntel.atmosphericState, "PATCHY_VALLEY_FOG");
  assert.equal(result.skyIntel.surfaceCondition, "Fog");
});

test("ordinary differences between open-sky cameras preserve the normal classifier", () => {
  const clearCamera = cameraWith();
  clearCamera.cameras = {
    elevated: {
      metadata: { role: "elevated-valley-view", region: "downtown-asheville" },
      classification: "clear",
      metrics: clearCamera.metrics
    },
    east: {
      metadata: { role: "eastern-buncombe", region: "east-asheville" },
      classification: "mostly_clear",
      metrics: clearCamera.metrics
    }
  };
  const result = buildSkyConditionRead({ camera: clearCamera });

  assert.equal(result.skyIntel.skyRegime, undefined);
  assert.equal(result.label, "Mostly Clear");
});

test("a saturated Grove Arcade observation cannot diagnose fog without visual evidence", () => {
  const result = buildSkyConditionRead({
    camera: {
      ...cameraWith(),
      surfaceObservations: august14ValleyFogFixture.surfaceObservations
    }
  });

  assert.equal(result.skyIntel.skyRegime, undefined);
  assert.equal(result.label, "Mostly Clear");
});

test("homepage and Sunset Radiance can share one normalized observation context", () => {
  const input = {
    hour: {
      cloud_cover: 22,
      relative_humidity: 94,
      precipitation_probability: 10,
      weather_code: 3
    },
    current: { solar_radiation: 450, uv_index: 2 },
    airQuality: { pm25: 4 },
    radar: { available: true, ageMinutes: 4 },
    satellite: { available: true, footprint: "valley-confined" },
    surfaceObservations: august14ValleyFogFixture.surfaceObservations
  };

  const homepageContext = buildSkyObservationContext(input);
  const sunsetContext = buildSkyObservationContext(input);

  assert.deepEqual(sunsetContext, homepageContext);
  assert.equal(homepageContext.cloudCover, 0.22);
  assert.equal(homepageContext.humidity, 0.94);
  assert.equal(homepageContext.solarRadiation, 450);
  assert.equal(homepageContext.radar.available, true);
  assert.equal(homepageContext.satellite.footprint, "valley-confined");
});
