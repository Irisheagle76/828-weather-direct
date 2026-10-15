import test from 'node:test';
import assert from 'node:assert/strict';
import {saveNativeDevice,authorizedDevice,NATIVE_DEVICES} from '../lib/notifications/native-store.js';
import {nativeMessage,deliverNative,firebaseConfig} from '../lib/notifications/native-send.js';
const input={installationId:'12345678-1234-1234-1234-123456789abc',secret:'a'.repeat(64),token:'device-token-'.repeat(5),preferences:{alerts:false,pulse:true}};
test('device secrets authorize updates and opt-out persists without plaintext secrets',async()=>{
 const records=new Map();const client={hget:async(_k,id)=>records.get(id),hset:async(key,items)=>{assert.equal(key,NATIVE_DEVICES);for(const [id,value] of Object.entries(items))records.set(id,value);}};
 const saved=await saveNativeDevice(input,client);
 assert.equal(authorizedDevice(saved,input.secret),true);assert.equal(authorizedDevice(saved,'b'.repeat(64)),false);
 assert.equal(JSON.stringify(saved).includes(input.secret),false);
 await assert.rejects(saveNativeDevice({...input,secret:'b'.repeat(64)},client),/unauthorized/);
 const off=await saveNativeDevice({...input,preferences:{alerts:false,pulse:false}},client);
 assert.deepEqual(off.preferences,{alerts:false,pulse:false});
});
test('native payload preserves Pulse destination, units and notification channel',()=>{
 const message=nativeMessage(input,{title:'828 Pulse Updates',body:'Test'},'pulse');
 assert.equal(message.data.destination,'pulse');
 assert.equal(message.android.notification.channelId,'828-pulse');
 assert.equal(message.android.ttl,21600000);
 assert.equal(nativeMessage(input,{title:'Bulletin'},'alerts').android.priority,'high');
});
test('native delivery counts provider acceptance and prunes only unregistered tokens',async()=>{
 const removed=[];let count=0;
 const result=await deliverNative([input,{...input,installationId:'expired'}],{title:'Test'},'pulse',{send:async()=>{if(++count===2)throw Object.assign(Error('expired'),{code:'messaging/registration-token-not-registered'});},remove:async id=>removed.push(id)});
 assert.equal(result.sent,1);assert.equal(result.failed,1);assert.deepEqual(removed,['expired']);
 assert.equal(firebaseConfig(),null);
});
