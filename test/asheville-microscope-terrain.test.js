import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../public/asheville-microscope-terrain.html", import.meta.url);
const previewUrl = new URL("../tools/asheville-microscope-terrain-preview.mjs", import.meta.url);

test("station terrain is a production-ready Microscope page using the normalized Asheville endpoint", async () => {
  const html = await readFile(pageUrl, "utf8");

  assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/avlweather\.com\/asheville-microscope-terrain\.html">/);
  assert.match(html, /href="\/css\/site-chrome\.css\?v=20260908-global-nav"/);
  assert.match(html, /src="\/js\/site-chrome\.js\?v=20260908-global-nav"/);
  assert.match(html, /<header data-site-header>/);
  assert.match(html, /<div data-site-header-inner>/);
  assert.match(html, /<a data-site-brand/);
  assert.match(html, /<nav data-site-nav/);
  assert.match(html, /<footer data-site-footer><\/footer>/);
  assert.match(html, /const API_URL = "\/api\/router\?route=asheville-spread"/);
  assert.doesNotMatch(html, /api\.weather\.com|swd\.weatherflow\.com|api\.synopticdata\.com|econet\.climate\.ncsu\.edu/i);
  assert.doesNotMatch(html, /WEATHERFLOW_API_KEY|WEATHER_UNDERGROUND_API_KEY|WU_API_KEY/);
  assert.match(html, /maplibre-gl@6\.10\.0/);
  assert.match(html, /https:\/\/tiles\.openfreemap\.org\/styles\/liberty/);
  assert.match(html, /type: "raster-dem"/);
  assert.match(html, /map\.setTerrain\(/);
  assert.match(html, /type: "color-relief"/);
  assert.match(html, /"color-relief-opacity": \.46/);
  assert.match(html, /id: "station-halos"/);
  assert.match(html, /10,16,12,20,15,24/);
  assert.match(html, /"text-halo-width": 3\.2/);
  assert.match(html, /35,"#315bff",55,"#00d9ff"/);
  assert.match(html, /72,"#bd45ff"/);
  assert.match(html, /68,"#ff45d4",78,"#ff305e"/);
  assert.match(html, /45,"#ff36b7"/);
  assert.match(html, /2,"#ff2dce"/);
  assert.match(html, /type: "circle"/);
  assert.doesNotMatch(html, /type:\s*["']heatmap["']/i);
});

test("station terrain preserves observation provenance and unavailable states", async () => {
  const html = await readFile(pageUrl, "utf8");

  for (const field of [
    "station.observation?.observedAt",
    "station.location.latitude",
    "station.location.longitude",
    "station.location.precision",
    "station.elevationFt",
    "station.provider",
    "station.providerStationId",
    "station.quality?.freshness",
    "station.quality?.ageMinutes",
    "station.quality?.flags",
    "station.unavailableReason"
  ]) assert.ok(html.includes(field), `expected terrain page to use ${field}`);

  assert.match(html, /Stale or degraded; shown for transparency and not treated as a current usable reading/);
  assert.match(html, /No sample readings are being substituted/);
  assert.match(html, /value == null \|\| value === "" \? null/);
});

test("station terrain exposes every requested observation mode and popup detail", async () => {
  const html = await readFile(pageUrl, "utf8");

  for (const label of ["Temperature", "Dew Point", "Wind", "Rainfall"]) {
    assert.match(html, new RegExp(`data-metric="[^"]+"[^>]*>${label}<`));
  }
  for (const field of [
    "precipitationRateInHr",
    "precipitationTodayIn",
    "precipitation24HourIn",
    "windGustMph",
    "windDirectionDeg"
  ]) assert.ok(html.includes(field), `expected popup to use ${field}`);

  assert.match(html, /new maplibregl\.Popup/);
  assert.match(html, /Drag to pan/);
  assert.match(html, /two-finger drag to rotate and tilt/);
});

test("local terrain preview serves the shared site chrome assets", async () => {
  const source = await readFile(previewUrl, "utf8");
  assert.match(source, /url\.pathname === "\/css\/site-chrome\.css"/);
  assert.match(source, /url\.pathname === "\/js\/site-chrome\.js"/);
});
