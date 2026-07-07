import { kv } from "@vercel/kv";
import fs from "node:fs/promises";
import path from "node:path";
export const FORECAST_KEY="forecast:manual:latest", STATUS_KEY="forecast:automatic:status", LOCK_KEY="forecast:automatic:lock";
export async function loadForecast(){try{const x=await kv.get(FORECAST_KEY);if(x)return x;}catch(e){console.warn("Forecast KV read unavailable:",e.message);}try{return JSON.parse(await fs.readFile(path.join(process.cwd(),"public","forecast-overrides.json"),"utf8"));}catch{return {};}}
export async function publishForecast(value){await kv.set(FORECAST_KEY,value);}
export async function loadStatus(){try{return await kv.get(STATUS_KEY)||{};}catch{return {};}}
export async function saveStatus(value){try{await kv.set(STATUS_KEY,value);}catch(e){console.warn("Status write unavailable:",e.message);}}
export async function acquireLock(id){try{return await kv.set(LOCK_KEY,id,{nx:true,ex:600})!==null;}catch{return true;}}
export async function releaseLock(id){try{if(await kv.get(LOCK_KEY)===id)await kv.del(LOCK_KEY);}catch{}}
