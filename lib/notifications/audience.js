import {sendPushToAll} from './sendPush.js';
import {sendNativeAudience} from './native-send.js';
export async function sendToAudience(payload,options,{webSend=sendPushToAll,nativeSend=sendNativeAudience}={}){
  const [web,native]=await Promise.all([webSend(payload,options),nativeSend(payload,options)]);
  return {attempted:web.attempted+native.attempted,sent:web.sent+native.sent,failed:web.failed+native.failed,skipped:web.skipped&&native.skipped,reason:web.skipped&&native.skipped?'delivery-not-configured':undefined,web,native};
}
