import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeHandler} from '../lib/api-routes/notifications/native.js';
import {secretHash} from '../lib/notifications/native-store.js';
import {sendToAudience} from '../lib/notifications/audience.js';
const id='12345678-1234-1234-1234-123456789abc',secret='a'.repeat(64);
async function request(body,overrides={},method='POST'){
 const sends=[];
 const handler=createNativeHandler({config:()=>({}),client:{set:async()=>true},save:async()=>{},get:async()=>({installationId:id,secretHash:secretHash(secret),preferences:{pulse:true}}),deliver:async(devices,payload,topic)=>{sends.push({devices,payload,topic});return {sent:1};},...overrides});
 const res={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await handler({method,body},res);return {...res,sends};
}
test('native device tests target one authenticated installation and open Pulse',async()=>{
 const result=await request({action:'test',installationId:id,secret});
 assert.equal(result.code,200);assert.equal(result.sends.length,1);
 assert.equal(result.sends[0].devices.length,1);assert.equal(result.sends[0].topic,'pulse');
});
test('native endpoint rejects unconfigured, unauthorized, opted-out and repeated tests',async()=>{
 for(const [overrides,body,expected] of [
  [{config:()=>null},{},503],
  [{},{action:'test',installationId:id,secret:'wrong'},403],
  [{get:async()=>({secretHash:secretHash(secret),preferences:{alerts:false,pulse:false}})},{action:'test',installationId:id,secret},403],
  [{client:{set:async()=>null}},{action:'test',installationId:id,secret},429],
  [{},{action:'invalid'},400]
 ]){
  const result=await request(body,overrides);assert.equal(result.code,expected);assert.equal(result.sends.length,0);
 }
});
test('shared admin audience counts web and native results without changing topic',async()=>{
 const calls=[];const result=await sendToAudience({title:'Pulse'},{topic:'pulse'},{
  webSend:async(_payload,options)=>{calls.push(options.topic);return {attempted:1,sent:1,failed:0,skipped:false};},
  nativeSend:async(_payload,options)=>{calls.push(options.topic);return {attempted:2,sent:1,failed:1,skipped:false};}
 });
 assert.deepEqual(calls,['pulse','pulse']);assert.equal(result.sent,2);assert.equal(result.failed,1);assert.equal(result.attempted,3);
});
