import test from "node:test";
import assert from "node:assert/strict";
import { parseVisibleFrames } from "../lib/api-routes/csu-visible.js";

test("CSU visible parser returns only Southeast animation frames", () => {
  const html = `
    <script>
      var imageURLs = [
        'real_time/VIS_se/VIS_se_202608061346.gif',
        'real_time/VIS_se/VIS_se_202608061351.gif',
        'https://example.com/not-csu.gif'
      ];
    </script>
  `;

  assert.deepEqual(parseVisibleFrames(html), [
    "https://schumacher.atmos.colostate.edu/weather/real_time/VIS_se/VIS_se_202608061346.gif",
    "https://schumacher.atmos.colostate.edu/weather/real_time/VIS_se/VIS_se_202608061351.gif"
  ]);
});

test("CSU visible parser safely handles missing frame data", () => {
  assert.deepEqual(parseVisibleFrames("<html></html>"), []);
});
