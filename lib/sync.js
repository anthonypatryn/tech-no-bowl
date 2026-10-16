// Sync codes: your saves (season, unfinished game, stats, records, depth charts, playbook) under a short code, so you
// can carry on from another device. No accounts: the code is the key (8 characters, ~10^12 possibilities, kept 400
// days after the last save). A save that would overwrite a newer one from another device is refused unless forced.
// Storage: Upstash Redis in production (same database as the bug list), a file per code in .data/ in dev.
import fs from 'node:fs';
import path from 'node:path';

const PREFIX = 'tech-no-bowl:sync:';
const TTL = 400 * 86400;
const MAX = 1500000; // characters of saved data
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const okCode = (c) => typeof c === 'string' && new RegExp(`^[${ABC}]{8}$`).test(c);
const newCode = () => Array.from({ length: 8 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');

async function redis(cmd) {
  const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export function makeSyncStore(localDir) {
  if (URL && TOKEN) {
    return {
      get: async (code) => { const v = await redis(['GET', PREFIX + code]); return v ? JSON.parse(v) : null; },
      put: async (code, doc) => { await redis(['SET', PREFIX + code, JSON.stringify(doc), 'EX', TTL]); },
    };
  }
  if (!localDir) throw new Error('Sync isn’t set up yet: the site needs its Upstash Redis database connected.');
  const file = (code) => path.join(localDir, `sync-${code}.json`);
  return {
    get: async (code) => { try { return JSON.parse(fs.readFileSync(file(code), 'utf8')); } catch { return null; } },
    put: async (code, doc) => { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(file(code), JSON.stringify(doc)); },
  };
}

// body: { action: 'new' | 'save' | 'load' | 'peek', code?, data?, base?, force? } → [status, json]
export async function handleSync(store, method, body) {
  if (method !== 'POST') return [405, { error: 'POST only' }];
  const { action, data } = body ?? {};
  const code = typeof body?.code === 'string' ? body.code.toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
  const okData = (d) => d && typeof d === 'object' && !Array.isArray(d) && Object.values(d).every((v) => typeof v === 'string') && JSON.stringify(d).length <= MAX;
  if (action === 'new') {
    if (!okData(data)) return [400, { error: 'Nothing to save, or too much.' }];
    let c = newCode();
    for (let i = 0; i < 5 && await store.get(c); i++) c = newCode();
    const at = Date.now();
    await store.put(c, { at, data });
    return [200, { code: c, at }];
  }
  if (!okCode(code)) return [400, { error: 'That doesn’t look like a sync code (8 letters and numbers).' }];
  if (action === 'load' || action === 'peek') {
    const doc = await store.get(code);
    if (!doc) return [404, { error: 'No saves under that code (codes last 400 days after the last save).' }];
    return [200, action === 'peek' ? { at: doc.at } : { at: doc.at, data: doc.data }];
  }
  if (action === 'save') {
    if (!okData(data)) return [400, { error: 'Nothing to save, or too much.' }];
    const cur = await store.get(code);
    // another device saved since this one last loaded / saved: don't overwrite it unless asked to
    if (cur && !body.force && typeof body.base === 'number' && cur.at > body.base) return [409, { error: 'There’s a newer save from another device.', at: cur.at }];
    const at = Date.now();
    await store.put(code, { at, data });
    return [200, { at }];
  }
  return [400, { error: 'Unknown action.' }];
}
