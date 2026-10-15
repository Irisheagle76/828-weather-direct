import { createHash, timingSafeEqual } from 'node:crypto';
import { kv } from '@vercel/kv';
export const NATIVE_DEVICES='notifications:native:android:v1';
export const secretHash=value=>createHash('sha256').update(value).digest('hex');
export function authorizedDevice(record,secret){
  if(!record || typeof secret!=='string')return false;
  const expected=Buffer.from(record.secretHash,'hex'),actual=Buffer.from(secretHash(secret),'hex');
  return expected.length===actual.length && timingSafeEqual(expected,actual);
}
export async function saveNativeDevice(input,client=kv){
  const {installationId,secret,token,preferences}=input || {};
  if(!/^[a-f0-9-]{36}$/.test(installationId || '') || !/^[a-f0-9]{64}$/.test(secret || '') || typeof token!=='string' || token.length<20 || token.length>4096)throw Error('invalid-device');
  const previous=await client.hget(NATIVE_DEVICES,installationId);
  if(previous && !authorizedDevice(previous,secret))throw Error('unauthorized-device');
  const record={installationId,secretHash:secretHash(secret),token,platform:'android',preferences:{alerts:preferences?.alerts===true,pulse:preferences?.pulse===true},updatedAt:new Date().toISOString()};
  await client.hset(NATIVE_DEVICES,{[installationId]:record});
  return record;
}
export async function getNativeDevice(id,client=kv){return client.hget(NATIVE_DEVICES,id);}
