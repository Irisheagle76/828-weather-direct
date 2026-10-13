import {createRadianceEngine} from '/js/intel/sunset-radiance.js';
import {isObscuredSky} from '/js/intel/sky-read.js';
import {buildDuskSkyFallback,getSkyTimePhase} from '/js/intel/sky-time.js';
import {getCurrentPrecipOverride} from '/js/intel/precip-override.js';
function getRadiancePhase(daily) {
      const now = Date.now();
      const sunrise = daily?.sunrise;
      const sunset = daily?.sunset;

      if (!Number.isFinite(sunrise) || !Number.isFinite(sunset)) {
        return { state: "pending", label: "Window pending" };
      }

      const skyTimePhase = getSkyTimePhase({ now, sunriseAt: sunrise, sunsetAt: sunset });

      if (skyTimePhase === "night" && now > sunset) {
        return { state: "closed", label: "Closed after twilight" };
      }

      if (skyTimePhase === "sunset") {
        return { state: "peak", label: "Peak color window" };
      }

      if (skyTimePhase === "afterglow") {
        return { state: "post_sunset", label: "Post-sunset check" };
      }

      if (now < sunrise) {
        return { state: "waiting", label: "Waiting for daylight" };
      }

      const decisionStart = new Date(sunset);
      decisionStart.setHours(15, 0, 0, 0);
      if (Number(new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",hour:"numeric",hourCycle:"h23"}).format(new Date(now))) < 15) {
        return {
          state: "setup",
          label: "Early setup only",
          decisionStart: decisionStart.getTime()
        };
      }

      return { state: "active", label: "Monitoring sunset" };
    }
export function mobileRadiance(weather,camera,skyIntel,storm=null) {
const state={weather,skyData:camera,skyIntel,storm};
const pickNumber=(obj,keys)=>{for(const key of keys){if(obj?.[key]!=null && Number.isFinite(Number(obj[key])))return Number(obj[key]);}return null;};
const getTodayDaily=w=>w?.daily?.find(d=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date(d.timestamp))===new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date())) || null;
const closest=(w,ts)=>(w?.hourly||[]).filter(h=>Number.isFinite(h.timestamp)).reduce((a,b)=>!a||Math.abs(b.timestamp-ts)<Math.abs(a.timestamp-ts)?b:a,null);
const current=weather?.current||{};
const cloud=skyIntel?.displayCloud??skyIntel?.cloud;
return createRadianceEngine({state,isObscuredSky,pickNumber,clamp:(v,min=0,max=100)=>Math.max(min,Math.min(max,v)),pct:v=>Number.isFinite(v)?Math.round(v<=1?v*100:v)+'%':'--',labelize:v=>(v||'Unknown').replaceAll('_',' '),formatTime:t=>new Date(t).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}),getTodayDaily,getSunsetHour:w=>closest(w,getTodayDaily(w)?.sunset),getCurrentHour:w=>closest(w,Date.now()),getRadiancePhase,buildDuskSkyFallback,getSkyPrecipOverride:()=>getCurrentPrecipOverride({current,hourly:weather?.hourly||[],radar:storm?.radar||{},lightningCount:Math.max(Number(current.lightningStrikeCount)||0,Number(storm?.weather?.lightningCount)||0),lightningDistance:current.lightningStrikeDistance,lightningObservedAt:current.lightningStrikeLastAt,skyClearing:skyIntel?.sunlightLevel==='strong'||(Number.isFinite(cloud)&&cloud<=35&&skyIntel?.brightnessTrend!=='decreasing')})})();
}
