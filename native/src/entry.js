import { CapacitorHttp } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { apiRequestUrl, externalUrl } from './urls.js';

// Only the app's public API reads use native HTTP. No remote application shell.
const webFetch=window.fetch.bind(window);
window.fetch=async(input,options={})=>{
  const url=apiRequestUrl(input);
  if(!url)return webFetch(input,options);
  if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  const method=options.method || 'GET';
  if(method!=='GET')throw Error('Native API writes are not configured.');
  const result=await CapacitorHttp.request({url,method,connectTimeout:12000,readTimeout:12000,responseType:'json'});
  if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
  return new Response(JSON.stringify(result.data),{status:result.status,headers:{'Content-Type':'application/json'}});
};
window.open=(value)=>{
  const url=externalUrl(value);
  if(url)Browser.open({url}).catch(console.warn);
  return null;
};
document.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[href]');
  if(!anchor || anchor.getAttribute('href').startsWith('#'))return;
  const url=externalUrl(anchor.getAttribute('href'));
  if(url){event.preventDefault();Browser.open({url}).catch(console.warn);}
});
App.addListener('backButton',()=>{
  if(location.hash && location.hash!=='#home')location.hash='#home';
  else App.exitApp();
});
await import('../../public/mobile/mobile.js');
