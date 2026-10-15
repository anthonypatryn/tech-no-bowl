// Per-device settings (remembered in localStorage): text size, calm motion, field detail and the sound mixer.
// Plain module + a tiny hook so non-React code (sound, the 3D field) can read it too.
// (Named prefs.js, not settings.js: Windows treats settings.js and Settings.jsx as the same file.)
import { useEffect, useReducer } from 'react';

const KEY = 'tb-settings';
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS = { text: 'normal', calm: !!reduceMotion, fieldHi: true, clocks: false, speed: 'normal', quick: false, cb: false, keys: {}, muted: false, mix: { fx: 1, crowd: 0.75, music: 0.75 } };

let cur = DEFAULTS;
try { const saved = JSON.parse(localStorage.getItem(KEY) || '{}'); cur = { ...DEFAULTS, ...saved, mix: { ...DEFAULTS.mix, ...saved.mix }, keys: { ...saved.keys } }; } catch { /* defaults */ }
const subs = new Set();

export const settings = () => cur;
export function setSettings(patch) {
  cur = { ...cur, ...patch, mix: { ...cur.mix, ...patch.mix } };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* not saved */ }
  subs.forEach((fn) => fn());
}
export function useSettings() {
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => { subs.add(bump); return () => subs.delete(bump); }, []);
  return cur;
}

export const TEXT_ZOOM = { normal: 1, large: 1.15, larger: 1.3 };
