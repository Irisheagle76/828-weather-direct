import test from "node:test";
import assert from "node:assert/strict";
import { CAMERAS } from "../public/js/fall/config.js";

test("The Swag camera retains its verified installation metadata", () => {
  const theSwag = CAMERAS.find((camera) => camera.id === "the-swag");
  assert.deepEqual(
    {
      latitude: theSwag?.latitude,
      longitude: theSwag?.longitude,
      elevationFeet: theSwag?.elevationFeet,
      imageUrl: theSwag?.imageUrl,
      sourceUrl: theSwag?.sourceUrl
    },
    {
      latitude: 35.57400686030403,
      longitude: -83.09374622213542,
      elevationFeet: 5000,
      imageUrl: null,
      sourceUrl: "https://www.theswag.com/grounds/property/live-feed/"
    }
  );
});
