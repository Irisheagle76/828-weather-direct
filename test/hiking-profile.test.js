import assert from "node:assert/strict";
import test from "node:test";
import { MAX_PROFILE_STATIONS, selectHikingProfileStations } from "../public/js/hiking-profile.js";
import { OBSERVATION_STATIONS } from "../lib/observations/registry.js";

const sites = () => OBSERVATION_STATIONS.filter(s => !s.componentOnly && s.enabled !== false).map(s => ({ ...s, temperatureF: 60, health: { usable: true } }));

test("active public network keeps a ten-site elevation profile with owner, added Asheville, and summit references", () => {
  const all = sites();
  const selected = selectHikingProfileStations(all);
  assert.equal(all.length, 11);
  assert.equal(selected.length, MAX_PROFILE_STATIONS);
  assert.equal(new Set(selected.map(s => s.id)).size, MAX_PROFILE_STATIONS);
  for (const id of ["tempest-144737", "tempest-127602", "nws-kavl", "econet-bear", "frying-pan-pisgah-ridgeline", "mount-mitchell"]) assert.ok(selected.some(s => s.id === id));
  assert.deepEqual(selected.map(s => s.elevationFt), selected.map(s => s.elevationFt).sort((a, b) => a - b));
  assert.equal(all.length, 11, "profile selection does not remove station cards or guidance inputs");
});

test("profile excludes unavailable readings and fills missing references with usable distinct elevations", () => {
  const all = sites().map(s => s.id === "mount-mitchell" ? { ...s, health: { usable: false } } : s.id === "tempest-144737" ? { ...s, temperatureF: null } : s);
  const selected = selectHikingProfileStations(all);
  assert.equal(selected.length, 9);
  assert.ok(selected.every(s => s.health.usable && Number.isFinite(s.temperatureF)));
  assert.ok(!selected.some(s => s.id === "mount-mitchell" || s.id === "tempest-144737"));
  assert.deepEqual(selectHikingProfileStations([]), []);
});

test("Archived WU stations retain their supplied physical-site identity and no non-owned Tempest remains", () => {
  const expected = { "park-place": ["KNCWAYNE323", 4209], "alpine-village": ["KNCBURNS167", 3260], "cold-mountain-station": ["KNCCANTO128", 3445], "camp-daniel-boone": ["KNCCANTO127", 3257], "wallace-mountain": ["KNCBLACK209", 2625], "lake-junaluska": ["KNCLAKEJ3", 2657], "webb-weather": ["KNCASHEV482", 3000], "windy-ridge-trail": ["KNCASHEV440", 3209], "beaucatcher-mountain": ["KNCASHEV288", 2550], "spivey-mountain": ["KNCASHEV307", 3110] };
  for (const [id, [stationId, elevation]] of Object.entries(expected)) {
    const site = OBSERVATION_STATIONS.find(s => s.id === id);
    assert.equal(site.provider, "wunderground");
    assert.equal(site.providerStationId, stationId);
    assert.equal(site.elevationFt, elevation);
    assert.match(site.url, new RegExp(stationId + "$"));
  }
  assert.deepEqual(OBSERVATION_STATIONS.filter(s => s.provider === "tempest").map(s => s.providerStationId), ["237451", "144737", "127602"]);
  assert.equal(OBSERVATION_STATIONS.find(s => s.id === "windy-ridge-trail").latitude, 35.666);
});
