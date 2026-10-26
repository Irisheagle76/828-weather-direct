import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFoliageConsequences, estimateFoliageStage } from "../public/js/fall/foliage-consequences.js";
import { summarizeTemperatureHistory, coldPeriod, elevationBand } from "../public/js/fall/temperature-history.js";
import { buildSeasonOutlook } from "../public/js/fall/season-outlook.js";
import { buildFallIntelligence } from "../public/js/fall/intelligence.js";
import { renderFallExplorer } from "../public/js/fall/render.js";

const HOUR = 3600000;
const now = Date.parse("2026-10-19T16:00:00-04:00");
const early = Date.parse("2026-10-05T16:00:00-04:00");
const forecast = (at, temperatureF = 40, length = 168) => Array.from({ length }, (_, i) => ({ timestamp: at + i * HOUR, temperatureF, windGust: 10, windSpeed: 5, cloudCover: 0.2, precipitation: 0, precipProbability: 0 }));
const site = (at = now, elevationFeet = 2400) => ({ id: "test", name: "Test", elevationFeet, hourly: forecast(at) });
const assess = (s, at = now, extra = {}) => analyzeFoliageConsequences(s, { now: at, ...extra });
const sample = (extra = {}) => ({ stationId: "ridge", destinationId: "graveyard", elevationFeet: 5120, observedAt: "2026-10-19T06:00:00-04:00", observedTemperatureF: 31, effectiveWeight: 1, healthStatus: "healthy", ...extra });

 test("the same sustained freeze produces arrest before peak and degradation after peak", () => {
  const before = site(early);
  before.hourly.slice(12, 18).forEach(h => h.temperatureF = 27);
  const after = site(now, 5500);
  after.hourly.slice(12, 18).forEach(h => h.temperatureF = 27);
  assert.equal(assess(before, early).primaryCategory, "Color Arrest");
  assert.equal(assess(after).primaryCategory, "Color Degradation");
});

test("sunny cool nights favor enhancement; sharp cooling favors acceleration", () => {
  const s = site(early);
  assert.equal(assess(s, early).primaryCategory, "Color Enhancement");
  s.hourly.slice(0, 24).forEach(h => h.temperatureF = 60);
  const result = assess(s, early);
  assert.equal(result.primaryCategory, "Color Acceleration");
  assert.ok(result.diagnostics.coolingF >= 10);
});

test("calm weather favors retention at an estimated mature stage, not a verified peak claim", () => {
  const result = assess(site());
  assert.equal(result.primaryCategory, "Color Preservation");
  assert.equal(result.label, "Color Retention Favored");
  assert.equal(result.confidence, "Low");
  assert.match(result.visualResult, /does not establish that peak/);
  assert.match(result.missingInputs.join(" "), /Drought/);
});

test("one first-freeze milestone does not automatically diagnose damage", () => {
  const payload = { destinations: [site()], milestones: { season: 2026, bands: [{ elevationBand: "2000-3000", first32: { date: "2026-10-18" } }] } };
  const result = buildSeasonOutlook(payload, { now });
  assert.equal(result.cards[0].consequence.primaryCategory, "Color Preservation");
  assert.equal(result.cards[0].exposed, true);
  assert.match(result.cards[0].milestoneText, /does not establish damage/);
});

test("winds after a freeze elevate leaf-loss concern; winds before it do not imply the same sequence", () => {
  const before = site(early);
  before.hourly.slice(12, 18).forEach(h => h.temperatureF = 27);
  before.hourly[4].windGust = 35;
  const after = structuredClone(before);
  after.hourly[4].windGust = 10;
  after.hourly[20].windGust = 35;
  assert.equal(assess(before, early).primaryCategory, "Color Arrest");
  assert.equal(assess(after, early).primaryCategory, "Premature Leaf Drop");
  assert.equal(assess(after, early).diagnostics.afterColdGust, 35);
});

test("rain duration and mature stage combine to favor leaf loss", () => {
  const s = site();
  s.hourly.slice(20, 26).forEach(h => h.precipitation = 0.15);
  assert.equal(assess(s).primaryCategory, "Premature Leaf Drop");
  assert.equal(assess(s).diagnostics.wetRun, 6);
});

test("isolated cold readings and gaps do not imply prolonged freezing", () => {
  const s = site(early);
  s.hourly[12].temperatureF = 25;
  s.hourly[14].temperatureF = 25;
  const result = assess(s, early);
  assert.equal(result.diagnostics.hardRun, 1);
  assert.notEqual(result.primaryCategory, "Color Arrest");
  assert.notEqual(result.primaryCategory, "Season Shutdown");
});

