import assert from "node:assert/strict";
import test from "node:test";

import { mergePublishedTomorrowSummary } from "../public/js/intel/tomorrow-published.js";

const NOW = Date.parse("2026-08-11T12:00:00-04:00");

test("published tomorrow fields override the model summary by date", () => {
  const model = {
    score: 74,
    high: 83,
    low: 67,
    rainChance: 0.13,
    headline: "No major weather disruptions stand out tomorrow.",
    narrative: "Model narrative.",
    diagnostics: { model: "open-meteo" }
  };
  const forecast = {
    lastUpdated: "2026-08-11T14:02:06.673Z",
    source: "manual-composer",
    global: { overrideNarrative: true },
    days: {
      "2026-08-12": {
        date: "2026-08-12",
        headline: "Hot and humid—take it easy outside",
        narrative: "Temperatures approach 90° with a muggy feel.",
        high: 90,
        low: 68,
        rainChance: 30,
        feelScore: null,
        sky: "partly_cloudy"
      }
    }
  };

  const summary = mergePublishedTomorrowSummary(model, forecast, NOW);

  assert.equal(summary.high, 90);
  assert.equal(summary.low, 68);
  assert.equal(summary.rainChance, 0.3);
  assert.equal(summary.score, 74);
  assert.equal(summary.headline, "Hot and humid—take it easy outside");
  assert.equal(summary.narrative, "Temperatures approach 90° with a muggy feel.");
  assert.equal(summary.icon, "⛅");
  assert.equal(summary.diagnostics.publishedOverride, true);
});

test("blank published fields preserve model fallbacks", () => {
  const model = {
    score: 71,
    high: 86,
    low: 66,
    rainChance: 0.2,
    headline: "Warm and muggy again tomorrow.",
    narrative: "Model narrative."
  };
  const forecast = {
    global: { overrideNarrative: true },
    days: {
      "2026-08-12": {
        date: "2026-08-12",
        headline: "",
        narrative: null,
        high: null,
        low: "",
        rainChance: null
      }
    }
  };

  assert.deepEqual(
    mergePublishedTomorrowSummary(model, forecast, NOW),
    {
      ...model,
      diagnostics: {
        publishedOverride: true,
        publishedFields: [],
        publishedAt: null,
        publicationSource: null
      }
    }
  );
});

test("a stale published date never overrides tomorrow", () => {
  const model = { high: 83, headline: "Model" };
  const forecast = {
    days: {
      "2026-08-11": { date: "2026-08-11", high: 95, headline: "Stale" }
    }
  };

  assert.strictEqual(mergePublishedTomorrowSummary(model, forecast, NOW), model);
});

test("tomorrow uses the Asheville calendar across the spring DST transition", () => {
  const lateSaturday = Date.parse("2026-03-07T23:30:00-05:00");
  const model = { high: 70 };
  const forecast = {
    days: {
      "2026-03-08": { date: "2026-03-08", high: 75 }
    }
  };

  assert.equal(mergePublishedTomorrowSummary(model, forecast, lateSaturday).high, 75);
});

test("an authored emoji wins over the published sky fallback", () => {
  const forecast = {
    days: {
      "2026-08-12": {
        date: "2026-08-12",
        icon: "🥵",
        sky: "partly_cloudy"
      }
    }
  };

  assert.equal(mergePublishedTomorrowSummary({ icon: "☀️" }, forecast, NOW).icon, "🥵");
});
