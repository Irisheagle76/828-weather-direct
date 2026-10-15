import {kv} from '@vercel/kv';
import {NATIVE_DEVICES} from './native-store.js';
export function firebaseConfig(){
  try{
    const value=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}');
    return value.project_id && value.client_email && value.private_key ? value : null;
  }catch{return null;}
}
export function nativeMessage(device,payload,topic='alerts'){
  return {token:device.token,notification:{title:String(payload.title || '828 Weather Bulletin').slice(0,150),body:String(payload.body || '').slice(0,500)},
    data:{destination:topic==='pulse'?'pulse':'home'},
    android:{priority:topic==='alerts'?'high':'normal',ttl:6*60*60*1000,notification:{channelId:topic==='pulse'?'828-pulse':'828-bulletin',tag:String(payload.tag || '828-weather'),icon:'ic_stat_weather',sound:'default'}}};
}
async function sendFirebase(message){
  const config=firebaseConfig();if(!config)throw Error('native-not-configured');
  const {initializeApp,cert,getApps}=await import('firebase-admin/app');
  const {getMessaging}=await import('firebase-admin/messaging');
  const app=getApps().find(a=>a.name==='828-native') || initializeApp({credential:cert(config)},'828-native');
  return getMessaging(app).send(message);
}
export async function deliverNative(devices,payload,topic='alerts',{send=sendFirebase,remove=id=>kv.hdel(NATIVE_DEVICES,id)}={}){
  let sent=0,failed=0,expired=0;
  for(const device of devices){
    try{await send(nativeMessage(device,payload,topic));sent++;}
    catch(error){failed++;if(error.code==='messaging/registration-token-not-registered'){expired++;await remove(device.installationId).catch(()=>{});}}
  }
  return {attempted:devices.length,sent,failed,expired,skipped:false};
}
export async function sendNativeAudience(payload,{topic='alerts'}={}){
  if(!firebaseConfig())return {attempted:0,sent:0,failed:0,skipped:true,reason:'native-not-configured'};
  try{
    const devices=Object.values(await kv.hgetall(NATIVE_DEVICES) || {}).filter(d=>d?.preferences?.[topic]===true);
    return await deliverNative(devices,payload,topic);
  }catch{return {attempted:0,sent:0,failed:0,skipped:true,reason:'native-store-unavailable'};}
}
