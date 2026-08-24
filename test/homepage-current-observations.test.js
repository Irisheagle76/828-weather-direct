import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const homepagePath = new URL("../public/index.html", import.meta.url);

test("homepage prefers live Tempest dew point and wind over the first forecast hour", async () => {
  const html = await readFile(homepagePath, "utf8");

  assert.match(
    html,
    /dewF:\s*current\.dewpointF \?\? current\.dewPoint \?\? toF\(current\.dew_point\) \?\? firstHour\.dewpointF/
  );
  assert.match(
    html,
    /windMph:\s*current\.windSpeed \?\? current\.wind \?\? toMph\(current\.wind_avg\) \?\? firstHour\.windSpeed/
  );
});
