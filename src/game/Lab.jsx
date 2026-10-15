// ?view=moments — Moment Lab: fire each cinematic and roll on demand on a real board, for tuning the shots,
// the dice and the sound without waiting for them to happen in a game.
import { useEffect, useMemo, useReducer, useState } from 'react';
import { Stage } from '../three/Stage';
import { Board, VIEWS } from '../three/Board';
import { Chips } from './ui';
import { Game } from '../engine/game.js';
import { autoDefense, autoOffense } from '../engine/formations.js';
import { START_LINE } from '../engine/board.js';
import { TEAMS } from '../data/art';
import { teamSetup } from './useGame';
import { useShot, calloutFor } from './shots';

// the ability callout banner (same as in a game)
function Callout({ s }) {
  const call = [...s.log].slice(-4).reverse().find((e) => calloutFor(e));
  const [on, setOn] = useState(null);
  useEffect(() => {
    if (!call) return;
    setOn(call.id);
    const t = setTimeout(() => setOn(null), 1900);
    return () => clearTimeout(t);
  }, [call?.id]);
  return call && on === call.id ? <div className={`callout ${['onfire', 'heat', 'fuego', 'firebomb'].includes(call.kind) ? 'hot' : ''}`} key={call.id}><span>{calloutFor(call)}</span></div> : null;
}
import { useGameSounds } from './useGameSounds';

function setupGame(bump) {
  const pick = () => TEAMS[Math.floor(Math.random() * TEAMS.length)];
  const a = pick(); let b = pick(); while (b.id === a.id) b = pick();
  // ALL PRO so the goal posts are up; INFERNO's flames show on anyone marked on fire
  const g = new Game({ teams: [teamSetup({ team: a.id, uni: 'home' }), teamSetup({ team: b.id, uni: 'home' })], seed: Date.now(), mode: 'allpro', agents: [() => null, () => null] }, { onChange: bump });
  const s = g.state;
  s.offense = 0; s.line = START_LINE['-1']; s.spot = 6; s.down = 1; s.phase = 'play';
  s.play = { startOffense: 0, line: s.line, forwardDone: false, crossed: false, passThrown: false, adjustUsed: [false, false], activations: 0 };
  const ctx = { line: s.line, dir: -1, col: 6 };
  const ro = g.roster(0).map((p) => ({ num: p.num, skill: p.skill }));
  const off = autoOffense(ro, ctx);
  for (const sp of off) Object.assign(s.players[`0:${sp.num}`], { col: sp.col, row: sp.row });
  const def = autoDefense(g.roster(1).map((p) => ({ num: p.num, skill: p.skill })), off, ctx);
  for (const sp of def) Object.assign(s.players[`1:${sp.num}`], { col: sp.col, row: sp.row });
  const qb = g.roster(0).find((p) => p.col === 6 && p.row === 19) ?? g.roster(0)[0];
  s.ball = { at: 'held', pid: qb.pid };
  return g;
}

// every moment the Lab can fire, in order (the Art Review's Moments tab links to each: ?view=moments&m=key)
export const MOMENTS = [
  ['throw', 'Long throw'], ['hit', 'Big hit (tackle)'], ['block', 'Block'], ['sack', 'Sack'], ['knock', 'Knocked down'], ['td', 'Touchdown'],
  ['onfire', 'ON FIRE'], ['heat', 'Bring the heat'], ['stiffarm', 'Stiff arm'], ['spin', 'Spin move'], ['juke', 'Juke'], ['shove', 'Shove'],
  ['intercept', 'Interceptor'], ['fuego', 'En fuego'], ['firebomb', 'Fire bomb'], ['dogpile', 'Dogpile'], ['fg', 'Field goal: good'], ['fgmiss', 'Field goal: no good'],
  ['dice', 'Dice roll'], ['scatter', 'Scatter dice'],
];

