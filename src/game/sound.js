// Game-day sound: the owner's recordings in public/sfx/*.mp3, cut into clips by src/data/sounds.json
// ({ slot: [{ file, start, len, vol, fade, loop?, name? }] }, one picked at random each time). The sound editor
// (?view=sounds) can override that table for everyone. Mixer channels from Settings: fx, crowd, music.
import BUILTIN from '../data/sounds.json';

// the built-in clip table, overridden by whatever the sound editor saved (loaded once at start)
let SOUNDS = { ...BUILTIN };
export const builtinSounds = () => BUILTIN;
export function setSoundConfig(map) { SOUNDS = { ...BUILTIN, ...map }; }
export async function loadSoundOverrides() {
  try { const r = await fetch('/api/sounds'); if (!r.ok) return; const j = await r.json(); if (j?.sounds) setSoundConfig(j.sounds); } catch { /* the built-in clips */ }
}
export const decodeFile = (file) => (wake() ? load(file) : Promise.resolve(null));
export const audioNow = () => ctx?.currentTime ?? 0;
import { settings, onSettings } from './prefs';

const CHANNEL = { crowd: 'crowd', theme: 'music' };
const level = (slot) => settings().mix?.[CHANNEL[slot] ?? 'fx'] ?? 1;

let ctx = null;
const AC = () => (typeof window !== 'undefined' ? window.AudioContext || window.webkitAudioContext : null);
function wake() {
  if (!AC()) return null;
  ctx ??= new (AC())();
  if (ctx.state === 'closed') ctx = new (AC())();
  if (ctx.state !== 'running') ctx.resume().catch(() => {}); // iPad: 'suspended' or 'interrupted' (a call, the lock screen)
  return ctx;
}
// what the player can hear right now: 'muted' (Settings), 'off' (the browser hasn't let audio start yet: needs a
// tap), or 'on'. And a nudge to get it going (a tap on the sound button).
export function audioState() {
  const m = settings().mix ?? {};
  if (settings().muted || (!m.fx && !m.crowd && !m.music)) return 'muted';
  return ctx && ctx.state === 'running' ? 'on' : 'off';
}
export function nudgeAudio() { const c = wake(); applyMute(); return c?.resume?.().catch(() => {}); }
// an <audio> element played through the mixer (the jukebox): its own gain, into the master (so the mute applies)
const mediaNodes = new WeakMap();
export function connectMedia(el) {
  const ac = wake();
  if (!ac || !el) return null;
  let n = mediaNodes.get(el);
  if (!n || n.gain.context !== ac) {
    try { const src = ac.createMediaElementSource(el), gain = ac.createGain(); src.connect(gain).connect(out()); n = { src, gain }; mediaNodes.set(el, n); } catch { return null; }
  }
  return n.gain;
}
export const musicLevel = () => level('theme');
// run something once audio is unlocked by a tap (the jukebox's blocked menu track)
const unlockSubs = new Set();
export const onAudioUnlock = (fn) => { unlockSubs.add(fn); return () => unlockSubs.delete(fn); };
// the one audio context every sound shares (the synthesized dice, hits and coin too): iPad unlocks one per tap
export const audioContext = () => wake();
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
// Every sound control (Settings, the pause menu, the game's sound button, the mixer) only changes the one setting;
// the engine follows it here: the master mute, the crowd and music levels while they play, and a crowd that never
// started because the game began muted starts now.
onSettings(() => {
  applyMute();
  if (!ctx) return;
  const t = ctx.currentTime;
  if (bed) { const g = bed.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(Math.max(0.0001, bed.base0 * level('crowd')), t + 0.2); bed.base = bed.base0 * level('crowd'); }
  if (music) { const g = music.gain.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(Math.max(0.0001, music.base0 * level('theme')), t + 0.2); }
  if (!settings().muted && crowdWanted && !bed && !bedStarting) startCrowd();
});

