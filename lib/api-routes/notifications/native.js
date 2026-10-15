import {kv} from '@vercel/kv';
import {getNativeDevice,saveNativeDevice,authorizedDevice} from '../../notifications/native-store.js';
import {firebaseConfig,deliverNative} from '../../notifications/native-send.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET')return res.status(200).json({androidReady:!!firebaseConfig(),iosReady:false});
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  const body=req.body || {};
  if(!firebaseConfig())return res.status(503).json({error:'Native notifications are awaiting Firebase configuration.'});
  try{
    if(body.action==='save'){await saveNativeDevice(body);return res.status(200).json({ok:true});}
    if(body.action!=='test')return res.status(400).json({error:'Invalid action'});
    if(!/^[a-f0-9-]{36}$/.test(body.installationId || ''))return res.status(400).json({error:'Invalid device'});
    const device=await getNativeDevice(body.installationId);
    if(!authorizedDevice(device,body.secret))return res.status(403).json({error:'Save preferences on this device first.'});
    if(!device.preferences.alerts&&!device.preferences.pulse)return res.status(403).json({error:'Choose an update type first.'});
    if(!await kv.set('notifications:native:test:'+body.installationId,'sent',{nx:true,ex:60}))return res.status(429).json({error:'Wait one minute before testing again.'});
    const result=await deliverNative([device],{title:'828 native notification test',body:'Your app is connected. Tap to open Pulse.',tag:'828-native-test'},'pulse');
    return res.status(result.sent===1?200:502).json(result.sent===1?{ok:true}:{error:'Push service did not accept the test.'});
  }catch(error){
    const code=error.message==='unauthorized-device'?403:error.message==='invalid-device'?400:503;
    return res.status(code).json({error:code===503?'Native notification storage or delivery is unavailable.':'Invalid device credentials.'});
  }
}
