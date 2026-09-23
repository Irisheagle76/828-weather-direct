import test from "node:test";
import assert from "node:assert/strict";
import { parseNceiDowntownObservation } from "../lib/api-routes/sky/current.js";

function nceiPayload(weather = {}) {
  return {
    station_id: 239616,
    station_name: "Grove Arcade",
    sensors: [
      {
        sensor_type: 49,
        data: [{
          ts: 1786715400,
          temp_out: 73.5,
          dew_point: 72,
          hum_out: 94,
          solar_rad: 450,
          uv: 2,
          rain_rate_in: 0,
          ...weather
        }]
      },
      {
        sensor_type: 507,
        data: [{ latitude: 35.59532, longitude: -82.55676, elevation: 2343 }]
      }
    ]
  };
}

test("normalizes the NOAA/NCEI Grove Arcade observation as surface context", () => {
  const observation = parseNceiDowntownObservation(
    nceiPayload(),
    1786715700 * 1000
  );

  assert.equal(observation.stationName, "Grove Arcade");
  assert.equal(observation.metadata.region, "downtown-asheville");
  assert.equal(observation.metadata.role, "surface-valley");
  assert.equal(observation.metadata.elevationFt, 2343);
  assert.equal(observation.ageMinutes, 5);
  assert.equal(observation.dewPointDepressionF, 1.5);
  assert.equal(observation.saturationSignal, true);
  assert.equal(observation.fogSupport, true);
  assert.match(observation.limitation, /cannot diagnose fog by itself/i);
});

test("does not use an unsaturated downtown observation as fog support", () => {
  const observation = parseNceiDowntownObservation(
    nceiPayload({ temp_out: 78, dew_point: 65, hum_out: 60 }),
    1786715700 * 1000
  );

  assert.equal(observation.saturationSignal, false);
  assert.equal(observation.fogSupport, false);
});

test("returns null when the NCEI weather sensor is absent", () => {
  assert.equal(parseNceiDowntownObservation({ sensors: [] }), null);
});

