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
import { useShot } from './shots';
import { useGameSounds } from './useGameSounds';

function setupGame(bump) {
  const pick = () => TEAMS[Math.floor(Math.random() * TEAMS.length)];
  const a = pick(); let b = pick(); while (b.id === a.id) b = pick();
  const g = new Game({ teams: [teamSetup({ team: a.id, uni: 'home' }), teamSetup({ team: b.id, uni: 'home' })], seed: Date.now(), agents: [() => null, () => null] }, { onChange: bump });
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
    scatter: () => { const c = holder(); game.log('Scatter (Lab).', 'scatter', { dice: [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)], from: [c.col, c.row], to: [c.col, c.row] }); },
  };
  return (
    <div className="game">
      <Stage className="game-stage">
        <Board game={game} view={view} onFree={() => setView('free')} tiles={[]} shot={shot} />
      </Stage>
      <div className={`lab-bar glass ${shot ? 'hide' : ''}`}>
        <h3>Moment Lab</h3>
        <div className="btns">
          <button className="btn primary" onClick={moments.throw}>Long throw</button>
          <button className="btn" onClick={moments.hit}>Big hit</button>
          <button className="btn" onClick={moments.sack}>Sack</button>
          <button className="btn" onClick={moments.knock}>Knocked down</button>
          <button className="btn" onClick={moments.td}>Touchdown</button>
          <button className="btn" onClick={moments.dice}>Dice roll</button>
          <button className="btn" onClick={moments.scatter}>Scatter dice</button>
          <button className="btn" onClick={reseed}>New teams / reset</button>
          <a className="btn" href="/">Home</a>
        </div>
        <Chips small value={view} onChange={setView} options={VIEWS} />
        <p className="hint">Calm motion (Settings) turns the cinematics off.</p>
      </div>
    </div>
  );
}
