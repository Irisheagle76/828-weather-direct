const preferenceKey = '828-mobile-notification-preferences';
const toBytes = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-value.length%4)%4)), c=>c.charCodeAt(0));
export function initNotificationSettings() {
  const alerts=document.querySelector('#notifyAlerts'),pulse=document.querySelector('#notifyPulse'),save=document.querySelector('#saveNotifications'),off=document.querySelector('#disableNotifications'),status=document.querySelector('#notificationStatus');
  let preferences={alerts:false,pulse:false};
  try { preferences=JSON.parse(localStorage.getItem(preferenceKey)) || preferences; } catch {}
  alerts.checked=preferences.alerts===true; pulse.checked=preferences.pulse===true;
  if(!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {status.textContent='Notifications are not supported here. On iPhone, add this app to your Home Screen and open it there.';save.disabled=true;off.disabled=true;return;}
  const ios=/iPhone|iPad|iPod/.test(navigator.userAgent);
  if(ios && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches){status.textContent='On iPhone or iPad: Share → Add to Home Screen, then open the app from that icon to enable notifications.';save.disabled=true;return;}
  const setup=Promise.all([navigator.serviceWorker.register('/mobile/sw.js',{scope:'/mobile/'}),fetch('/api/router?route=notifications/public-key',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Notification setup unavailable');return r.json();})]);
  setup.catch(()=>{status.textContent='Notification setup is unavailable. Please try again later.';});
  async function persist(sub,prefs){const r=await fetch('/api/router?route=notifications/subscribe',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...sub.toJSON(),preferences:prefs})});if(!r.ok)throw Error('Could not save preferences. Try again.');localStorage.setItem(preferenceKey,JSON.stringify(prefs));}
  async function update(disable){
    const prefs=disable?{alerts:false,pulse:false}:{alerts:alerts.checked,pulse:pulse.checked};
    if(!disable && !prefs.alerts && !prefs.pulse){status.textContent='Choose Weather Bulletin, Pulse Updates, or both.';return;}
    if(!disable && Notification.permission==='denied'){status.textContent='Notifications are blocked. Allow them in your browser or phone settings.';return;}
    // Request permission directly in the click handler, before asynchronous setup.
    const permission=!disable && Notification.permission==='default'?Notification.requestPermission():Promise.resolve(Notification.permission);
    save.disabled=off.disabled=true;status.textContent='Saving…';
    try {
      if(!disable && await permission!=='granted')throw Error('Permission was not granted. No notifications enabled.');
      const [registration,keys]=await setup;
      await navigator.serviceWorker.ready;
      let sub=await registration.pushManager.getSubscription();
      if(!disable && !sub){if(!keys.publicKey)throw Error('Notifications are not configured.');sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:toBytes(keys.publicKey)});}
      if(sub){await persist(sub,prefs);if(disable)await sub.unsubscribe();}else localStorage.setItem(preferenceKey,JSON.stringify(prefs));
      alerts.checked=prefs.alerts;pulse.checked=prefs.pulse;
      status.textContent=disable?'Notifications turned off.':'Preferences saved. Weather Bulletin delivery is supported now; Pulse delivery is being connected next.';
      save.textContent='Save notification preferences';
    }catch(error){status.textContent=error.message || 'Unable to update notifications.';}finally{save.disabled=off.disabled=false;}
  }
  save.addEventListener('click',()=>update(false));off.addEventListener('click',()=>update(true));
}
