import test from "node:test";
import assert from "node:assert/strict";
import { findBestWindow, buildFallIntelligence } from "../public/js/fall/intelligence.js";
import { scoreFallHours } from "../public/js/fall/scoring.js";
import { seasonalPeakTimingInput } from "../lib/api-routes/fall.js";
import { estimatePeakTiming } from "../public/js/fall/peak-timing.js";
import { CAMERAS } from "../public/js/fall/config.js";
const at = value => Date.parse(value);
function hoursFor(day, offset, sunsetTime) {
  const sunrise = at(day + "T07:30:00" + offset);
  const sunset = at(day + "T" + sunsetTime + offset);
  return Array.from({length: 17}, (_, i) => ({timestamp: at(day + "T" + String(i+6).padStart(2,"0") + ":00:00" + offset), sunrise, sunset, temperatureF: 62, cloudCover: i < 11 ? .7 : .1, windSpeed: 5, windGust: 8, precipProbability: 0}));
}
for (const [day, offset, sunset] of [["2026-10-17","-04:00","18:50:00"], ["2026-11-01","-05:00","17:30:00"]]) {
 test("viewing stops at sunset on " + day, () => {
   const hours = hoursFor(day,offset,sunset);
   const result = findBestWindow(hours, at(day + "T15:00:00" + offset));
   assert.ok(result.available);
   assert.ok(result.end <= hours[0].sunset);
   assert.ok(result.start >= hours[0].sunrise);
   assert.match(result.photoLabel, /sunset.*twilight/);
 });
}
test("late-day window starts now and preserves only remaining daylight", () => {
 const hours = hoursFor("2026-10-17","-04:00","18:50:00");
 const now = at("2026-10-17T18:40:00-04:00");
 const result = findBestWindow(hours,now);
 assert.equal(result.start,now);
 assert.equal(result.end,hours[0].sunset);
});
test("after sunset offers twilight photography without claiming daylight", () => {
 const hours = hoursFor("2026-10-17","-04:00","18:50:00");
 const result = findBestWindow(hours,at("2026-10-17T18:55:00-04:00"));
 assert.equal(result.available,false);
 assert.equal(result.label,"Daylight window has passed");
 assert.match(result.photoLabel,/6:55 PM–7:05 PM/);
 assert.equal(findBestWindow(hours,at("2026-10-17T19:06:00-04:00")).photoLabel,"Sunset photo window has passed");
});
test("missing solar fields never invent a viewing window", () => {
 assert.equal(findBestWindow([{timestamp:at("2026-10-17T19:00:00-04:00")}]).label,"Daylight timing unavailable");
});
test("better nighttime weather does not inflate daylight score", () => {
 const hours = hoursFor("2026-11-01","-05:00","17:30:00");
 const daylight = hours.filter(h=>h.timestamp < h.sunset && h.timestamp+3600000>h.sunrise);
 assert.equal(scoreFallHours(hours).score,scoreFallHours(daylight).score);
 assert.equal(scoreFallHours(hours.filter(h=>h.timestamp>=h.sunset)).available,false);
});
test("after-dark forecasts render unavailable daylight guidance instead of failing the page", () => {
 const now = at("2026-10-17T20:00:00-04:00");
 const hourly = hoursFor("2026-10-17","-04:00","18:50:00").filter(h=>h.timestamp>=now);
 const model = buildFallIntelligence({destinations:[{id:"asheville",name:"Asheville",elevationFeet:2134,hourly}],peakTiming:{seasonYear:2026}},null,{now});
 assert.equal(model.today.score,null);
 assert.equal(model.recommendations.bestBet.window,"Daylight window has passed");
 assert.match(model.today.summary,/Daylight guidance/);
});
test("seasonal input requires this year and a completed September", () => {
 const env={FALL_SEPTEMBER_MEAN_F:"66.7",FALL_SEPTEMBER_MEAN_YEAR:"2026",FALL_SEPTEMBER_MEAN_SOURCE:"Verified reference"};
 assert.equal(seasonalPeakTimingInput(at("2026-10-05T12:00:00Z"),env).septemberMeanF,66.7);
 for(const now of ["2026-09-30T12:00:00Z","2027-10-05T12:00:00Z"]) assert.equal(seasonalPeakTimingInput(at(now),env).septemberMeanF,null);
 assert.equal(seasonalPeakTimingInput(at("2026-10-05T12:00:00Z"),{FALL_SEPTEMBER_MEAN_F:"66.7"}).septemberMeanF,null);
});
test("baseline headline clearly distinguishes seasonal temperature adjustment", () => {
 assert.equal(estimatePeakTiming().headline,"Historical midpoint near");
 assert.match(estimatePeakTiming().seasonalNote,/has not been incorporated/);
 assert.equal(estimatePeakTiming({septemberMeanF:66.7}).headline,"Temperature-adjusted midpoint near");
});
test("Pisgah uses the verified official hosted-stream page", () => {
 const camera=CAMERAS.find(c=>c.id==="pisgah");
 assert.equal(camera.imageUrl,null);
 assert.equal(camera.sourceUrl,"https://www.pisgahinn.com/live-video-camera/");
});
