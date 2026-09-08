import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedLinks = [
  ["Home", "/"],
  ["Forecast", "/forecast.html"],
  ["Radar & Satellite", "/radar.html"],
  ["FEELSCORE", "/se_feelscore.html"],
  ["Hiking", "/hiking.html"],
  ["Water Conditions", "/water.html"],
  ["I-26 Connector", "/i26-connector.html"],
  ["Weather Pulse", "/pulse.html"],
  ["Fall Explorer", "/fall.html"],
  ["Sunset Radiance", "/828-sunset-radiance.html"],
];

const publicPages = [
  "index.html",
  "forecast.html",
  "radar.html",
  "se_feelscore.html",
  "hiking.html",
  "water.html",
  "i26-connector.html",
  "pulse.html",
  "fall.html",
  "828-sunset-radiance.html",
];

function textOnly(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackLinks(html) {
  const nav = html.match(/<nav[^>]*data-site-nav[^>]*>([\s\S]*?)<\/nav>/i);
  assert.ok(nav, "page includes a data-site-nav element");
  return [...nav[1].matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(
    ([, href, label]) => [textOnly(label), href],
  );
}

test("shared navigation has the approved public links", async () => {
  const script = await readFile(new URL("../public/js/site-chrome.js", import.meta.url), "utf8");
  for (const [label, href] of expectedLinks) {
    assert.match(script, new RegExp(`\\["${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}", "${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\]`));
  }
  assert.doesNotMatch(script, /microscope/i);
});

for (const page of publicPages) {
  test(`${page} uses the complete global navigation fallback`, async () => {
    const html = await readFile(new URL(`../public/${page}`, import.meta.url), "utf8");
    assert.deepEqual(fallbackLinks(html), expectedLinks);
    assert.match(html, /site-chrome\.css\?v=20260908-global-nav/);
    assert.match(html, /site-chrome\.js\?v=20260908-global-nav/);
    assert.doesNotMatch(html.match(/<nav[^>]*data-site-nav[^>]*>[\s\S]*?<\/nav>/i)[0], /microscope/i);
  });
}
