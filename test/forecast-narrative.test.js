import test from "node:test";
import assert from "node:assert/strict";
import { language } from "../lib/forecast/generate.js";

function stormDay(overrides = {}) {
  return {
    storm: true,
    severe: false,
    maxPop: 45,
    high: 71,
    bestWindow: "Evening",
    index: 3,
    rainStart: "2026-09-24T15:00:00-04:00",
    ...overrides
  };
}

test("a 71 degree storm day is described as mild rather than summer heat", () => {
  const story = language(stormDay());
  assert.match(story.headline, /mild/i);
  assert.match(story.narrative, /mild high near 71/i);
  assert.doesNotMatch(`${story.headline} ${story.narrative}`, /summer heat|warm sunshine|afternoon heating/i);
});

test("automatic storm narrative uses the calculated best window", () => {
  const story = language(stormDay({ bestWindow: "Evening" }));
  assert.match(story.narrative, /evening has the more favorable signal/i);
  assert.doesNotMatch(story.narrative, /morning currently looks quieter/i);
});

test("hot storm days can still lead with heat", () => {
  const story = language(stormDay({ high: 91, bestWindow: "Morning", index: 0 }));
  assert.match(story.headline, /heat/i);
  assert.match(story.narrative, /around 91/i);
});

test("storm timing follows the forecast instead of the day position", () => {
  const story = language(stormDay({ rainStart: "2026-09-24T09:00:00-04:00" }));
  assert.match(`${story.headline} ${story.narrative}`, /morning/i);
  assert.doesNotMatch(story.headline, /later/i);
});

test("a 2 PM storm window is described as afternoon", () => {
  const story = language(stormDay({ rainStart: "2026-09-24T14:00:00-04:00" }));
  assert.match(`${story.headline} ${story.narrative}`, /afternoon/i);
  assert.doesNotMatch(`${story.headline} ${story.narrative}`, /midday/i);
});

test("every forecast-card position keeps a 71 degree day mild", () => {
  for (let index = 0; index < 4; index += 1) {
    const story = language(stormDay({ index }));
    const text = `${story.headline} ${story.narrative}`;
    assert.match(text, /mild/i, `card position ${index + 1} should read as mild`);
    assert.doesNotMatch(text, /summer heat|hot day|afternoon heat/i, `card position ${index + 1} should not invent heat`);
  }
});

test("calendar weekday does not determine the weather story", () => {
  const dates = [
    "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
    "2026-09-25", "2026-09-26", "2026-09-27"
  ];
  for (const [index, date] of dates.entries()) {
    const story = language(stormDay({ date, index: index % 4 }));
    assert.match(`${story.headline} ${story.narrative}`, /mild/i, `${date} should follow its 71 degree high`);
    assert.doesNotMatch(`${story.headline} ${story.narrative}`, /summer heat|hot day|afternoon heat/i);
  }
});

test("temperature wording remains accurate across cool, mild, warm, and hot days", () => {
  const cases = [
    { high: 64, expected: /cool/i, excluded: /mild|warm day|heat/i },
    { high: 71, expected: /mild/i, excluded: /warm day|heat/i },
    { high: 82, expected: /warm/i, excluded: /mild|heat/i },
    { high: 91, expected: /heat|hot/i, excluded: /mild|cool/i }
  ];
  for (const [index, item] of cases.entries()) {
    const story = language(stormDay({ high: item.high, index }));
    const text = `${story.headline} ${story.narrative}`;
    assert.match(text, item.expected);
    assert.doesNotMatch(text, item.excluded);
  }
});
