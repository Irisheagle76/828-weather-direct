import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchUSGSGaugeBundle,
  parseUSGSLatestContinuous
} from "../public/js/water/water-data.js";

test("parseUSGSLatestContinuous maps GeoJSON readings to river gauge fields", () => {
  const parsed = parseUSGSLatestContinuous({
    features: [
      {
        properties: {
          monitoring_location_id: "USGS-03453500",
          parameter_code: "00060",
          value: "1520",
          unit_of_measure: "ft^3/s",
          time: "2026-08-18T12:00:00+00:00"
        }
      },
      {
        properties: {
          monitoring_location_id: "USGS-03453500",
          parameter_code: "00065",
          value: "1.81",
          unit_of_measure: "ft",
          time: "2026-08-18T12:00:00+00:00"
        }
      },
      {
        properties: {
          monitoring_location_id: "USGS-03453500",
          parameter_code: "00010",
          value: "20",
          unit_of_measure: "degC",
          time: "2026-08-18T12:00:00+00:00"
        }
      }
    ]
  });

  assert.equal(parsed["03453500"].dischargeCfs, 1520);
  assert.equal(parsed["03453500"].gaugeHeightFt, 1.81);
  assert.equal(parsed["03453500"].waterTempF, 68);
  assert.equal(parsed["03453500"].observedAt, "2026-08-18T12:00:00+00:00");
});

test("current flow remains live when the optional normal-statistics request fails", async () => {
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    if (options.method === "POST") {
      return new Response(JSON.stringify({
        features: [{
          properties: {
            monitoring_location_id: "USGS-03453500",
            parameter_code: "00060",
            value: "1520",
            unit_of_measure: "ft^3/s",
            time: "2026-08-18T12:00:00+00:00"
          }
        }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("statistics unavailable", { status: 503 });
  };

  try {
    const gauges = await fetchUSGSGaugeBundle(["03453500"]);
    assert.equal(gauges["03453500"].dischargeCfs, 1520);
    assert.equal(gauges["03453500"].isLive, true);
    assert.equal(gauges["03453500"].normalMedianCfs, null);
    assert.equal(gauges["03453500"].percentNormal, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test("placeholder gauge values are not presented as live when USGS current data fails", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("unavailable", { status: 503 });

  try {
    const gauges = await fetchUSGSGaugeBundle(["03453500"]);
    assert.equal(gauges["03453500"].dischargeCfs, null);
    assert.equal(gauges["03453500"].isLive, false);
    assert.equal(gauges["03453500"].observedAt, null);
  } finally {
    global.fetch = originalFetch;
  }
});
