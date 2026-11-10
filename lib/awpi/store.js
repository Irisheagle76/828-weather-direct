let memory = new Map();
const prefix = () => `awpi:v1:${process.env.VERCEL_ENV || 'development'}:`;
async function client() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return (await import('@vercel/kv')).kv;
}
export const storage = {
  async get(key) { const kv = await client(); return kv ? kv.get(prefix() + key) : memory.get(key) ?? null; },
  async set(key, value) { const kv = await client(); if (kv) await kv.set(prefix() + key, value, { ex: 45 * 86400 }); else memory.set(key, value); },
  durable() { return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN); },
};
