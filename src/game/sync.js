// Sync codes (Settings → Play on another device): this device's saves go up under a short code, and another device
// loads them with it. Saved: the season, the unfinished game, career stats, records, depth charts, playbook, your
// online name. Not saved: settings, sound, keys (they belong to each device), online room links.
const SYNC_KEYS = ['tb-season', 'tb-resume', 'tb-stats', 'tb-records', 'tb-depth', 'tb-playbook', 'tb-lastset', 'tb-last', 'tb-name'];
const CODE = 'tb-sync-code', AT = 'tb-sync-at';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* not kept */ } };

export const syncCode = () => get(CODE);
export const syncAt = () => Number(get(AT)) || 0;
export const showCode = (c) => (c ? `${c.slice(0, 4)}-${c.slice(4)}` : '');
export const forgetSync = () => { set(CODE, null); set(AT, null); };

function gather() {
  const out = {};
  for (const k of SYNC_KEYS) { const v = get(k); if (v != null) out[k] = v; }
  return out;
}
async function call(body) {
  const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}

// make a code for this device's saves
export async function makeCode() {
  const r = await call({ action: 'new', data: gather() });
  if (!r.ok) throw new Error(r.error ?? 'Couldn’t make a code.');
  set(CODE, r.code); set(AT, String(r.at));
  return r.code;
}

// save now. force: overwrite a newer save from another device. Returns { ok, conflict?, at? }
export async function saveNow({ force = false } = {}) {
  const code = syncCode();
  if (!code) return { ok: false };
  const r = await call({ action: 'save', code, data: gather(), base: syncAt(), force });
  if (r.status === 409) return { ok: false, conflict: true, at: r.at };
  if (!r.ok) throw new Error(r.error ?? 'Couldn’t save.');
  set(AT, String(r.at));
  emit();
  return { ok: true, at: r.at };
}

// load another device's saves onto this one (replaces this device's season, saved game, stats...)
export async function loadCode(raw) {
  const code = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const r = await call({ action: 'load', code });
  if (!r.ok) throw new Error(r.error ?? 'Couldn’t load that code.');
  for (const k of SYNC_KEYS) set(k, r.data[k] ?? null);
  set(CODE, code); set(AT, String(r.at));
  return r.at;
}

// is there a newer save under this device's code? (another device played since)
export async function newerElsewhere() {
  const code = syncCode();
  if (!code) return null;
  const r = await call({ action: 'peek', code }).catch(() => null);
  return r?.ok && r.at > syncAt() ? r.at : null;
}

// auto-save: a little after something worth saving (a game ending, a season week), and when the page is left.
// A newer save from another device is never overwritten automatically.
let timer = null;
export function autoSave(delay = 2500) {
  if (!syncCode()) return;
  clearTimeout(timer);
  timer = setTimeout(() => { saveNow().catch(() => {}); }, delay);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && syncCode()) saveNow().catch(() => {}); });

const subs = new Set();
export const onSync = (fn) => { subs.add(fn); return () => subs.delete(fn); };
const emit = () => subs.forEach((fn) => fn());