test("compound extreme weather can reset the outlook; shutdown additionally requires late stage and repetition", () => {
  const s = site(early);
  s.hourly.slice(0, 12).forEach(h => { h.temperatureF = 19; h.windGust = 45; });
  assert.equal(assess(s, early).primaryCategory, "Foliage Reset Event");
  const late = site(now, 5500);
  late.hourly.forEach(h => { h.temperatureF = 19; h.windGust = 45; });
  const ending = assess(late);
  assert.equal(ending.primaryCategory, "Season Shutdown");
  assert.match(ending.reasoning, /forecast risk/);
  assert.equal(ending.label, "Season Ending Risk");
});

test("ridge leaf loss and valley acceleration produce one regional patchy-elevation category", () => {
  const ridge = { ...site(early, 5500), id: "craggy", name: "Craggy Gardens" };
  ridge.hourly.slice(12, 18).forEach(h => h.temperatureF = 27);
  ridge.hourly[20].windGust = 35;
  const valley = { ...site(early, 2200), id: "valley-fixture", name: "Valley fixture" };
  valley.hourly.slice(0, 24).forEach(h => h.temperatureF = 60);
  const result = buildSeasonOutlook({ destinations: [ridge, valley] }, { now: early });
  assert.equal(result.cards[0].consequence.primaryCategory, "Premature Leaf Drop");
  assert.equal(result.cards[1].consequence.primaryCategory, "Color Acceleration");
  assert.equal(result.regional.primaryCategory, "Patchy Elevation Impacts");
});

test("a single mountain reset cannot be presented as a widespread regional reset", () => {
  const ridge = { ...site(early, 5500), id: "ridge" };
  ridge.hourly.slice(0, 12).forEach(h => { h.temperatureF = 19; h.windGust = 45; });
  const result = buildSeasonOutlook({ destinations: [ridge, { ...site(early), id: "valley" }] }, { now: early });
  assert.equal(result.regional.primaryCategory, "Patchy Elevation Impacts");
});

test("stale or sparse forecasts abstain; shorter horizons disclose missing days", () => {
  assert.equal(assess(site(), now, { stale: true }).primaryCategory, null);
  const s = site(); s.hourly = s.hourly.slice(0, 24);
  assert.equal(assess(s).primaryCategory, null);
  s.hourly = forecast(now, 40, 120);
  assert.match(assess(s).outlook7Days, /seven-day outlook is incomplete/);
  assert.match(assess(site()).outlook7Days, /weather-based outlook/);
});

test("stage estimate is automatic, low-confidence and not the Boone regression", () => {
  const upper = estimateFoliageStage(site(now, 5500), now);
  const lower = estimateFoliageStage(site(), now);
  assert.equal(upper.value, "post-peak"); assert.equal(lower.value, "near peak");
  assert.equal(upper.confidence, "Low"); assert.match(upper.basis, /not an observed/);
});

test("temperature history deduplicates stations, rejects suspect data and respects actual elevation", () => {
  const samples = [sample(), sample(), sample({ stationId: "second", observedTemperatureF: 27 }), sample({ observedTemperatureF: null }), sample({ healthStatus: "suspect" }), sample({ elevationFeet: 3500, destinationId: "mitchell", stationId: "approach" })];
  const history = summarizeTemperatureHistory([{ samples }], { now });
  const band = history.bands.find(b => b.id === "5000-6000");
  assert.equal(band.samples, 2); assert.equal(band.freezePeriods, 1); assert.equal(band.hardFreezePeriods, 1);
  assert.equal(elevationBand({ destinationId: "mitchell", elevationFeet: 3500 }), "3000-4000");
  assert.equal(coldPeriod(Date.parse("2026-11-01T01:30:00-04:00")), coldPeriod(Date.parse("2026-11-01T01:30:00-05:00")));
});

test("destination details retain trip advice and forecast evidence", () => {
  const current = Date.now(); const s = site(current);
  s.name = "<script>bad</script>";
  const elements = new Map(), previous = globalThis.document;
  globalThis.document = { body: { classList: { remove() {} } }, querySelector(selector) { if (selector.startsWith("[data-camera")) return null; if (!elements.has(selector)) elements.set(selector, {}); return elements.get(selector); } };
  try {
    const model = buildFallIntelligence({ destinations: [s] });
    renderFallExplorer(model);
    assert.ok(model.seasonOutlook.cards[0].label.split(/\s+/).length <= 4);
    assert.match(elements.get("#remainingColor").innerHTML, /&lt;script&gt;/);
    assert.match(elements.get("#remainingColor").innerHTML, /Plan your visit:/);
    assert.match(elements.get("#remainingColor").innerHTML, /Forecast through/);
  } finally { globalThis.document = previous; }
});
