import test from "node:test";
import assert from "node:assert/strict";
import { buildSkyState } from "../public/js/intel/sky-state.js";
import { generateSkyLanguage, resetSkyLanguageMemory } from "../public/js/intel/sky-language.js";
import { buildSkyConditionRead } from "../public/js/intel/sky-read.js";
import { CAMERA_REGISTRY } from "../lib/sky/camera-registry.js";

const NOW = Date.parse("2026-08-27T20:00:00Z");

function observation(overrides = {}) {
  return {
    source: "test-camera", timestamp: new Date(NOW).toISOString(), available: true,
    quality: "good", qualityScore: 0.9, confidence: 0.88,
    coverageFraction: 0.35, skyColor: "blue", cloudTypes: [], texture: [],
    sunVisibility: "mostly_unobstructed", ridgeVisibility: "good", valleyVisibility: "good",
    undercast: "none", directional: { west: { coverageFraction: 0.25 } },
    ...overrides
  };
}

function satellite(overrides = {}) {
  return observation({
    kind: "satellite", source: "ncar-visible-satellite", skyColor: null,
    ridgeVisibility: "unknown", valleyVisibility: "poor", sunVisibility: "uncertain", undercast: "none",
    satelliteLowCloud: {
      quality: "good", valleyPattern: "likely", valleyFogScore: 0.78,
      broadDeck: "possible", broadLowCloudScore: 0.46, trend: "little_change", confidence: 0.86,
      ...overrides
    }
  });
}

function read(observations, weatherContext = null) {
  const state = buildSkyState({ camera: { timestamp: new Date(NOW).toISOString(), observations }, weatherContext, now: NOW });
  return {
    state,
    short: generateSkyLanguage(state, { verbosity: "short", seed: "test", remember: false }),
    narrative: generateSkyLanguage(state, { verbosity: "narrative", seed: "test", remember: false })
  };
}

function assertConsistent(result) {
  assert.ok(result.short.length > 0 && result.short.split(/\s+/).length <= 18);
  assert.ok(result.narrative.headline.length > 0 && result.narrative.detail.length > 0);
  if (result.state.overall === "clear" || result.state.overall === "mostly_clear") assert.doesNotMatch(result.narrative.detail, /solid cloud deck|broadly gray/i);
  if (result.state.overall === "overcast") assert.doesNotMatch(result.narrative.detail, /broadly open|plenty of open sky/i);
}

const scenarios = [
  ["clear blue sky", observation({ coverageFraction: 0.02 })],
  ["mostly clear with fair-weather cumulus", observation({ coverageFraction: 0.22, cloudTypes: [{ type: "fair_weather_cumulus", confidence: 0.9 }], texture: ["puffy"] })],
  ["cirrus over blue", observation({ coverageFraction: 0.25, cloudTypes: [{ type: "cirrus", confidence: 0.88 }], texture: ["wispy"] })],
  ["cirrostratus filtering sun", observation({ coverageFraction: 0.58, cloudTypes: [{ type: "cirrostratus", confidence: 0.86 }], texture: ["thin", "layered"], sunVisibility: "filtered" })],
  ["broken stratocumulus", observation({ coverageFraction: 0.7, skyColor: "blue_gray", cloudTypes: [{ type: "stratocumulus", confidence: 0.84 }], texture: ["lumpy", "broken"], sunVisibility: "occasionally_filtered" })],
  ["gray overcast", observation({ coverageFraction: 0.98, skyColor: "gray", texture: ["flat"], sunVisibility: "mostly_hidden" })],
  ["towering cumulus over mountains", observation({ coverageFraction: 0.48, cloudTypes: [{ type: "towering_cumulus", confidence: 0.9 }], texture: ["towering"], arrangement: "over_mountains" })],
  ["distant cumulonimbus", observation({ coverageFraction: 0.38, cloudTypes: [{ type: "cumulonimbus", confidence: 0.9 }], texture: ["towering"] })]
];

for (const [name, sample] of scenarios) test(name, () => assertConsistent(read([sample])));

test("clearing western sky", () => {
  const result = read([observation({ directional: { west: { coverageFraction: 0.1 }, east: { coverageFraction: 0.65 } } })]);
  assert.match(result.short, /west/i); assertConsistent(result);
});

test("clouds increasing from west", () => {
  const result = read([observation({ directional: { west: { coverageFraction: 0.82 }, east: { coverageFraction: 0.28 } } })]);
  assert.match(result.short, /west/i); assertConsistent(result);
});

test("clear west and cloudy east remain spatially distinct", () => {
  const result = read([observation({ directional: { west: { coverageFraction: 0.12 }, east: { coverageFraction: 0.83 } } })]);
  assert.equal(result.state.directional.west.coverage, "few");
  assert.equal(result.state.directional.east.coverage, "mostly_cloudy");
  assert.match(result.narrative.detail, /east.+west/i);
});

test("cloudy west with blue overhead", () => {
  const result = read([observation({ directional: { west: { coverageFraction: 0.86 }, overhead: { coverageFraction: 0.18 } } })]);
  assert.equal(result.state.horizon, "cloudy_west");
  assert.equal(result.state.directional.overhead.coverage, "few");
});

test("possible undercast uses conservative language", () => {
  const result = read([observation({ undercast: "possible", valleyVisibility: "poor", ridgeVisibility: "good" })]);
  assert.match(result.short, /signs|low clouds/i);
  assert.doesNotMatch(result.short, /confirmed/i);
});

test("confirmed undercast is downgraded without corroboration and retained with it", () => {
  const one = read([observation({ undercast: "confirmed" })]);
  const two = read([observation({ source: "a", undercast: "confirmed" }), observation({ source: "b", undercast: "likely" })]);
  assert.equal(one.state.undercast, "likely");
  assert.equal(two.state.undercast, "confirmed");
});

