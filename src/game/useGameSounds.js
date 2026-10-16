// Game-day sound for a live game: the crowd bed, a TV theme to open, whistles, grunts and hits, all driven by the
// engine's log (each new entry may play something).
import { useEffect, useRef } from 'react';
import { audioContext, crowd, play, playTheme, preload, startCrowd, stopCrowd, stopTheme } from './sound';

// the dice: the real recording (Long Shot's), a touch faster or slower each time
const diceRoll = () => play('dice', { rate: 0.92 + Math.random() * 0.16 });
import { settings } from './prefs';


// low boom (a sack) and a sharp crack (a big hit): synthesized so the two sound different from the plain hits
function thump(kind) {
  const vol = settings().muted ? 0 : settings().mix?.fx ?? 1;
  if (!vol) return;
  try {
    const ctx = audioContext();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = kind === 'sack' ? 'sine' : 'square';
    o.frequency.setValueAtTime(kind === 'sack' ? 120 : 420, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'sack' ? 38 : 90, t + (kind === 'sack' ? 0.5 : 0.12));
    g.gain.setValueAtTime((kind === 'sack' ? 0.55 : 0.22) * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'sack' ? 0.6 : 0.18));
    o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + 0.7);
  } catch { /* no audio */ }
}

// a whoosh of fire (ON FIRE, BRING THE HEAT, FIRE BOMB) and a kick's thud: filtered noise
function whoosh(kind = 'fire') {
  const vol = settings().muted ? 0 : settings().mix?.fx ?? 1;
  if (!vol) return;
  try {
    const ctx = audioContext();
    const t = ctx.currentTime, len = kind === 'kick' ? 0.12 : 1.1;
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate), d = b.getChannelData(0);
    for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = b; f.type = kind === 'kick' ? 'lowpass' : 'bandpass';
    f.frequency.setValueAtTime(kind === 'kick' ? 260 : 300, t);
    if (kind !== 'kick') f.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((kind === 'kick' ? 0.8 : 0.35) * vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(ctx.destination); src.start(t);
  } catch { /* no audio */ }
}


export function useGameSounds(game, { theme = true } = {}) {
  const seen = useRef(0);
  useEffect(() => {
    preload(['crowd', 'whistle', 'whistleStart', 'whistleFinal', 'grunt', 'hit', 'step', 'dice', 'coin', 'coinLand', 'card', 'fanfare', 'smash', 'cheer', 'boo', 'fireworks', 'smoke']);
    startCrowd();
    if (theme) playTheme(26).then(() => crowd(0.45, 22, 0.5)); // duck the crowd under the theme
    return () => { stopTheme(0.6); stopCrowd(0.8); };
  }, [game]);
  const log = game.state.log;
  useEffect(() => {
    const fresh = log.filter((e) => e.id > seen.current);
    if (!fresh.length) return;
    seen.current = log[log.length - 1].id;
    if (fresh.length > 12) return; // catching up (a resume / a burst): don't play them all at once
    for (const e of fresh) cue(e);
  }, [log]);
}

// the home crowd (side 0, the HOME team on the team select / the host online): cheers when the home team does well,
// boos when the away team does, or when the home team messes up. One reaction at a time (a touchdown always gets one).
let lastFans = 0;
const sideOf = (pid) => (typeof pid === 'string' ? Number(pid.split(':')[0]) : null);
function fans(goodFor, big = false) {
  if (goodFor == null) return;
  const now = performance.now();
  if (!big && now - lastFans < 3500) return;
  lastFans = now;
  play(goodFor === 0 ? 'cheer' : 'boo', { vol: big ? 1 : 0.8 });
}
function react(e) {
  switch (e.kind) {
    case 'td': case 'safety': case 'fieldgoal': fans(e.side, true); break;
    case 'turnover': fans(e.side, true); break;
    case 'sack': fans(1 - sideOf(e.pid)); break; // whoever was sacked, the other side did well
    case 'kick': if (!e.good && e.side != null) fans(1 - e.side); break; // a missed kick
    case 'catch': if ((e.yds ?? 0) >= 25) fans(sideOf(e.pid)); break;
    case 'knockdown': fans(1 - sideOf(e.pid)); break; // flattened: good for the other side
    case 'onfire': fans(sideOf(e.pid)); break;
    default:
  }
}

function cue(e) {
  react(e);
  switch (e.kind) {
    case 'half': stopTheme(2); play('whistleStart'); crowd(1.6, 1.5); break;
    case 'snap': crowd(1.25, 0.8); break;
    case 'down': crowd(0.7, 2.5); break; // the crowd settles while the teams line up
    case 'whistle': play('whistle'); break;
    case 'final': play('whistleFinal'); crowd(2, 4); break;
    case 'check':
      diceRoll();
      if (['block', 'shove', 'juke', 'shake', 'tackle', 'dirty'].includes(e.action)) setTimeout(() => play('grunt', { vol: 0.9 }), 650);
      if (e.action === 'tackle' && e.success) setTimeout(() => { play('hit'); crowd(1.6, 1.2); }, 700);
      if (e.action === 'pass') crowd(1.3, 1.2);
      break;
    case 'sport': case 'scatter': case 'dice': diceRoll(); break;
    case 'push': play('hit', { vol: 0.7 }); break;
    // running on the turf: as long as the cube's walk (6.5 squares a second on the board), quieter for a follow-up
    case 'move': case 'motion': {
      const n = e.path?.length ?? 1;
      play('step', { len: Math.min(2.2, Math.max(0.35, n / 6.5 + 0.1)), rate: 0.92 + Math.random() * 0.16, vol: e.followUp ? 0.55 : 0.85 });
      break;
    }
    case 'knockdown': case 'fumble': play('hit'); play('grunt'); thump('hit'); crowd(1.8, 1.5); break;
    case 'sack': thump('sack'); play('hit', { vol: 0.6 }); play('grunt'); setTimeout(() => play('grunt', { vol: 0.8 }), 260); crowd(2.6, 2.6); break;
    case 'tackle': thump('hit'); break;
    case 'catch': crowd(1.7, 1.5); break;
    case 'turnover': crowd(2, 2); break;
    case 'td': crowd(2.6, 4.5); break;
    case 'safety': crowd(2.2, 3); break;
    case 'cointoss': play('coin'); setTimeout(() => play('coinLand'), 1200); break;
    case 'timeout': play('whistle'); crowd(0.6, 2); break;
    case 'onfire': case 'heat': case 'firebomb': case 'fuego': whoosh(); crowd(2, 2); break;
    case 'stiffarm': play('hit'); thump('hit'); crowd(1.8, 1.4); break;
    case 'spin': case 'dodge': case 'intercept': crowd(1.8, 1.4); break;
    case 'dogpile': play('grunt'); setTimeout(() => play('hit'), 200); crowd(2, 2); break;
    case 'kick': whoosh('kick'); diceRoll(); crowd(1.4, 2); break;
    case 'fieldgoal': crowd(2.4, 3); break;
    default:
  }
}
