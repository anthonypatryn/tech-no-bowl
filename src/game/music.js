// The jukebox: the owner's ESPN NFL Primetime cuts (public/music, from tools/cut_music.py), streamed one at a time
// through an <audio> element into the sound mixer, so the one mute and the Music level apply. It plays on the menus
// (Settings: Menu music), at half time and the final whistle (Music at breaks), and during play if asked (Music
// during games). The ♪ player picks tracks by hand.
import TRACKS from '../data/music.json';
import { connectMedia, musicLevel, onAudioUnlock } from './sound';
import { settings, onSettings } from './prefs';

export { TRACKS };
const el = typeof Audio !== 'undefined' ? new Audio() : null;
if (el) { el.preload = 'none'; el.playsInline = true; }
let cur = -1, playing = false, scene = 'menu', want = false, fadeT = null;
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());
export const onMusic = (fn) => { subs.add(fn); return () => subs.delete(fn); };
export const nowPlaying = () => ({ track: TRACKS[cur] ?? null, index: cur, playing });

// the jukebox's own gain follows the Music level (the mixer's master already handles mute)
function level(v = 1) { const g = connectMedia(el); if (g) { g.gain.cancelScheduledValues(0); g.gain.value = musicLevel() * v; } return g; }
onSettings(() => { if (playing) level(); });

export function playTrack(i) {
  if (!el || !TRACKS.length) return;
  clearInterval(fadeT);
  cur = ((i % TRACKS.length) + TRACKS.length) % TRACKS.length;
  el.src = `/${TRACKS[cur].file}`;
  level();
  want = true;
  el.play().then(() => { playing = true; emit(); }).catch(() => { playing = false; emit(); }); // blocked until a tap: onAudioUnlock retries
  emit();
}
const randomOther = () => { if (TRACKS.length < 2) return 0; let i; do { i = Math.floor(Math.random() * TRACKS.length); } while (i === cur); return i; };
export const next = () => playTrack(settings().musicShuffle === false ? cur + 1 : randomOther());
export const prev = () => playTrack(cur - 1);
export function toggle() {
  if (!el) return;
  if (playing) { stopMusic(0.4); return; }
  if (cur < 0) next(); else { want = true; level(); el.play().then(() => { playing = true; emit(); }).catch(() => {}); }
}
export function stopMusic(fade = 1.2) {
  want = false;
  if (!el || !playing) { playing = false; emit(); return; }
  const g = connectMedia(el);
  const steps = Math.max(1, Math.round(fade * 20));
  let k = 0;
  const from = g ? g.gain.value : 1;
  clearInterval(fadeT);
  fadeT = setInterval(() => {
    k++;
    if (g) g.gain.value = from * (1 - k / steps);
    if (k >= steps) { clearInterval(fadeT); el.pause(); playing = false; emit(); }
  }, 50);
}
if (el) el.addEventListener('ended', () => { if (want) next(); });

// where we are: 'menu' (Menu music), 'game' (only with Music during games), 'break' (half time / the final whistle,
// Music at breaks). The game's own TV theme and crowd take over at kick-off.
export function musicScene(next) {
  scene = next;
  const st = settings();
  const on = next === 'menu' ? st.musicMenus !== false : next === 'game' ? !!st.musicGame : st.musicBreaks !== false;
  if (on && !playing) playTrack(randomOther());
  if (!on && playing && next !== 'break') stopMusic(next === 'game' ? 2 : 1.2);
}
// a tap unlocked audio: a menu track that was blocked starts now
onAudioUnlock(() => { if (want && !playing && el) el.play().then(() => { playing = true; emit(); }).catch(() => {}); else if (!playing && scene === 'menu' && settings().musicMenus !== false && cur < 0) playTrack(randomOther()); });
