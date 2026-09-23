import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homepage = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("homepage uses the downtown Asheville camera", () => {
  assert.match(homepage, /youtube\.com\/embed\/UxUU3Fc1vBw/);
  assert.match(homepage, /title="Live downtown Asheville western sky camera"/);
  assert.doesNotMatch(homepage, /title="Live East Asheville ENE sky camera"/);
});

test("homepage hides Pulse until a fresh update passes the three-hour check", () => {
  assert.match(homepage, /id="pulse-preview" aria-label="Weather Pulse" hidden/);
  assert.match(homepage, /import \{ isPulseFresh, pulseExpiresAt \} from "\.\/js\/pulse-freshness\.js/);
  assert.match(homepage, /if \(!pulse \|\| pulse\.fallback \|\| !isPulseFresh\(updatedAt\)\)/);
  assert.match(homepage, /schedulePulseExpiration\(updatedAt\)/);
});

test("homepage Current Sky headline stays inside its text column", () => {
  assert.match(homepage, /\.sky-home-copy\s*\{[^}]*container-type:\s*inline-size;/s);
  assert.match(homepage, /\.sky-home-headline\s*\{[^}]*font-size:\s*clamp\(1\.9rem,\s*12cqw,\s*3\.3rem\);/s);
  assert.match(homepage, /\.sky-home-headline\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
});
