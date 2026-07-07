import crypto from "node:crypto";
import { getConfig, windowStatus, manualOverrideActive } from "./config.js";
import { fetchSources } from "./sources.js";
import { generateForecast } from "./generate.js";
import { validateForecast } from "./validate.js";
import { loadForecast, publishForecast, loadStatus, saveStatus, acquireLock, releaseLock } from "./store.js";

export async function runAutomaticForecast({ dryRun=false, force=false, now=new Date(), env=process.env, dependencies={} }={}) {
  const config = getConfig(env), window = windowStatus(config, now), runId = crypto.randomUUID();
  const base = { runId, attemptedAt:now.toISOString(), dryRun, window, published:false, skipped:false };
  const finish = async result => { await (dependencies.saveStatus || saveStatus)({ ...result, candidate:undefined }); return result; };
  if (!dryRun && !window.inside) return finish({ ...base, status:"skipped", skipped:true, reason:!config.enabled ? "automation disabled" : "outside vacation window" });
  const current = await (dependencies.loadForecast || loadForecast)();
  const override = manualOverrideActive(current, config, now);
  if (!dryRun && !force && override) return finish({ ...base, status:"skipped", skipped:true, reason:"recent manual publication protected", manualOverride:true });
  if (!dryRun && !(await (dependencies.acquireLock || acquireLock)(runId))) return finish({ ...base, status:"skipped", skipped:true, reason:"duplicate run already in progress" });
  try {
    const sources = await (dependencies.fetchSources || fetchSources)(config, { fetcher:dependencies.fetcher, now });
    const candidate = (dependencies.generateForecast || generateForecast)(sources, now);
    const validation = (dependencies.validateForecast || validateForecast)(candidate, { now, sourceTimestamps:sources.timestamps });
    const changes = compare(current, candidate);
    const result = { ...base, status:validation.valid ? (dryRun ? "preview" : "published") : "failed", candidate:dryRun ? candidate : undefined, validation, changes, manualOverride:override, sourceTimestamps:sources.timestamps, dataSourceHealth:{ nwsForecast:"ok", nwsHourly:"ok", afd:sources.afd?.unavailable ? "unavailable" : sources.afd?.stale ? "stale" : "ok" } };
    if (!validation.valid) return finish({ ...result, reason:"candidate validation failed" });
    if (!dryRun) {
      const publishedAt = new Date().toISOString();
      const live = { ...candidate, lastUpdated:publishedAt, source:"automatic", metadata:{ publicationSource:"automatic", publishedAt, sourceTimestamps:sources.timestamps, needsReview:Object.values(candidate.days).some(day => day.needsReview), runId, abruptChanges:changes.abrupt } };
      await (dependencies.publishForecast || publishForecast)(live);
      result.published = true;
      result.publishedAt = publishedAt;
    }
    return finish(result);
  } catch (error) {
    console.error("Automatic forecast run failed:", error);
    return finish({ ...base, status:"failed", reason:error.message, validation:{ valid:false, errors:[error.message] }, dataSourceHealth:{ error:true } });
  } finally {
    if (!dryRun) await (dependencies.releaseLock || releaseLock)(runId);
  }
}

export async function getAutomaticStatus({ now=new Date(), env=process.env }={}) {
  const config = getConfig(env), [last,current] = await Promise.all([loadStatus(),loadForecast()]);
  return { config:{ enabled:config.enabled, start:config.start, end:config.end, timezone:config.timezone, manualOverrideHours:config.manualOverrideHours }, window:windowStatus(config,now), last, currentForecastSource:current?.metadata?.publicationSource || (/manual/i.test(current?.source||"") ? "manual" : current?.source||"unknown"), manualOverrideActive:manualOverrideActive(current,config,now), sourceDataFreshness:current?.metadata?.sourceTimestamps||null };
}

function compare(oldValue,newValue) { const items=[]; for (const [date,day] of Object.entries(newValue.days||{})) { const old=oldValue?.days?.[date]; if (!old) { items.push({date,type:"added"}); continue; } const highDelta=Math.abs(Number(day.high)-Number(old.high)); if (highDelta>=8||day.stormRisk!==old.stormRisk) items.push({date,type:"meaningful",highDelta,stormRisk:[old.stormRisk,day.stormRisk]}); } return { items, abrupt:items.some(item=>item.highDelta>=12) }; }
