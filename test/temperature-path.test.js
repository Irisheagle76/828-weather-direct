import test from "node:test";
import assert from "node:assert/strict";

import { buildTemperaturePath } from "../public/js/intel/temperature-path.js";

function hour(iso, temperatureF) {
  return { timestamp: new Date(iso).getTime(), temperatureF };
}

test("morning slots use the correct Asheville local forecast hours", () => {
  const now = new Date("2026-08-06T13:00:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-08-06T13:00:00Z", 70),
    hour("2026-08-06T19:00:00Z", 82),
    hour("2026-08-07T01:00:00Z", 73)
  ], [], hour("2026-08-06T13:00:00Z", 70), { now });
  assert.deepEqual(result.slots.map((slot) => slot.label), ["Now", "3 PM", "9 PM"]);
  assert.deepEqual(result.slots.map((slot) => slot.hour.temperatureF), [70, 82, 73]);
});

test("evening slots cross midnight with explicit Tomorrow labels", () => {
  const now = new Date("2026-08-06T23:00:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-08-06T23:00:00Z", 78),
    hour("2026-08-07T02:00:00Z", 72),
    hour("2026-08-07T12:00:00Z", 66)
  ], [], hour("2026-08-06T23:00:00Z", 78), { now });
  assert.deepEqual(result.slots.map((slot) => slot.label), ["Now", "10 PM", "Tomorrow 8 AM"]);
});

test("a checkpoint less than ninety minutes away is skipped", () => {
  const now = new Date("2026-08-07T00:45:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-08-07T00:45:00Z", 75),
    hour("2026-08-07T02:00:00Z", 72),
    hour("2026-08-07T12:00:00Z", 66),
    hour("2026-08-07T19:00:00Z", 80)
  ], [], hour("2026-08-07T00:45:00Z", 75), { now });
  assert.deepEqual(result.slots.map((slot) => slot.label), ["Now", "Tomorrow 8 AM", "Tomorrow 3 PM"]);
});

test("DST transition dates still match Asheville wall-clock hours", () => {
  const now = new Date("2026-03-08T08:30:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-03-08T08:30:00Z", 43),
    hour("2026-03-08T12:00:00Z", 49),
    hour("2026-03-08T19:00:00Z", 61)
  ], [], hour("2026-03-08T08:30:00Z", 43), { now });
  assert.deepEqual(result.slots.map((slot) => slot.label), ["Now", "8 AM", "3 PM"]);
});

test("rapid warming receives the highest-priority emoji callout", () => {
  const now = new Date("2026-08-06T13:00:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-08-06T13:00:00Z", 68),
    hour("2026-08-06T16:00:00Z", 78),
    hour("2026-08-06T19:00:00Z", 86),
    hour("2026-08-07T01:00:00Z", 75)
  ], [{ date: "2026-08-06", tempMax: 98 }], hour("2026-08-06T13:00:00Z", 68), { now });
  assert.equal(result.callout.emoji, "📈");
  assert.match(result.callout.text, /10° over the next 3 hours/);
});

test("rapid cooling receives a falling-temperature emoji callout", () => {
  const now = new Date("2026-10-15T19:00:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-10-15T19:00:00Z", 78),
    hour("2026-10-15T22:00:00Z", 68),
    hour("2026-10-16T02:00:00Z", 61),
    hour("2026-10-16T12:00:00Z", 52)
  ], [], hour("2026-10-15T19:00:00Z", 78), { now });
  assert.equal(result.callout.emoji, "📉");
  assert.match(result.callout.text, /Cooling quickly/);
});

test("large departures from the daily normal receive seasonal context", () => {
  const now = new Date("2026-08-06T16:00:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-08-06T16:00:00Z", 88),
    hour("2026-08-06T19:00:00Z", 94),
    hour("2026-08-07T01:00:00Z", 86)
  ], [{ date: "2026-08-06", tempMax: 98 }], hour("2026-08-06T16:00:00Z", 88), { now });
  assert.equal(result.callout.emoji, "🔥");
  assert.match(result.callout.text, /warmer than normal/);
});

test("an unusually cold upcoming night receives clothing context", () => {
  const now = new Date("2026-12-01T00:00:00Z").getTime();
  const result = buildTemperaturePath([
    hour("2026-12-01T00:00:00Z", 40),
    hour("2026-12-01T03:00:00Z", 37),
    hour("2026-12-01T13:00:00Z", 20),
    hour("2026-12-01T20:00:00Z", 42)
  ], [], hour("2026-12-01T00:00:00Z", 40), { now });
  assert.equal(result.callout.emoji, "🧥");
  assert.match(result.callout.text, /colder than normal/);
});
