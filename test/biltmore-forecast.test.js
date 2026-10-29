import test from 'node:test';
import assert from 'node:assert/strict';
import {parseForecast,forecastSummary} from '../public/js/biltmore/forecast.js';
test('official forecast keeps zero, rejects null, sorts dates and enforces feet',()=>{
 const d={primaryName:'Stage',primaryUnits:'ft',issuedTime:'2026-09-14T12:00:00Z',data:[{validTime:'2026-09-15T00:00:00Z',primary:1},{validTime:'2026-09-14T18:00:00Z',primary:0},{validTime:'2026-09-14T16:00:00Z',primary:null}]};
 assert.deepEqual(parseForecast(d).points.map(p=>p.v),[0,1]);assert.throws(()=>parseForecast({...d,primaryUnits:'m'}));
});
test('flat guidance has no distinct crest; stale and expired guidance remain explicit',()=>{
 const now=Date.parse('2026-09-14T12:00:00Z'),f={issuedTime:'2026-09-14T10:00:00Z',points:[{t:now+3600000,v:1.3},{t:now+7200000,v:1.3}]};
 assert.equal(forecastSummary(f,now).flat,true);assert.equal(forecastSummary({...f,issuedTime:'2026-09-12T00:00:00Z'},now).stale,true);assert.equal(forecastSummary(f,now+86400000).unavailable,true);
});
