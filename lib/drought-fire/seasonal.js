import { clamp } from './utils.js';
import { autumnWeight } from './autumn.js';

export const FIRE_SEASON_MODES = ['auto', 'fall', 'spring', 'standard'];

export function springWeight(timestamp) {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) return 0;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'numeric', day: 'numeric'
  }).formatToParts(new Date(timestamp));
  const month=Number(parts.find(p=>p.type==='month').value),day=Number(parts.find(p=>p.type==='day').value);
  if (month===3) return clamp((day-1)/14,0,1);
  if (month===4) return day<=15 ? 1 : 1-(day-15)/30;
  if (month===5) return clamp((15-day)/30,0,1);
  return 0;
}

// Calendar windows approximate seasonal fuel exposure, not measured leaf fall
// or green-up. Spring and fall share provisional cool-season coefficients:
// https://climate.ncsu.edu/fire/learn/climatology/
export function resolveFireSeason(timestamp, mode='auto') {
  if (!FIRE_SEASON_MODES.includes(mode)) throw new Error(`Invalid fire weather season mode: ${mode}`);
  if (mode!=='auto') return {mode,profile:mode,weight:mode==='standard'?0:1};
  const fall=autumnWeight(timestamp),spring=springWeight(timestamp);
  return {mode,profile:fall>0?'fall':spring>0?'spring':'standard',weight:Math.max(fall,spring)};
}

export function seasonalFireComponents({timestamp,seasonMode='auto',rhScore,windScore,tempScore,daysSinceRain,rainTodayIn,rainRateInHr}) {
  const season=resolveFireSeason(timestamp,seasonMode);
  const {weight}=season;
  const weatherWeights={humidity:0.40+0.20*weight,wind:0.35+0.05*weight,temperature:0.25*(1-weight)};
  const drySpell=rainTodayIn>=0.1||rainRateInHr>=0.01||!Number.isFinite(daysSinceRain)?0:clamp(daysSinceRain/14,0,1);
  const fineFuelProxy=weight*0.12*drySpell*rhScore*(0.5+0.5*windScore);
  return {...season,weatherWeights,fineFuelProxy,
    weatherComponent:rhScore*weatherWeights.humidity+windScore*weatherWeights.wind+tempScore*weatherWeights.temperature};
}
