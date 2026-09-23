import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageUrl = new URL("../public/asheville-microscope-terrain.html", import.meta.url);

test("station terrain is a production-ready Microscope page using the normalized Asheville endpoint", async () => {
  const html = await readFile(pageUrl, "utf8");

  assert.match(html, /<meta name="robots" content="index,follow,max-image-preview:large">/);
  assert.match(html, /<link rel="canonical" href="https:\/\/avlweather\.com\/asheville-microscope-terrain\.html">/);
  assert.match(html, /<header class="site-header">/);
  assert.match(html, /<footer class="site-footer">/);
  assert.match(html, /href="\/asheville-microscope\.html">Neighborhood Microscope</);
  assert.match(html, /aria-current="page">Station Terrain</);
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
  assert.match(html, /15,19/);
  assert.match(html, /35,"#315bff",55,"#00d9ff"/);
  assert.match(html, /72,"#bd45ff"/);
  assert.match(html, /68,"#ff45d4",78,"#ff305e"/);
  assert.match(html, /45,"#ff36b7"/);
  assert.match(html, /2,"#ff2dce"/);
  assert.match(html, /type: "circle"/);
  assert.doesNotMatch(html, /type:\s*["']heatmap["']/i);
});

test("station terrain is discoverable from the homepage, Microscope, and sitemap", async () => {
  const [homepage, microscope, sitemap] = await Promise.all([
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/asheville-microscope.html", import.meta.url), "utf8"),
    readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8")
  ]);
  assert.match(homepage, /href="\/asheville-microscope-terrain\.html">Station Terrain</);
  assert.match(microscope, /href="\/asheville-microscope-terrain\.html">Station Terrain</);
  assert.match(microscope, /Explore Station Terrain &rarr;/);
  assert.match(sitemap, /https:\/\/avlweather\.com\/asheville-microscope-terrain\.html/);
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
