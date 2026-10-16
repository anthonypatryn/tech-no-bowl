// Per-device settings (remembered in localStorage): text size, calm motion, field detail and the sound mixer.
// Plain module + a tiny hook so non-React code (sound, the 3D field) can read it too.
// (Named prefs.js, not settings.js: Windows treats settings.js and Settings.jsx as the same file.)
import { useEffect, useReducer } from 'react';

const KEY = 'tb-settings';
const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// sound is ON by default. SOUND_V: bumping it turns sound back on (and the mixer back to normal) once for everyone,
// clearing a mute saved by older builds whose sound controls didn't agree with each other
const SOUND_V = 2;
const DEFAULTS = { text: 'normal', calm: !!reduceMotion, fieldHi: true, clocks: false, speed: 'normal', quick: false, cb: false, autoEnd: true, keys: {}, muted: false, musicMenus: true, musicBreaks: true, musicGame: false, musicShuffle: true, mix: { fx: 1, crowd: 0.75, music: 0.75 }, soundV: SOUND_V };

let cur = DEFAULTS;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
  cur = { ...DEFAULTS, ...saved, mix: { ...DEFAULTS.mix, ...saved.mix }, keys: { ...saved.keys } };
  if (saved.soundV !== SOUND_V) { cur = { ...cur, muted: false, mix: { ...DEFAULTS.mix }, soundV: SOUND_V }; localStorage.setItem(KEY, JSON.stringify(cur)); }
} catch { /* defaults */ }
const subs = new Set();
// non-React code (the sound engine) follows every change too
export function onSettings(fn) { subs.add(fn); return () => subs.delete(fn); }

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
