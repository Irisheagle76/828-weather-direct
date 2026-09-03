import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pagePath = new URL("../public/828-sunset-radiance.html", import.meta.url);

test("Sunset Radiance includes the Chamber camera as a visual Sky Read assistant", async () => {
  const html = await readFile(pagePath, "utf8");

  assert.match(html, /plyhearst\.videstra\.live\/\?id=674b5cf0-55b3-49e2-a8da-bb57ce2ece92_/);
  assert.match(html, /token=kswZPhLz4beUpNJK7w4Fgl8eu/);
  assert.match(html, /Live Asheville Area Chamber of Commerce camera/);
  assert.match(html, /Primary visual cross-check/);
  assert.match(html, /Live Camera Desk/);
});
