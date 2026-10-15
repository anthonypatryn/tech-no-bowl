// Game-day sound for a live game: the crowd bed, a TV theme to open, whistles, grunts and hits, all driven by the
// engine's log (each new entry may play something).
import { useEffect, useRef } from 'react';
import { crowd, play, playTheme, preload, startCrowd, stopCrowd, stopTheme } from './sound';
import { settings } from './prefs';

// a dice rattle: quick synthesized clicks (no recording for it)
function rattle() {
  const vol = settings().muted ? 0 : settings().mix?.fx ?? 1;
  if (!vol) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = (rattle.ctx ??= new AC());
    const t0 = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const t = t0 + i * (0.05 + Math.random() * 0.05);
      const b = ctx.createBuffer(1, 600, ctx.sampleRate), d = b.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = (Math.random() * 2 - 1) * Math.exp(-k / 90);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = b; f.type = 'bandpass'; f.frequency.value = 2200 + Math.random() * 1800; g.gain.value = 0.18 * vol * (1 - i / 7);
      s.connect(f).connect(g).connect(ctx.destination); s.start(t);
    }
  } catch { /* no audio */ }
}

export function useGameSounds(game) {
  const seen = useRef(0);
  useEffect(() => {
    preload(['crowd', 'whistle', 'whistleStart', 'whistleFinal', 'grunt', 'hit', 'theme']);
    startCrowd();
    playTheme(26).then(() => crowd(0.45, 22, 0.5)); // duck the crowd under the theme
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

function cue(e) {
  switch (e.kind) {
    case 'half': stopTheme(2); play('whistleStart'); crowd(1.6, 1.5); break;
    case 'snap': crowd(1.25, 0.8); break;
    case 'down': crowd(0.7, 2.5); break; // the crowd settles while the teams line up
    case 'whistle': play('whistle'); break;
    case 'final': play('whistleFinal'); crowd(2, 4); break;
    case 'check':
      rattle();
      if (e.action === 'block' || e.action === 'tackle') setTimeout(() => play('grunt', { vol: 0.9 }), 650);
      if (e.action === 'tackle' && e.success) setTimeout(() => { play('hit'); crowd(1.6, 1.2); }, 700);
      if (e.action === 'pass') crowd(1.3, 1.2);
      break;
    case 'sport': case 'scatter': case 'dice': rattle(); break;
    case 'push': play('hit', { vol: 0.7 }); break;
    case 'knockdown': case 'fumble': play('hit'); play('grunt'); crowd(1.8, 1.5); break;
    case 'sack': play('hit'); play('grunt'); crowd(2.1, 2); break;
    case 'catch': crowd(1.7, 1.5); break;
    case 'turnover': crowd(2, 2); break;
    case 'td': crowd(2.6, 4.5); break;
    case 'safety': crowd(2.2, 3); break;
    default:
  }
}
