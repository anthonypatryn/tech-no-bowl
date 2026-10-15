// Runs one game against the computer: builds the engine from the match picked on the Team Picker, keeps React in
// step with it, and paces it so moves animate and dice can be read.
import { useEffect, useReducer, useState } from 'react';
import { Game } from '../engine/game.js';
import { makeAI } from '../engine/ai.js';
import { teamById } from '../data/art';
import { lineup } from '../data/abilities';
import { settings } from './prefs';

export const HUMAN = 0; // you are side 0: you attack the blue end zone (row 0), the computer attacks the orange one

// how long each kind of moment stays on screen before the next decision (ms at normal speed)
const BEATS = {
  move: (e) => 150 + 150 * (e.path?.length ?? 1), push: () => 450, check: (e) => (e.action === 'pass' && e.dist >= 8 ? 3300 : 1800), sport: () => 1300, scatter: () => 1500, dice: () => 1400, cointoss: () => 3600,
  snap: () => 700, flip: () => 500, readReact: () => 700, td: () => 3500, safety: () => 2000, whistle: () => 1300, turnover: () => 1200,
  fumble: () => 500, catch: () => 500, inflight: () => 800, offtarget: () => 300, formation: () => 450, motion: () => 700,
  handoff: () => 500, sack: () => 1700, pressure: () => 900, down: () => 500, stand: () => 350, knockdown: () => 500, tackle: () => 1500,
  adjust: () => 500, half: () => 1500, timeout: () => 800, final: () => 0,
};
export const SPEEDS = { slow: 0.7, normal: 1, fast: 1.8 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function teamSetup(sel) {
  const t = teamById(sel.team);
  return { id: t.id, name: t.name, uniform: sel.uni, roster: lineup(t, sel.picks).map((p) => ({ num: p.num, name: p.name, artNum: p.artNum, abilities: p.abilities })) };
}

export function useGame(match) {
  const [game, setGame] = useState(null);
  const [, bump] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    let raf = 0;
    const bot = makeAI(match.level);
    // the computer "thinks" for a moment before acting, so you can follow along
    const cpu = (g, side, req) => {
      const v = bot(g, side, req);
      const ms = req.type !== 'act' ? 150 : v?.kind === 'end' ? 120 : 380;
      return wait(ms / speed()).then(() => v);
    };
    const g = new Game({ teams: [teamSetup(match.you), teamSetup(match.cpu)], seed: match.seed ?? Date.now(), mode: match.mode, agents: [null, cpu] }, {
      onChange: () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; bump(); }); },
      pace: (e) => (settings().calm ? 0.5 : 1) * (BEATS[e.kind]?.(e) ?? 200),
      delay: (ms) => wait(ms / speed()),
    });
    setGame(g);
    if (import.meta.env.DEV) window.__tb = g; // poke at it from the console while developing
    // the game starts when the opening show is over (or skipped): GameView calls game.begin()
    g.begin = () => { if (g.began) return; g.began = true; g.run().catch((err) => { console.error(err); g.crashed = String(err?.stack || err); bump(); }); };
    return () => { g.stopped = true; cancelAnimationFrame(raf); };
  }, [match]);
  return game;
}

const speed = () => SPEEDS[settings().speed] ?? 1;
