import {sendPushToAll} from './sendPush.js';
import {sendNativeAudience} from './native-send.js';
export async function sendToAudience(payload,options){
  const [web,native]=await Promise.all([sendPushToAll(payload,options),sendNativeAudience(payload,options)]);
  return {attempted:web.attempted+native.attempted,sent:web.sent+native.sent,failed:web.failed+native.failed,skipped:web.skipped&&native.skipped,reason:web.skipped&&native.skipped?'delivery-not-configured':undefined,web,native};
}
