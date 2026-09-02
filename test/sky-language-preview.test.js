import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const previewPath = new URL("../public/admin/sky-language-preview.html", import.meta.url);
const scriptPath = new URL("../public/js/sky-language-preview.js", import.meta.url);
const adminPath = new URL("../public/admin/index.html", import.meta.url);

test("Sky Language Lab is admin-only, noindex, and linked from admin home", async () => {
  const [preview, admin] = await Promise.all([readFile(previewPath, "utf8"), readFile(adminPath, "utf8")]);
  assert.match(preview, /name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(preview, /Internal preview · Admin home/);
  assert.match(admin, /href="\/admin\/sky-language-preview\.html"/);
});

test("Sky Language Lab exposes sky and solar controls with all public outputs", async () => {
  const html = await readFile(previewPath, "utf8");
  for (const id of ["preset", "skyColor", "coverage", "cloudType", "typeConfidence", "texture", "sunVisibility", "solarPhase", "cameraQuality", "eastCoverage", "westCoverage", "undercast", "satValleyPattern", "satBroadDeck", "satTrend", "humidity", "microOutput", "shortOutput", "solarPhaseOutput", "solarReadOutput", "narrativeHeadline", "variationGallery", "stateOutput"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const preset of ["sunrise-clear", "sunrise-filtered", "sunset-clear", "sunset-filtered", "afterglow"]) {
    assert.match(html, new RegExp(`value="${preset}"`));
  }
});

test("Sky Language Lab runs the actual shared state and language modules", async () => {
  const script = await readFile(scriptPath, "utf8");
  assert.match(script, /import \{ buildSkyState \} from "\.\/intel\/sky-state\.js(?:\?[^\"]+)?"/);
  assert.match(script, /import \{ generateSkyLanguage \} from "\.\/intel\/sky-language\.js(?:\?[^\"]+)?"/);
  assert.match(script, /verbosity: "micro"/);
  assert.match(script, /verbosity: "short"/);
  assert.match(script, /verbosity: "narrative"/);
  assert.match(script, /sunriseAt: SOLAR_TIMES\.sunriseAt/);
  assert.match(script, /sunsetAt: SOLAR_TIMES\.sunsetAt/);
  assert.match(script, /Array\.from\(\{ length: 6 \}/);
});
