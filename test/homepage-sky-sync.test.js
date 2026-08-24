import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homepagePath = new URL("../public/index.html", import.meta.url);

test("homepage Current Sky uses the western camera shown by Sunset Radiance", async () => {
  const html = await readFile(homepagePath, "utf8");

  assert.match(html, /youtube\.com\/embed\/UxUU3Fc1vBw\?playsinline=1/);
  assert.match(html, /Live downtown Asheville western sky camera/);
  assert.match(html, /Live western stream/);
  assert.match(html, /Western camera cloud cover/);
  assert.doesNotMatch(html, /id="skyHomeStream"[\s\S]{0,250}mmmo3Q5oevg/);
});

test("homepage Current Sky does not replace its camera narrative with the sunset index fallback", async () => {
  const html = await readFile(homepagePath, "utf8");

  assert.doesNotMatch(html, /buildDuskSkyFallback/);
  assert.doesNotMatch(html, /duskFallback/);
  assert.doesNotMatch(html, /stormNarrativeWithinWindow/);
  assert.match(html, /getPrecipSkyLabel/);
  assert.match(html, /applyPrecipOverrideToNarrative\(skyNarrative, latestPrecipOverride\)/);
  assert.match(html, /let skyNarrative = nighttimeFallback/);
  assert.match(html, /: narrative;/);
});

test("homepage shares the live camera cloud signal without scheduling duplicate sky refreshes", async () => {
  const html = await readFile(homepagePath, "utf8");

  assert.match(html, /latestVisualCameraCloud/);
  assert.match(html, /renderVisualWeatherContext\(\)/);
  assert.equal((html.match(/setInterval\(hydrateSkyModule, 60 \* 1000\);/g) || []).length, 1);
});

test("homepage keeps the data-driven mountain scene out of the live conditions hierarchy", async () => {
  const html = await readFile(homepagePath, "utf8");

  assert.doesNotMatch(html, /id="blueRidgeWeatherScene"/);
  assert.doesNotMatch(html, /renderBlueRidgeWeatherScene/);
  assert.match(html, /class="visual-intelligence-cluster"/);
});

test("homepage Sunset Radiance promotion is evidence-gated instead of clock-only", async () => {
  const html = await readFile(homepagePath, "utf8");

  assert.match(html, /evaluateSunsetPromotion/);
  assert.doesNotMatch(html, /localHour\(\) >= 15/);
  assert.match(html, />\s*Watch live\s*<\/a>/);
});
