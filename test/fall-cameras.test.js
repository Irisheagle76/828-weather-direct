import test from "node:test";
import assert from "node:assert/strict";
import { CAMERAS } from "../public/js/fall/config.js";

test("Fall Explorer camera registry has unique secure sources", () => {
  assert.equal(CAMERAS.length, 17);
  assert.equal(new Set(CAMERAS.map((camera) => camera.id)).size, CAMERAS.length);
  for (const camera of CAMERAS) {
    assert.match(camera.sourceUrl, /^https:\/\//);
    if (camera.imageUrl) assert.match(camera.imageUrl, /^https:\/\//);
  }
});

test("new camera collection distinguishes still images from hosted streams", () => {
  const directImageIds = new Set(CAMERAS.filter((camera) => camera.imageUrl).map((camera) => camera.id));
  for (const id of ["purchase-knob", "gatlinburg-phenocam", "fairview", "newfound-gap", "look-rock", "banner-elk", "highlands-whiteside", "saunook", "pigeon-river-i40"]) {
    assert.ok(directImageIds.has(id), `${id} should use its verified direct image`);
  }
  for (const id of ["cataloochee-lift", "cataloochee-ranch", "beech-base", "the-swag"]) {
    assert.equal(CAMERAS.find((camera) => camera.id === id)?.imageUrl, null, `${id} should remain a provider-hosted stream`);
  }
});

test("Saunook camera retains its station metadata and raw weather feed", () => {
  const saunook = CAMERAS.find((camera) => camera.id === "saunook");
  assert.deepEqual(
    {
      latitude: saunook?.latitude,
      longitude: saunook?.longitude,
      elevationFeet: saunook?.elevationFeet,
      elevationMeters: saunook?.elevationMeters,
      imageUrl: saunook?.imageUrl,
      rawDataUrl: saunook?.rawDataUrl
    },
    {
      latitude: 35.445883,
      longitude: -83.033635,
      elevationFeet: 3317,
      elevationMeters: 1011,
      imageUrl: "https://www.saunookweather.com/webcam.jpg",
      rawDataUrl: "https://www.saunookweather.com/clientraw.txt"
    }
  );
});

test("Highlands camera retains its verified installation metadata", () => {
  const highlands = CAMERAS.find((camera) => camera.id === "highlands-whiteside");
  assert.deepEqual(
    {
      latitude: highlands?.latitude,
      longitude: highlands?.longitude,
      elevationFeet: highlands?.elevationFeet
    },
    {
      latitude: 35.06101989261826,
      longitude: -83.18449534662024,
      elevationFeet: 4268
    }
  );
});

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

test("Pigeon River camera retains its supplied location and terrain elevation", () => {
  const pigeonRiver = CAMERAS.find((camera) => camera.id === "pigeon-river-i40");
  assert.deepEqual(
    {
      latitude: pigeonRiver?.latitude,
      longitude: pigeonRiver?.longitude,
      elevationFeet: pigeonRiver?.elevationFeet,
      imageUrl: pigeonRiver?.imageUrl
    },
    {
      latitude: 35.76890579744448,
      longitude: -83.08067674527256,
      elevationFeet: 1559,
      imageUrl: "https://www.drivenc.gov/map/Cctv/6098"
    }
  );
});
