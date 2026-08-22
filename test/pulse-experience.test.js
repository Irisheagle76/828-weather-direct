import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homePath = new URL("../public/index.html", import.meta.url);
const pulsePath = new URL("../public/pulse.html", import.meta.url);
const pulseCssPath = new URL("../public/css/pulse-page.css", import.meta.url);

test("homepage exposes a multi-post Pulse shelf and direct archive links", async () => {
  const home = await readFile(homePath, "utf8");

  assert.match(home, /id="pulseRecentFeed"/);
  assert.match(home, /function renderRecentPulseShelf/);
  assert.match(home, /pulse\.recent/);
  assert.match(home, /Open the full Pulse/);
  assert.match(home, /Open the complete, full-size feed/);
  assert.match(home, /<a href="\/pulse\.html">Weather Pulse/);
});

test("homepage keeps the latest Pulse shelf after its freshness alert expires", async () => {
  const home = await readFile(homePath, "utf8");
  const renderStart = home.indexOf("function renderPulsePreview");
  const renderEnd = home.indexOf("function hydratePulsePreview", renderStart);
  const renderSource = home.slice(renderStart, renderEnd);

  assert.doesNotMatch(renderSource, /!isPulseFresh/);
  assert.match(renderSource, /setPulsePlacementVisible\(true\)/);
  assert.match(renderSource, /renderRecentPulseShelf\(pulse\.recent\)/);
});

test("Pulse archive uses the Weather Direct design system and renders the full feed", async () => {
  const [page, css] = await Promise.all([
    readFile(pulsePath, "utf8"),
    readFile(pulseCssPath, "utf8")
  ]);

  assert.match(page, /css\/pulse-page\.css/);
  assert.match(page, /Array\.isArray\(data\.items\)/);
  assert.match(page, /What Tim is watching/);
  assert.match(page, /Back to today&rsquo;s weather/);
  assert.match(css, /--paper: #f6f2eb/);
  assert.match(css, /--blue: #0f4cc4/);
  assert.match(css, /--orange: #f57d23/);
  assert.match(css, /font-family: Georgia/);
});
