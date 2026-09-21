import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homepage = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("homepage Current Sky headline stays inside its text column", () => {
  assert.match(homepage, /\.sky-home-copy\s*\{[^}]*container-type:\s*inline-size;/s);
  assert.match(homepage, /\.sky-home-headline\s*\{[^}]*font-size:\s*clamp\(1\.9rem,\s*12cqw,\s*3\.3rem\);/s);
  assert.match(homepage, /\.sky-home-headline\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
});
