// Bug reports: anyone files one (numbered BUG-1, BUG-2…); the owner reads them with the PIN,
// copies them for Claude, and marks them fixed. One JSON document holds them all.
// Storage: Upstash Redis over REST in production (KV_REST_API_URL / KV_REST_API_TOKEN, set by the
// Vercel Upstash integration); a local file (.data/bugs.json) in dev.
import fs from 'node:fs';
import path from 'node:path';

const KEY = 'tech-no-bowl:bugs', MAX = 300;
// photos (screenshots) ride along with a report: each is a shrunk JPEG data URL under its own key, kept 180 days
const PHOTO_KEY = (no, i) => `tech-no-bowl:bugimg:${no}:${i}`, PHOTO_MAX = 2, PHOTO_CHARS = 900000, PHOTO_TTL = 180 * 86400;
const okPhoto = (d) => typeof d === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d) && d.length <= PHOTO_CHARS;
const KINDS = ['Broken', 'Looks wrong', 'Rules', 'Idea'];
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const clip = (s, n) => String(s ?? '').replace(/[<>]/g, '').slice(0, n);

async function redis(cmd) {
  const r = await fetch(URL, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

export function makeStore(localDir) {
  if (URL && TOKEN) {
    return {
      kind: 'redis',
      load: async () => { const v = await redis(['GET', KEY]); return v ? JSON.parse(v) : null; },
      save: async (doc) => { await redis(['SET', KEY, JSON.stringify(doc)]); },
      nextNo: () => redis(['INCR', `${KEY}:no`]),
      putPhoto: (no, i, d) => redis(['SET', PHOTO_KEY(no, i), d, 'EX', PHOTO_TTL]),
      getPhoto: (no, i) => redis(['GET', PHOTO_KEY(no, i)]),
      delPhotos: (no) => redis(['DEL', ...Array.from({ length: PHOTO_MAX }, (_, i) => PHOTO_KEY(no, i))]),
    };
  }
  if (!localDir) throw new Error('Bug reports aren’t set up yet: the site needs its Upstash Redis database connected.');
  const file = path.join(localDir, 'bugs.json');
  const read = () => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } };
  return {
    kind: 'file',
    load: async () => read(),
    save: async (doc) => { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(doc, null, 1)); },
    nextNo: async () => ((read()?.bugs ?? []).reduce((m, b) => Math.max(m, b.no), 0) + 1),
    putPhoto: async (no, i, d) => { fs.mkdirSync(localDir, { recursive: true }); fs.writeFileSync(path.join(localDir, `bugimg-${no}-${i}.txt`), d); },
    getPhoto: async (no, i) => { try { return fs.readFileSync(path.join(localDir, `bugimg-${no}-${i}.txt`), 'utf8'); } catch { return null; } },
    delPhotos: async (no) => { for (let i = 0; i < PHOTO_MAX; i++) fs.rmSync(path.join(localDir, `bugimg-${no}-${i}.txt`), { force: true }); },
  };
}

// method, body, pin → [status, json]
export async function handleBugs(store, method, body, pin, expectedPin) {
  // forgiving about stray spaces / quotes pasted into the Vercel setting or the PIN box
  const norm = (v) => String(v ?? '').trim().replace(/^["']|["']$/g, '').trim();
  expectedPin = norm(expectedPin);
  const owner = !!expectedPin && norm(pin) === expectedPin;
  const doc = (await store.load()) || { bugs: [] };
  if (method === 'GET') {
    if (!expectedPin) return [401, { error: 'No PIN is set on the server (BUG_PIN).' }];
    if (!owner) return [401, { error: 'Wrong PIN.' }];
    return [200, { bugs: doc.bugs }];
  }
  if (body?.action === 'bug') {
    const what = clip(body.what, 1500).trim();
    if (!what) return [400, { error: 'Say what went wrong.' }];
    const photos = (Array.isArray(body.photos) ? body.photos : []).slice(0, PHOTO_MAX);
    if (photos.some((d) => !okPhoto(d))) return [400, { error: 'That photo is too big or not a picture. Try a screenshot instead.' }];
    const no = await store.nextNo();
    for (let i = 0; i < photos.length; i++) await store.putPhoto(no, i, photos[i]);
    const g = body.game && typeof body.game === 'object' ? body.game : null;
    const b = {
      no, kind: KINDS.includes(body.kind) ? body.kind : 'Broken', area: clip(body.area, 40), who: clip(body.who, 40),
      what, expected: clip(body.expected, 800), steps: clip(body.steps, 800), always: !!body.always, blocking: !!body.blocking,
      page: clip(body.page, 120), ua: clip(body.ua, 160), screen: clip(body.screen, 20), device: clip(body.device, 300), photos: photos.length,
      game: g && { seed: Number(g.seed) || 0, half: Number(g.half) || 0, down: Number(g.down) || 0, phase: clip(g.phase, 20), score: clip(g.score, 20),
        teams: clip(g.teams, 80), level: clip(g.level, 20), mode: clip(g.mode, 20),
        log: Array.isArray(g.log) ? g.log.slice(-15).map((l) => clip(l, 200)) : [] },
      at: Date.now(), status: 'open', fixedAt: 0, fixNote: '',
    };
    const fresh = (await store.load()) || { bugs: [] };
    fresh.bugs = [b, ...fresh.bugs].slice(0, MAX);
    await store.save(fresh);
    return [200, { no }];
  }
  if (!owner) return [401, { error: 'Wrong PIN.' }];
  if (body?.action === 'photo') { // one photo of one report: { no, i } → { url }
    const url = await store.getPhoto(Number(body.no), Number(body.i));
    return url ? [200, { url }] : [404, { error: 'That photo is gone (photos are kept 180 days).' }];
  }
  const nos = (Array.isArray(body?.nos) ? body.nos : [body?.no]).map(Number).filter(Boolean);
  const hit = doc.bugs.filter((b) => nos.includes(b.no));
  if (!hit.length) return [400, { error: `No BUG-${nos[0] ?? '?'}.` }];
  if (body.action === 'fix') hit.forEach((b) => Object.assign(b, { status: 'fixed', fixedAt: Date.now(), fixNote: clip(body.note, 400) }));
  else if (body.action === 'reopen') hit.forEach((b) => Object.assign(b, { status: 'open', fixedAt: 0 }));
  else if (body.action === 'remove') { doc.bugs = doc.bugs.filter((b) => !hit.includes(b)); for (const b of hit) if (b.photos) await store.delPhotos(b.no); }
  else return [400, { error: 'Unknown action.' }];
  await store.save(doc);
  return [200, { ok: true }];
}
