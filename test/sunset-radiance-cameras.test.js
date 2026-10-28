import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePath = new URL("../public/828-sunset-radiance.html", import.meta.url);

test("Sunset Radiance restores Chamber live video and places the traffic still last", async () => {
  const html = await readFile(pagePath, "utf8");

  assert.ok(html.includes('https://www.drivenc.gov/map/Cctv/4204'));
  assert.ok(html.includes('id="driveNCImage"'));
  assert.ok(!html.includes('id="driveNCVideo"'));
  assert.ok(!html.includes('/js/drivenc-camera.js')); 
  assert.ok(html.includes('not included in the automated sky analysis'));
  assert.ok(html.includes('plyhearst.videstra.live'));
  assert.match(html, /id="uncaCameraImage"/);
  assert.match(html, /data-lightbox-title="UNC Asheville Weather Tower"/);
  assert.match(html, /Downtown I-240 traffic camera/);
  assert.match(html, /Live Camera Desk/);
  assert.match(html, /Live Buncombe County Courthouse camera on YouTube/);
  assert.match(html, /Buncombe County Courthouse · West/);
  assert.match(html, /Fairview toward Swannanoa/);
  assert.match(html, /images\.ambientweather\.net\/308398A68945\/latest.jpg/);
  assert.match(html, /KNCFAIRV101/);
  assert.match(html, /2,435 ft/);

  const driveNCIndex = html.indexOf('id="driveNCImage"');
  const chamberIndex = html.indexOf("Live Asheville Area Chamber of Commerce camera");
  const courthouseIndex = html.indexOf("Live Buncombe County Courthouse camera on YouTube");
  const eastAshevilleIndex = html.indexOf("Live East Asheville ENE sky camera on YouTube");

  assert.ok(chamberIndex < courthouseIndex);
  assert.ok(driveNCIndex > html.indexOf('id="fairviewCameraImage"'));
  assert.ok(courthouseIndex < eastAshevilleIndex, "East Asheville camera should follow the Courthouse camera");
});
