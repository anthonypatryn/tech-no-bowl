// Sound settings saved from the sound editor (/?view=sounds): { name: [{ file, start, len, vol, fade }] }.
// Anyone who can open the site can read them (the game loads them on start); saving needs the bug-list PIN (BUG_PIN).
// Storage: the shared Upstash Redis (key tech-no-bowl:sounds) in production; .data/sounds.json in dev.
import fs from 'node:fs';
import path from 'node:path';

const KEY = 'tech-no-bowl:sounds';
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export function makeSoundStore(localDir) {
  if (URL && TOKEN) return { load: async () => { const v = await redis(['GET', KEY]); return v ? JSON.parse(v) : {}; }, save: (doc) => redis(['SET', KEY, JSON.stringify(doc)]) };
  const file = path.join(localDir ?? '.data', 'sounds.json');
  return {
    load: async () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } },
    save: async (doc) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 1)); },
  };
}

const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
function clean(sounds) {
  const out = {};
  for (const [name, clips] of Object.entries(sounds ?? {})) {
    if (!/^[A-Za-z0-9-]{1,40}$/.test(name) || !Array.isArray(clips)) continue;
    out[name] = clips.slice(0, 12).filter((c) => c && (/^[A-Za-z0-9 _.-]{1,80}$/.test(c.file ?? '') || /^blob:sfx\/[\w ./%-]{1,300}$/.test(c.file ?? ''))).map((c) => ({
      file: c.file, start: num(c.start, 0, 3600, 0), len: num(c.len, 0.05, 600, 1), vol: num(c.vol, 0, 6, 1), fade: num(c.fade, 0, 5, 0.12),
      ...(c.loop ? { loop: true } : {}), ...(typeof c.name === 'string' ? { name: c.name.slice(0, 30) } : {}),
    }));
  }
  return out;
}

// → [status, json]
export async function handleSounds(store, method, body, pin, expectedPin) {
  const norm = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '').trim();
  if (method === 'GET') return [200, { sounds: await store.load() }];
  if (!norm(expectedPin)) return [401, { error: 'No PIN is set on the server (BUG_PIN).' }];
  if (norm(pin) !== norm(expectedPin)) return [401, { error: 'Wrong PIN.' }];
  const sounds = clean(body?.sounds);
  await store.save(sounds);
  return [200, { ok: true, sounds }];
}
