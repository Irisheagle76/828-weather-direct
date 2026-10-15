import {Capacitor,CapacitorHttp} from '@capacitor/core';
import {PushNotifications} from '@capacitor/push-notifications';
import {API_ORIGIN} from './urls.js';

const storageKey='828-native-push-device-v1';
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
export function initNotificationSettings(){
  const alerts=document.getElementById('notifyAlerts'),pulse=document.getElementById('notifyPulse'),save=document.getElementById('saveNotifications'),off=document.getElementById('disableNotifications'),test=document.getElementById('testNotifications'),status=document.getElementById('notificationStatus');
  let device;
  try{device=JSON.parse(localStorage.getItem(storageKey));}catch{}
  if(!device?.installationId || !device?.secret)device={installationId:crypto.randomUUID(),secret:hex(crypto.getRandomValues(new Uint8Array(32))),preferences:{alerts:false,pulse:false}};
  const remember=()=>localStorage.setItem(storageKey,JSON.stringify(device));
  remember();
  alerts.checked=device.preferences.alerts;pulse.checked=device.preferences.pulse;
  const busy=value=>{save.disabled=off.disabled=test.disabled=value;};
  busy(true);
  PushNotifications.addListener('pushNotificationActionPerformed',event=>{
    location.hash=event.notification.data?.destination==='pulse'?'#pulse':'#home';
  });
  async function api(data){
    const result=await CapacitorHttp.request({url:API_ORIGIN+'/api/router?route=notifications/native',method:data?'POST':'GET',headers:{'Content-Type':'application/json'},data,connectTimeout:12000,readTimeout:12000,responseType:'json'});
    if(result.status<200||result.status>=300)throw Error(result.data?.error || 'Native notification service is unavailable.');
    return result.data;
  }
  async function token(){
    return new Promise(async(resolve,reject)=>{
      let done=false,success,error,timer;
      const finish=(failure,value)=>{if(done)return;done=true;clearTimeout(timer);success?.remove();error?.remove();failure?reject(failure):resolve(value);};
      try{
        success=await PushNotifications.addListener('registration',value=>finish(null,value.value));
        error=await PushNotifications.addListener('registrationError',()=>finish(Error('Device registration failed. Check Firebase configuration.')));
        timer=setTimeout(()=>finish(Error('Device registration timed out. Please try again.')),30000);
        await PushNotifications.register();
      }catch(failure){finish(failure);}
    });
  }
  async function persist(preferences){
    await api({action:'save',installationId:device.installationId,secret:device.secret,token:device.token,preferences});
    device.preferences=preferences;remember();
  }
  async function savePreferences(disable){
    busy(true);
    try{
      const preferences=disable?{alerts:false,pulse:false}:{alerts:alerts.checked,pulse:pulse.checked};
      if(!disable&&!preferences.alerts&&!preferences.pulse)throw Error('Choose Weather Bulletin, Pulse Updates, or both.');
      if(!disable){
        let permission=await PushNotifications.checkPermissions();
        if(permission.receive==='prompt'||permission.receive==='prompt-with-rationale')permission=await PushNotifications.requestPermissions();
        if(permission.receive!=='granted')throw Error('Notifications are blocked. Allow them in Android app settings.');
        device.token=await token();
        await persist(preferences);
      }else{
        if(device.token)await persist(preferences);
        await PushNotifications.unregister();
        device.token=null;device.preferences=preferences;remember();
      }
      alerts.checked=preferences.alerts;pulse.checked=preferences.pulse;
      status.textContent=disable?'Native notifications turned off.':'Native preferences saved. Send a test to this device.';
    }catch(error){status.textContent=error.message;}finally{busy(false);}
  }
  save.addEventListener('click',()=>savePreferences(false));
  off.addEventListener('click',()=>savePreferences(true));
  test.addEventListener('click',async()=>{
    busy(true);
    try{await api({action:'test',installationId:device.installationId,secret:device.secret});status.textContent='Push service accepted the test. Confirm it appears on this phone and opens Pulse when tapped.';}
    catch(error){status.textContent=error.message;}finally{busy(false);}
  });
  (async()=>{
    if(Capacitor.getPlatform()!=='android')throw Error('iPhone native push will be enabled after Apple signing and APNs setup.');
    if(!__ANDROID_PUSH_CONFIGURED__)throw Error('Android notifications are awaiting the Firebase app configuration file.');
    const config=await api();
    if(!config.androidReady)throw Error('Android notifications are awaiting Firebase server configuration.');
    await PushNotifications.createChannel({id:'828-bulletin',name:'828 Weather Bulletin',description:'Notable to urgent weather events',importance:4,sound:'default'});
    await PushNotifications.createChannel({id:'828-pulse',name:'828 Pulse Updates',description:'Daily to semi-daily updates',importance:3,sound:'default'});
    if(device.preferences.alerts||device.preferences.pulse){
      const permission=await PushNotifications.checkPermissions();
      if(permission.receive==='granted'){device.token=await token();await persist(device.preferences);}
    }
    busy(false);status.textContent='Choose your native app updates, then enable notifications.';
  })().catch(error=>{status.textContent=error.message;});
}
