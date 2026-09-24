import test from "node:test";
import assert from "node:assert/strict";
import { comfortTimeBuckets, bestComfortWindow } from "../public/js/intel/comfort-time-buckets.js";
const now = Date.parse("2026-09-15T21:30:00Z");
const make = (hour,temp=75) => ({timestamp:Date.parse(`2026-09-16T${String(hour+4).padStart(2,"0")}:00:00Z`),temperatureF:temp,dewpointF:60,windSpeed:3,cloudCover:.2});
test("four Eastern windows exclude their end timestamps",()=>{
  const buckets=comfortTimeBuckets([make(5),make(8),make(9),make(12),make(14,90),make(15),make(17),make(19)],"2026-09-16",now);
  assert.deepEqual(buckets.map(b=>b.count),[2,2,2,0]);
  assert.match(buckets[1].takeaway,/Heat/);
  assert.equal(buckets[1].min<=buckets[1].max,true);
});
test("today collapses elapsed windows without inventing history",()=>{
  const buckets=comfortTimeBuckets([],"2026-09-15",now);
  assert.deepEqual(buckets.map(b=>b.passed),[true,true,false,false]);
  assert.equal(buckets[2].partial,true);
  assert.equal(bestComfortWindow(buckets),null);
});
test("best window needs contiguous hours and uses weakest score",()=>{
  const candidates=[{name:"Morning",points:[{hour:{timestamp:1000},score:9},{hour:{timestamp:3601000},score:8}]},{name:"Evening",points:[{hour:{timestamp:10000000},score:10},{hour:{timestamp:17200000},score:10}]}];
  assert.equal(bestComfortWindow(candidates).name,"Morning");
  assert.equal(bestComfortWindow(candidates).min,80);
});
test("midnight belongs to following day, not late-night window",()=>{
  const buckets=comfortTimeBuckets([{...make(5),timestamp:Date.parse("2026-09-17T03:00:00Z")},{...make(5),timestamp:Date.parse("2026-09-17T04:00:00Z")}],"2026-09-16",now);
  assert.equal(buckets[3].count,1);
  assert.equal(bestComfortWindow(buckets),null);
});
