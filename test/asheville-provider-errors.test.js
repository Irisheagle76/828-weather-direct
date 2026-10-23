import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWunderground } from '../lib/asheville-spread/providers.js';
import { buildAshevilleSpread } from '../lib/asheville-spread/service.js';
test('provider distinguishes throttling from rejected access without exposing response secrets', async () => {
  for (const [status,body,code] of [[401,'API key is throttled','upstream_throttled'],[429,'limit','upstream_throttled'],[401,'invalid secret-value','upstream_unauthorized'],[403,'forbidden secret-value','upstream_unauthorized'],[500,'error','upstream_http']]) {
    const fetcher=()=>fetchWunderground({source:{stationId:'TEST'}},{env:{WU_API_KEY:'secret-value'},fetchImpl:async()=>({ok:false,status,text:async()=>body})});
    const payload=await buildAshevilleSpread({stations:[{id:'test',name:'Test',latitude:35.6,longitude:-82.5,aliases:[],enabled:true,source:{provider:'wunderground',stationId:'TEST'}}],fetcher});
    assert.deepEqual(payload.stations[0].quality.flags,[code]);
    assert.equal(JSON.stringify(payload).includes('secret-value'),false);
  }
});
