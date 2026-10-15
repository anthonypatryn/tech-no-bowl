// Art Review Board verdicts: { [assetKey]: { status: 'ok' | 'fix' | 'reject', note, who, at } }.
// Anyone can read them (the board shows them); writing needs the bug-list PIN (BUG_PIN).
// Storage: the shared Upstash Redis (key tech-no-bowl:reviews) in production; .data/reviews.json in dev.
import fs from 'node:fs';
import path from 'node:path';

const KEY = 'tech-no-bowl:reviews';
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const STATUSES = ['ok', 'fix', 'reject'];
const clip = (s, n) => String(s ?? '').replace(/[<>]/g, '').slice(0, n);

async function redis(cmd) {
  const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export function makeReviewStore(localDir) {
  if (URL && TOKEN) return { load: async () => { const v = await redis(['GET', KEY]); return v ? JSON.parse(v) : {}; }, save: (doc) => redis(['SET', KEY, JSON.stringify(doc)]) };
  const file = path.join(localDir ?? '.data', 'reviews.json');
  return {
    load: async () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } },
    save: async (doc) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 1)); },
  };
}

// body: { key, status | null (clears it), note, who } -> [status, json]
export async function handleReviews(store, method, body, pin, expectedPin) {
  const norm = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '').trim();
  if (method === 'GET') return [200, { reviews: await store.load() }];
  if (!norm(expectedPin)) return [401, { error: 'No PIN is set on the server (BUG_PIN).' }];
  if (norm(pin) !== norm(expectedPin)) return [401, { error: 'Wrong PIN.' }];
  const key = clip(body?.key, 80);
  if (!/^[a-z0-9:._/-]{1,80}$/i.test(key)) return [400, { error: 'Bad asset key.' }];
  const doc = await store.load();
  if (body.status == null) delete doc[key];
  else if (STATUSES.includes(body.status)) doc[key] = { status: body.status, note: clip(body.note, 600), who: clip(body.who, 40), at: Date.now() };
  else return [400, { error: 'Unknown status.' }];
  await store.save(doc);
  return [200, { ok: true, reviews: doc }];
}
