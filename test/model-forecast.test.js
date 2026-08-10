import test from "node:test";
import assert from "node:assert/strict";
import { buildModelForecast } from "../lib/api-routes/forecast/model.js";

test("public model fill-in uses current NWS guidance without the vacation gate", async () => {
  const now = new Date("2026-08-10T12:00:00-04:00");
  let receivedConfig;
  const sourceTimestamps = { forecastUpdated: "2026-08-10T15:00:00Z" };
  const candidate = {
    boardHeadline: "Daily timing matters",
    days: { "2026-08-11": { headline: "A useful dry window" } }
  };

  const result = await buildModelForecast({
    now,
    env: { AUTO_FORECAST_ENABLED: "false" },
    sourceLoader: async config => {
      receivedConfig = config;
      return { timestamps: sourceTimestamps };
    },
    generator: sources => {
      assert.equal(sources.timestamps, sourceTimestamps);
      return candidate;
    }
  });

  assert.equal(receivedConfig.enabled, false);
  assert.equal(receivedConfig.latitude, 35.5951);
  assert.equal(result.source, "nws-model");
  assert.equal(result.days["2026-08-11"].headline, "A useful dry window");
  assert.equal(result.metadata.publicationSource, "nws-model");
  assert.equal(result.generatedAt, now.toISOString());
});