const buffers = {};
const load = (file) => (buffers[file] ??= fetch(`/sfx/${file}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).catch(() => null));
// (the TV themes are never decoded: that file is 5+ minutes of music, ~120 MB once decoded, which an iPad can't
// spare. They stream from the file instead: playTheme.)
export function preload(slots) { if (!wake()) return; for (const s of slots) if (s !== 'theme') for (const c of SOUNDS[s] ?? []) load(c.file); }

// one clip -> { stop(fade), gain } ; loop clips keep going until stopped
export async function playClip(c, mix = 1, { late = 2.5, rate = 1 } = {}) {
  if (!wake() || settings().muted) return null;
  const asked = performance.now();
  const buf = await load(c.file);
  if (!buf) return null;
  // a sound whose file took a long time to arrive is skipped rather than played way too late
  if (!c.loop && late && (performance.now() - asked) / 1000 > late) return null;
  const start = c.start ?? 0;
  const len = Math.max(0.05, Math.min(c.len ?? buf.duration - start, buf.duration - start));
  const fade = Math.min(c.fade ?? 0.1, len / 2);
  const src = ctx.createBufferSource(), gain = ctx.createGain(), t = ctx.currentTime, v = (c.vol ?? 1) * mix;
  src.buffer = buf;
  src.playbackRate.value = rate; // a touch faster / slower so repeats don't sound identical
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

// a random clip of a slot (never the same one twice running). opts: { vol, pick: index, len, rate }
const lastPick = {};
export function play(slot, opts = {}) {
  const list = SOUNDS[slot];
  if (!list?.length) return Promise.resolve(null);
  let i = opts.pick ?? Math.floor(Math.random() * list.length);
  if (opts.pick == null && list.length > 1 && i === lastPick[slot]) i = (i + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length;
  lastPick[slot] = i;
  const c = list[i];
  // a clip cut short (len) is measured in the clip's own time, so a faster rate still fills the same seconds
  const rate = opts.rate ?? 1;
  return playClip(opts.len ? { ...c, len: Math.min(c.len, opts.len * rate) } : c, level(slot) * (opts.vol ?? 1), { rate });
}

// ---------- the crowd: a bed that never stops, with swells (big plays) and hushes (pre-snap) ----------
let bed = null, bedStarting = null, crowdWanted = false;
export async function startCrowd() {
  crowdWanted = true;
  if (bed || bedStarting) return;
  bedStarting = play('crowd'); // a loop: never skipped for being late
  bed = await bedStarting;
  if (bed) bed.base0 = bed.base / (level('crowd') || 1); // its level before the mixer, so mixer changes rescale it
  bedStarting = null;
}
export function stopCrowd(f = 1.2) { crowdWanted = false; bed?.stop(f); bed = null; }
// ramp the bed to `x` times its level for `hold` seconds, then back
export function crowd(x, hold = 1.5, ramp = 0.25) {
  if (!bed || !ctx) return;
  const g = bed.gain.gain, t = ctx.currentTime, base = Math.max(0.0001, bed.base);
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(Math.max(0.0001, base * x), t + ramp);
  g.setValueAtTime(Math.max(0.0001, base * x), t + ramp + hold);
  g.linearRampToValueAtTime(Math.max(0.0001, base), t + ramp + hold + 1.2);
}

// ---------- music: a TV theme to open the game ----------
let music = null;
let themeToken = 0; // a stop that lands while the theme is still loading cancels it
// streamed from the file through an <audio> element into the mixer (no decoding the whole file). iPad only lets a
// media element start from a tap, so the first tap primes it (unlockAudioOnFirstTap).
let themeEl = null, themeNode = null;
function themeElement(file) {
  if (!themeEl) { themeEl = new Audio(`/sfx/${file}.mp3`); themeEl.preload = 'auto'; themeEl.playsInline = true; }
  return themeEl;
}
async function streamClip(c, mix) {
  const ac = wake();
  if (!ac || settings().muted) return null;
  const el = themeElement(c.file);
  try {
    if (!themeNode || themeNode.context !== ac) themeNode = ac.createMediaElementSource(el);
  } catch { return null; }
  const gain = ac.createGain(), v = (c.vol ?? 1) * mix, t = ac.currentTime, fade = Math.min(c.fade ?? 0.5, c.len / 2);
  themeNode.disconnect();
  themeNode.connect(gain).connect(out());
  gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(v, t + fade);
  el.currentTime = c.start ?? 0;
  try { await el.play(); } catch { return null; }
  const end = setTimeout(() => clip.stop(fade), Math.max(0, (c.len - fade) * 1000));
  const clip = {
    gain, base: v,
    stop(f = 0.5) {
      clearTimeout(end);
      try { const n = ac.currentTime; gain.gain.cancelScheduledValues(n); gain.gain.setValueAtTime(gain.gain.value, n); gain.gain.linearRampToValueAtTime(0.0001, n + f); } catch { /* done */ }
      setTimeout(() => { if (music === clip || !music) el.pause(); }, f * 1000 + 60);
    },
  };
  return clip;
}
export async function playTheme(seconds = 24) {
  stopTheme(0.2);
  const token = themeToken;
  const list = SOUNDS.theme ?? [];
  if (!list.length) return null;
  const c = list[Math.floor(Math.random() * list.length)];
  const clip = await streamClip({ ...c, len: Math.min(c.len, seconds) }, level('theme'));
  if (token !== themeToken) { clip?.stop(0.3); return null; }
  if (clip) clip.base0 = clip.base / (level('theme') || 1);
  music = clip;
  return c.name;
}
export function stopTheme(f = 1.5) { themeToken++; music?.stop(f); music = null; }

// Browsers only start audio from a tap / key. iPad Safari / Chrome want it inside a touchend or click (not pointerdown),
// with a sound actually started in that moment, and they suspend the context again after calls, the lock screen or
// an app switch. So: on every tap while it isn't running, resume it and play a silent blip; and warm up every clip
// file once it's awake, so the first whistle isn't waiting on a download.
export function unlockAudioOnFirstTap() {
  if (typeof window === 'undefined') return;
  let warmed = false;
  const go = () => {
    const c = wake();
    if (!c) return;
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch { /* fine */ }
    // prime the theme's <audio> element inside this tap, so it may play later without one
    const theme = SOUNDS.theme?.[0];
    if (theme && !themeEl) { const el = themeElement(theme.file); el.muted = true; el.play().then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; }); }
    if (!warmed) { warmed = true; setTimeout(() => preload(Object.keys(SOUNDS).filter((k) => k !== 'theme')), 300); }
    setTimeout(() => unlockSubs.forEach((fn) => fn()), 50);
  };
  for (const ev of ['touchend', 'click', 'keydown', 'pointerup']) window.addEventListener(ev, () => { if (!ctx || ctx.state !== 'running') go(); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });
}