export default function Lab() {
  const [, bump] = useReducer((x) => x + 1, 0);
  const [seed, reseed] = useReducer((x) => x + 1, 0);
  const game = useMemo(() => setupGame(bump), [seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState('broadcast');
  const s = game.state;
  const shot = useShot(s.log, s.players);
  useGameSounds(game);
  useEffect(() => { bump(); }, [game]);

  const holder = () => s.players[s.ball.pid] ?? game.roster(0)[0];
  const nearDef = (c) => game.roster(1).filter((p) => !p.down).sort((x, y) => (Math.abs(x.col - c.col) + Math.abs(x.row - c.row)) - (Math.abs(y.col - c.col) + Math.abs(y.row - c.row)))[0];
  // put defender d right next to c (in front of him), so a contact moment has someone to hit
  const square = (d, c) => { d.col = c.col; d.row = c.row - 1; d.down = false; };
  const contact = (actor, target, action, extra = {}) => game.log(`${game.name(actor)} ${action}s ${game.name(target)} (Lab).`, 'check',
    roll({ pid: actor.pid, action, target: target.pid, tat: [target.col, target.row], result: 'total', success: true, ...extra }));
  const roll = (data) => { const d = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]; return { dice: d, total: d[0] + d[1], ...data }; };
  const moments = {
    throw: () => {
      const qb = holder();
      const wr = game.roster(0).filter((p) => p.pid !== qb.pid).sort((a, b) => a.row - b.row)[0];
      const to = [Math.max(0, Math.min(12, wr.col)), Math.max(2, qb.row - 10)];
      wr.col = to[0]; wr.row = to[1];
      bump();
      // let the receiver get there first (a real catch never teleports him), then throw
      setTimeout(() => {
        game.log(`${game.name(qb)} throws 10 (Lab).`, 'check', roll({ pid: qb.pid, action: 'pass', from: [qb.col, qb.row], to, dist: 10, result: 'total', success: true }));
        s.ball = { at: 'held', pid: wr.pid };
        game.log(`Caught by ${game.name(wr)}!`, 'catch', { pid: wr.pid });
      }, 400);
    },
    hit: () => {
      const c = holder();
      const d = game.roster(1).find((p) => Math.abs(p.col - c.col) <= 1 && Math.abs(p.row - c.row) <= 1) ?? game.roster(1)[0];
      game.log(`${game.name(d)} tackles ${game.name(c)} (Lab).`, 'check', roll({ pid: d.pid, action: 'tackle', target: c.pid, result: 'total', success: true }));
      c.down = true;
      game.log(`${game.name(c)} is brought down.`, 'tackle', { pid: c.pid, at: [c.col, c.row] });
    },
    sack: () => { const c = holder(); c.down = true; game.log(`SACKED (Lab).`, 'sack', { pid: c.pid }); },
    knock: () => {
      const v = game.roster(1).find((p) => !p.down) ?? game.roster(1)[0];
      game.log(`Block (Lab).`, 'check', roll({ pid: holder().pid, action: 'block', result: 'total', success: true, crit: true }));
      v.down = true;
      game.log(`${game.name(v)} is knocked down (Lab).`, 'knockdown', { pid: v.pid });
    },
    td: () => {
      const c = holder(); c.down = false; c.row = 1;
      game.log(`TOUCHDOWN ${game.team(0).name}! (Lab)`, 'td', { side: 0, pid: c.pid, at: [c.col, c.row] });
    },
    dice: () => { const c = holder(); game.log('Block (Lab).', 'check', roll({ pid: c.pid, action: 'block', result: 'partial', success: true })); },
    block: () => {
      const c = holder(), d = nearDef(c); square(d, c); bump();
      setTimeout(() => {
        contact(c, d, 'block');
        const from = [d.col, d.row]; d.row -= 1;
        game.log(`${game.name(d)} is driven back.`, 'push', { pid: d.pid, from, to: [d.col, d.row], by: c.pid });
      }, 300);
    },
    shove: () => {
      const c = holder(), d = nearDef(c); square(d, c); bump();
      setTimeout(() => {
        contact(c, d, 'shove');
        const from = [d.col, d.row]; d.row -= 2;
        game.log(`${game.name(d)} is SHOVED back 2!`, 'push', { pid: d.pid, from, to: [d.col, d.row], by: c.pid, shove: true });
      }, 300);
    },
    juke: () => { const c = holder(), d = nearDef(c); square(d, c); bump(); setTimeout(() => contact(c, d, 'juke'), 300); },
    onfire: () => { const c = holder(); c.onFire = true; game.log(`${game.name(c)} is ON FIRE! (Lab)`, 'onfire', { pid: c.pid, side: 0 }); },
    heat: () => {
      const c = holder(), d = nearDef(c); square(d, c); c.onFire = true; bump();
      setTimeout(() => { contact(c, d, 'block', { heat: true, pm: 4, matches: 1 }); d.down = true; game.log('BRING THE HEAT! (Lab)', 'heat', { pid: c.pid, target: d.pid }); }, 300);
    },
    stiffarm: () => {
      const c = holder(), d = nearDef(c); square(d, c); bump();
      setTimeout(() => { contact(d, c, 'tackle', { result: 'fail', success: false }); d.down = true; game.log('STIFF ARM! (Lab)', 'stiffarm', { pid: c.pid, by: d.pid }); }, 300);
    },
    spin: () => {
      const c = holder(), d = nearDef(c); square(d, c); bump();
      setTimeout(() => {
        contact(d, c, 'tackle', { result: 'fail', success: false });
        const a = [c.col, c.row], b = [d.col, d.row];
        c.col = b[0]; c.row = b[1]; d.col = a[0]; d.row = a[1];
        game.log('SPIN MOVE! (Lab)', 'spin', { pid: c.pid, with: d.pid, from: a, to: b });
      }, 300);
    },
    intercept: () => { const d = nearDef(holder()); game.log(`${game.name(d)} jumps the route! (Lab)`, 'intercept', { pid: d.pid, to: [d.col, d.row] }); },
    fuego: () => { const c = holder(); game.log('EN FUEGO! (Lab)', 'fuego', { pid: c.pid, skill: 'JUKE' }); },
    firebomb: () => { const c = holder(); game.log('FIRE BOMB! (Lab)', 'firebomb', { pid: c.pid }); },
    dogpile: () => {
      const c = holder(); c.down = true;
      const d = nearDef(c); square(d, c); bump();
      setTimeout(() => game.log(`DOGPILE! (Lab)`, 'dogpile', { pid: d.pid }), 300);
    },
    fg: () => { const d = [5, 6, 4]; game.log('Field goal (Lab).', 'kick', { side: 0, dice: d, total: 15, dist: 12, good: true, from: [6, 10], dir: -1 }); setTimeout(() => game.log('FIELD GOAL (Lab)', 'fieldgoal', { side: 0 }), 2600); },
    fgmiss: () => { const d = [1, 3, 2]; game.log('Field goal (Lab).', 'kick', { side: 0, dice: d, total: 6, dist: 14, good: false, from: [6, 12], dir: -1 }); },
    scatter: () => { const c = holder(); game.log('Scatter (Lab).', 'scatter', { dice: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], from: [c.col, c.row], to: [c.col, c.row] }); },
  };
  // ?view=moments&m=key fires that moment once the board is up (links from the Art Review)
  useEffect(() => {
    const m = new URLSearchParams(location.search).get('m');
    if (!m || !moments[m]) return;
    const t = setTimeout(moments[m], 900);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="game">
      <Stage className="game-stage">
        <Board game={game} view={view} onFree={() => setView('free')} tiles={[]} shot={shot} />
      </Stage>
      <Callout s={s} />
      <div className={`lab-bar glass ${shot ? 'hide' : ''}`}>
        <h3>Moment Lab</h3>
        <div className="btns">
          {MOMENTS.map(([k, label], i) => <button key={k} className={`btn ${i === 0 ? 'primary' : ''}`} onClick={moments[k]}>{label}</button>)}
          <button className="btn" onClick={reseed}>New teams / reset</button>
          <a className="btn" href="/">Home</a>
        </div>
        <Chips small value={view} onChange={setView} options={VIEWS} />
        <p className="hint">Calm motion (Settings) turns the cinematics off.</p>
      </div>
    </div>
  );
}
