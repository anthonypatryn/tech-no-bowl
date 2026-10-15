// Game-day sound: the owner's recordings in public/sfx/*.mp3, cut into clips by src/data/sounds.json
// ({ slot: [{ file, start, len, vol, fade, loop?, name? }] }, one picked at random each time). The sound editor (B5)
// will edit that table. Three mixer channels from Settings: fx, crowd, music.
import SOUNDS from '../data/sounds.json';
import { settings } from './prefs';

const CHANNEL = { crowd: 'crowd', theme: 'music' };
const level = (slot) => settings().mix?.[CHANNEL[slot] ?? 'fx'] ?? 1;
export const soundConfig = () => SOUNDS;

let ctx = null;
const AC = () => (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null);
function wake() {
  if (!AC()) return null;
  ctx ??= new (AC())();
  if (ctx.state === 'closed') ctx = new (AC())();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx;
}
let master = null;
function out() {
  if (!master || master.context !== ctx) {
    master = ctx.createGain();
    master.gain.value = settings().muted ? 0 : 1;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
  }
  return master;
}
export function applyMute() {
  if (!master || !ctx) return;
  const g = master.gain, t = ctx.currentTime;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(settings().muted ? 0 : 1, t + 0.1);
}

const buffers = {};
const load = (file) => (buffers[file] ??= fetch(`/sfx/${file}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).catch(() => null));
export function preload(slots) { if (!wake()) return; for (const s of slots) for (const c of SOUNDS[s] ?? []) load(c.file); }

// one clip -> { stop(fade), gain } ; loop clips keep going until stopped
export async function playClip(c, mix = 1) {
  if (!wake() || settings().muted) return null;
  const buf = await load(c.file);
  if (!buf) return null;
  const start = c.start ?? 0;
  const len = Math.max(0.05, Math.min(c.len ?? buf.duration - start, buf.duration - start));
  const fade = Math.min(c.fade ?? 0.1, len / 2);
  const src = ctx.createBufferSource(), gain = ctx.createGain(), t = ctx.currentTime, v = (c.vol ?? 1) * mix;
  src.buffer = buf;
  if (c.loop) {
    src.loop = true; src.loopStart = start; src.loopEnd = start + len;
    gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(v, t + fade);
    src.connect(gain).connect(out()); src.start(0, start);
  } else {
    gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(v, t + Math.min(0.02, fade));
    gain.gain.setValueAtTime(v, t + Math.max(0, len - fade)); gain.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(gain).connect(out()); src.start(0, start, len);
  }
  return {
    gain, base: v,
    stop(f = 0.3) {
      try { const n = ctx.currentTime; gain.gain.cancelScheduledValues(n); gain.gain.setValueAtTime(gain.gain.value, n); gain.gain.linearRampToValueAtTime(0.0001, n + f); src.stop(n + f + 0.05); } catch { /* done */ }
    },
  };
}

// a random clip of a slot. opts: { vol, pick: index }
export function play(slot, opts = {}) {
  const list = SOUNDS[slot];
  if (!list?.length) return Promise.resolve(null);
  const c = list[opts.pick ?? Math.floor(Math.random() * list.length)];
  return playClip(opts.len ? { ...c, len: Math.min(c.len, opts.len) } : c, level(slot) * (opts.vol ?? 1));
}

// ---------- the crowd: a bed that never stops, with swells (big plays) and hushes (pre-snap) ----------
let bed = null, bedStarting = null;
export async function startCrowd() {
  if (bed || bedStarting) return;
  bedStarting = play('crowd');
  bed = await bedStarting;
  bedStarting = null;
}
export function stopCrowd(f = 1.2) { bed?.stop(f); bed = null; }
// ramp the bed to `x` times its level for `hold` seconds, then back
export function crowd(x, hold = 1.5, ramp = 0.25) {
  if (!bed || !ctx) return;
  const g = bed.gain.gain, t = ctx.currentTime, base = bed.base * (level('crowd') || 0.0001);
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(Math.max(0.0001, base * x), t + ramp);
  g.setValueAtTime(Math.max(0.0001, base * x), t + ramp + hold);
  g.linearRampToValueAtTime(Math.max(0.0001, base), t + ramp + hold + 1.2);
}

// ---------- music: a TV theme to open the game ----------
let music = null;
export async function playTheme(seconds = 24) {
  stopTheme(0.2);
  const list = SOUNDS.theme ?? [];
  if (!list.length) return null;
  const c = list[Math.floor(Math.random() * list.length)];
  music = await playClip({ ...c, len: Math.min(c.len, seconds) }, level('theme'));
  return c.name;
}
export function stopTheme(f = 1.5) { music?.stop(f); music = null; }

// browsers only start audio after a tap / key: wake it on the first one
export function unlockAudioOnFirstTap() {
  if (typeof window === 'undefined') return;
  const go = () => { wake(); window.removeEventListener('pointerdown', go); window.removeEventListener('keydown', go); };
  window.addEventListener('pointerdown', go); window.addEventListener('keydown', go);
}