test("visible satellite valley signature plus surface saturation confirms valley fog", () => {
  const result = read([observation({ valleyVisibility: "poor" }), satellite({ trend: "dissipating" })], { cloudCover: 0.65, humidity: 0.96 });
  assert.equal(result.state.fogState.type, "valley_fog");
  assert.equal(result.state.fogState.likelihood, "confirmed");
  assert.match(result.short, /valley fog.+thinning/i);
  assert.match(result.narrative.observation, /French Broad and Swannanoa/i);
});

test("satellite-only possible valley signature stays cautious", () => {
  const result = read([observation(), satellite({ valleyPattern: "possible", valleyFogScore: 0.4, broadDeck: "none", broadLowCloudScore: 0.1 })], { cloudCover: 0.35, humidity: 0.65 });
  assert.equal(result.state.fogState.likelihood, "possible");
  assert.match(result.short, /possible fog/i);
});

test("broad satellite deck is distinguished from valley fog", () => {
  const result = read([
    observation({ coverageFraction: 0.97, texture: ["flat"], valleyVisibility: "poor", ridgeVisibility: "poor", sunVisibility: "mostly_hidden" }),
    satellite({ valleyPattern: "none", valleyFogScore: 0.1, broadDeck: "likely", broadLowCloudScore: 0.82 })
  ], { cloudCover: 0.98, humidity: 0.94 });
  assert.equal(result.state.fogState.type, "low_overcast");
  assert.equal(result.state.fogState.likelihood, "confirmed");
  assert.match(result.short, /low overcast/i);
});

test("stale camera is excluded in favor of weather fallback", () => {
  const stale = observation({ timestamp: new Date(NOW - 20 * 60_000).toISOString(), quality: "stale", coverageFraction: 1 });
  const result = read([stale], { cloudCover: 0.1 });
  assert.equal(result.state.overall, "clear");
  assert.deepEqual(result.state.debug.camerasUsed, []);
});

test("offline camera is not interpreted as weather", () => {
  const result = read([observation({ available: false, quality: "offline", coverageFraction: 1 })], { cloudCover: 0.2 });
  assert.equal(result.state.overall, "mostly_clear");
});

test("night camera is rejected", () => {
  const result = read([observation({ quality: "night", coverageFraction: 1 })], { cloudCover: 0.4 });
  assert.equal(result.state.overall, "partly_cloudy");
});

test("low-confidence classification falls back to visual cloud language", () => {
  const result = read([observation({ cloudTypes: [{ type: "cumulonimbus", confidence: 0.2 }], texture: ["puffy"] })]);
  assert.doesNotMatch(result.short, /cumulonimbus/i);
  assert.match(result.short, /puffy|cloud/i);
});

test("disagreeing cameras preserve directions instead of averaging them away", () => {
  const result = read([
    observation({ source: "west", coverageFraction: 0.2, directional: { west: { coverageFraction: 0.15 } } }),
    observation({ source: "east", coverageFraction: 0.8, directional: { east: { coverageFraction: 0.85 } } })
  ]);
  assert.match(result.short, /east.+west/i);
  assert.ok(result.state.cloudCoverageFraction > 0.4 && result.state.cloudCoverageFraction < 0.6);
});

test("repeated readouts vary without changing meteorological meaning", () => {
  resetSkyLanguageMemory();
  const state = read([observation({ coverageFraction: 0.2, cloudTypes: [{ type: "cirrus", confidence: 0.9 }], texture: ["wispy"] })]).state;
  const variants = new Set(Array.from({ length: 12 }, (_, index) => generateSkyLanguage({ ...state, timestamp: new Date(NOW + index * 60_000).toISOString() }, { verbosity: "short", surface: "repeat-test" })));
  assert.ok(variants.size >= 2);
  for (const variant of variants) assert.doesNotMatch(variant, /overcast|mostly cloudy/i);
});

test("camera registry encodes North Asheville orientation and keeps East Asheville ready but disabled", () => {
  const north = CAMERA_REGISTRY.find((camera) => camera.id === "north-asheville-south");
  const east = CAMERA_REGISTRY.find((camera) => camera.id === "east-asheville-east");
  assert.deepEqual(north.orientation, { left: "east", center: "south", right: "west" });
  assert.match(north.snapshotUrl, /s28\.ipcamlive\.com/);
  assert.equal(east.enabled, false);
  assert.ok(east.snapshotUrl);
});

test("homepage and Sunset Radiance translate the same shared Sky State", () => {
  const camera = {
    timestamp: new Date(NOW).toISOString(),
    metrics: { cloudCoverWest: 32, mode: "day", sunlightDetected: true, sunlightLevel: "strong", skyBlueSignal: 1.25, brightness: 0.7, contrast: 0.12 },
    observations: [observation({ coverageFraction: 0.32, cloudTypes: [{ type: "fair_weather_cumulus", confidence: 0.86 }], texture: ["puffy"] })]
  };
  const homepage = buildSkyConditionRead({ camera, verbosity: "short", surface: "test-homepage" });
  const sunset = buildSkyConditionRead({ camera, verbosity: "narrative", surface: "test-radiance" });
  assert.deepEqual(homepage.skyState, sunset.skyState);
  assert.equal(homepage.skyIntel.atmosphericState, sunset.skyIntel.atmosphericState);
  assert.doesNotMatch(homepage.narrative.headline, /overcast/i);
  assert.doesNotMatch(sunset.narrative.detail, /solid cloud deck|broadly gray/i);
});
