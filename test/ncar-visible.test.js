import test from "node:test";
import assert from "node:assert/strict";
import { getObservedAt, parseVisibleImage } from "../lib/api-routes/ncar-visible.js";

test("NCAR visible parser returns the current Charlotte-region color image", () => {
  const html = `
    <a href="../data/satellite/20260818/CLT/color/20260818_160236_CLT.jpg">
      <img src="../data/satellite/20260818/CLT/color/20260818_160236_CLT.jpg" alt="satellite image">
    </a>
    <img src="https://example.com/not-ncar.jpg">
  `;

  assert.equal(
    parseVisibleImage(html),
    "https://weather.rap.ucar.edu/data/satellite/20260818/CLT/color/20260818_160236_CLT.jpg"
  );
});

test("NCAR visible parser supports the SciAnimator images array", () => {
  const html = `
    <script>
      $("#animation").scianimator({
        "images": [
          "../data/satellite/20260830/CLT/color/20260830_120236_CLT.jpg",
          "../data/satellite/20260830/CLT/color/20260830_120736_CLT.jpg"
        ]
      });
    </script>
  `;

  assert.equal(
    parseVisibleImage(html),
    "https://weather.rap.ucar.edu/data/satellite/20260830/CLT/color/20260830_120736_CLT.jpg"
  );
});

test("NCAR visible parser rejects images outside the expected feed", () => {
  assert.equal(parseVisibleImage('<img src="https://example.com/20260818_160236_CLT.jpg">'), null);
  assert.equal(parseVisibleImage('"https://example.com/data/satellite/20260818/CLT/color/20260818_160236_CLT.jpg"'), null);
  assert.equal(parseVisibleImage("<html></html>"), null);
});

test("NCAR observation time is read from the image filename as UTC", () => {
  assert.equal(
    getObservedAt("https://weather.rap.ucar.edu/data/satellite/20260818/CLT/color/20260818_160236_CLT.jpg"),
    "2026-08-18T16:02:36.000Z"
  );
  assert.equal(getObservedAt("https://example.com/no-timestamp.jpg"), null);
});
