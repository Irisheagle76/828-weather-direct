const FALL_FORECAST_KEY = "fall:forecast:last-good";
const FALL_FORECAST_TTL_SECONDS = 12 * 60 * 60;
const FALL_OBSERVATION_SHADOW_KEY = "fall:observations:shadow:v1";
const FALL_OBSERVATION_SHADOW_MAX_BATCHES = 14 * 24 * 6;
const FALL_OBSERVATION_SHADOW_TTL_SECONDS = 30 * 24 * 60 * 60;

export async function loadFallForecastFallback() {
  if (!hasKvConfiguration()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    return await kv.get(FALL_FORECAST_KEY);
  } catch (error) {
    console.warn("Fall forecast KV read unavailable:", error.message);
    return null;
  }
}

export async function saveFallForecastFallback(payload) {
  if (!hasKvConfiguration()) return false;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(FALL_FORECAST_KEY, payload, { ex: FALL_FORECAST_TTL_SECONDS });
    return true;
  } catch (error) {
    console.warn("Fall forecast KV write unavailable:", error.message);
    return false;
  }
}

export async function saveObservationShadowBatch(batch) {
  if (!hasKvConfiguration()) return false;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.lpush(FALL_OBSERVATION_SHADOW_KEY, batch);
    await kv.ltrim(FALL_OBSERVATION_SHADOW_KEY, 0, FALL_OBSERVATION_SHADOW_MAX_BATCHES - 1);
    await kv.expire(FALL_OBSERVATION_SHADOW_KEY, FALL_OBSERVATION_SHADOW_TTL_SECONDS);
    return true;
  } catch (error) {
    console.warn("Fall observation shadow KV write unavailable:", error.message);
    return false;
  }
}

export async function loadObservationShadowBatches(limit = FALL_OBSERVATION_SHADOW_MAX_BATCHES) {
  if (!hasKvConfiguration()) return [];
  try {
    const { kv } = await import("@vercel/kv");
    return await kv.lrange(FALL_OBSERVATION_SHADOW_KEY, 0, Math.max(0, Math.min(limit, FALL_OBSERVATION_SHADOW_MAX_BATCHES) - 1));
  } catch (error) {
    console.warn("Fall observation shadow KV read unavailable:", error.message);
    return [];
  }
}

function hasKvConfiguration() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}
