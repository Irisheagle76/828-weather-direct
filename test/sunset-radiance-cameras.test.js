import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePath = new URL("../public/828-sunset-radiance.html", import.meta.url);

test("Sunset Radiance includes the Chamber camera as a visual Sky Read assistant", async () => {
  const html = await readFile(pagePath, "utf8");

  assert.match(html, /plyhearst\.videstra\.live\/\?id=674b5cf0-55b3-49e2-a8da-bb57ce2ece92_/);
  assert.match(html, /token=kswZPhLz4beUpNJK7w4Fgl8eu/);
  assert.match(html, /Live Asheville Area Chamber of Commerce camera/);
  assert.match(html, /faces southwest toward Mt\. Pisgah, about 16 miles away/);
  assert.match(html, /Live Camera Desk/);
  assert.match(html, /Live Buncombe County Courthouse camera on YouTube/);
  assert.match(html, /Buncombe County Courthouse · West/);
  assert.match(html, /UNC Asheville Weather Tower/);
  assert.match(html, /Looking back toward downtown Asheville/);
  assert.match(html, /35\.62180° N, 82\.56606° W/);
  assert.match(html, /2,357 ft/);
  assert.match(html, /econet\.climate\.ncsu\.edu\/m\/\?id=UNCA/);
  assert.doesNotMatch(html, /Fairview/i);

  const chamberIndex = html.indexOf("Live Asheville Area Chamber of Commerce camera");
  const courthouseIndex = html.indexOf("Live Buncombe County Courthouse camera on YouTube");
  const eastAshevilleIndex = html.indexOf("Live East Asheville ENE sky camera on YouTube");
  const uncaIndex = html.indexOf("UNC Asheville Weather Tower");

  assert.ok(chamberIndex < courthouseIndex, "Courthouse camera should follow the Chamber camera");
  assert.ok(courthouseIndex < eastAshevilleIndex, "East Asheville camera should follow the Courthouse camera");
  assert.ok(eastAshevilleIndex < uncaIndex, "UNC Asheville snapshot should sit beside East Asheville after the Courthouse camera");
});
