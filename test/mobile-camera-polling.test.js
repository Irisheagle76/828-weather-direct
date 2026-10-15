import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCameraFailures} from '../public/mobile/live-look.js';
test('foreground polling swaps only loaded captures and retains old image on failure',async()=>{
 const keys=['fetch','document','Image','setInterval','clearInterval'];
 const originals=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 let poll,fail=false,requests=0;
 const label={textContent:'Checking capture time…'},fallback={hidden:true};
 const image={dataset:{},isConnected:true,src:'old.jpg',parentElement:{querySelector:()=>fallback}};
 let status={observedAt:new Date().toISOString(),sha256:'first',status:'ok'};
 const root={isConnected:true,closest:()=>({hidden:false}),querySelectorAll:()=>[],querySelector:selector=>selector==='.snapshot-time'?label:image};
 try{
  globalThis.document={hidden:false};
  globalThis.fetch=async()=>{requests++;if(fail)throw Error('offline');return {ok:true,json:async()=>status};};
  globalThis.Image=class {set src(value){queueMicrotask(()=>this.onload());}};
  globalThis.setInterval=fn=>{poll=fn;return 1;};globalThis.clearInterval=()=>{};
  bindCameraFailures(root);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(image.src,/first/);assert.match(label.textContent,/Captured/);
  const old=image.src,oldLabel=label.textContent;
  fail=true;poll();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(image.src,old);assert.equal(label.textContent,oldLabel);
  document.hidden=true;const count=requests;poll();assert.equal(requests,count);
 }finally{for(const key of keys){if(originals[key]===undefined)delete globalThis[key];else globalThis[key]=originals[key];}}
});
