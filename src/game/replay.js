// Instant replay: the last play rebuilt from the engine's log (the starting formation, then every move, push,
// hand-off, throw, scatter and knockdown), played back on the board in slow motion. The replay feeds its own log to
// the board, so cubes walk the same paths, the dice roll again and the cinematic cameras fire again.
import { useEffect, useRef, useState } from 'react';

const ENDS = ['whistle', 'td', 'safety'];
let rid = 1e7; // replayed entries get fresh ids, so dice and shots fire again
const KEEP = ['move', 'push', 'snap', 'handoff', 'catch', 'inflight', 'offtarget', 'scatter', 'knockdown', 'tackle', 'sack', 'fumble', 'stand', 'check', 'sport', 'turnover', 'td', 'safety'];

// the most recent finished play, or null
export function lastPlay(s) {
  const log = s.log;
  let end = -1;
  for (let i = log.length - 1; i >= 0; i--) if (ENDS.includes(log[i].kind)) { end = i; break; }
  if (end < 0) return null;
  let snap = -1;
  for (let i = end; i >= 0; i--) if (log[i].kind === 'snap') { snap = i; break; }
  if (snap < 0) return null;
  // starting spots: the formation entries before the snap, then any motion
  const spots = {};
  for (let i = snap; i >= 0 && Object.keys(spots).length < 2; i--) {
    const e = log[i];
    if (e.kind === 'formation' && !spots[e.side]) spots[e.side] = e.spots;
    if (e.kind === 'down' && Object.keys(spots).length) break;
  }
  if (!spots[0] || !spots[1]) return null;
  const motions = log.slice(0, snap).filter((e, i, a) => e.kind === 'motion' && i > a.findLastIndex((x) => x.kind === 'down'));
  const events = log.slice(snap, end + 1).filter((e) => KEEP.includes(e.kind) || ENDS.includes(e.kind));
  // the down it was played on (the live game has moved on to the next one by the time a replay starts)
  const down = log.slice(0, snap).findLast((e) => e.kind === 'down');
  return { id: log[end].id, spots, motions, events, down: down ? { down: down.down, line: down.line, offense: down.offense } : null, big: events.some((e) => e.kind === 'td' || e.kind === 'turnover' || (e.kind === 'catch' && e.yds >= 25)) };
}

export function startState(s, play) {
  const players = {};
  for (const p of Object.values(s.players)) {
    const sp = play.spots[p.side]?.find((x) => x.num === p.num);
    players[p.pid] = { ...p, col: sp?.col ?? null, row: sp?.row ?? null, down: false };
  }
  for (const m of play.motions) if (players[m.pid]) { players[m.pid].col = m.to[0]; players[m.pid].row = m.to[1]; }
  const d = play.down;
  return { ...s, ...(d ? { down: d.down, line: d.line, offense: d.offense } : {}), players, ball: { at: 'dead' }, log: [], phase: 'play', request: null, active: null };
}

export function apply(st, e) {
  const players = { ...st.players };
  const put = (pid, to, extra = {}) => { if (players[pid]) players[pid] = { ...players[pid], col: to[0], row: to[1], ...extra }; };
  let ball = st.ball;
  switch (e.kind) {
    case 'snap': ball = { at: 'held', pid: e.to }; break;
    case 'move': put(e.pid, e.to); break;
    case 'push': put(e.pid, e.to); break;
    case 'handoff': ball = { at: 'held', pid: e.to }; break;
    case 'catch': ball = { at: 'held', pid: e.pid }; break;
    case 'inflight': case 'offtarget': ball = { at: 'air', col: e.to[0], row: e.to[1] }; break;
    case 'scatter': if (!e.out) ball = { at: ball.at === 'air' ? 'air' : 'ground', col: e.to[0], row: e.to[1] }; break;
    case 'sport': if (e.ok && ball.at !== 'held') { const p = players[e.pid]; if (p) ball = { at: 'held', pid: e.pid }; } break;
    case 'knockdown': case 'sack': if (players[e.pid]) players[e.pid] = { ...players[e.pid], down: true }; break;
    case 'tackle': if (players[e.pid]) players[e.pid] = { ...players[e.pid], down: true }; break;
    case 'fumble': { const p = players[e.pid]; if (p) { players[e.pid] = { ...p, down: true }; ball = { at: 'ground', col: p.col, row: p.row }; } break; }
    case 'stand': if (players[e.pid]) players[e.pid] = { ...players[e.pid], down: false }; break;
    default:
  }
  return { ...st, players, ball, log: [...st.log, e] };
}

// is this moment well away from the ball (more than 4 squares)?
function far(st, e) {
  const p = e.pid && st.players[e.pid];
  const b = st.ball.at === 'held' ? st.players[st.ball.pid] : st.ball.col != null ? { col: st.ball.col, row: st.ball.row } : null;
  if (!p || !b || p.col == null || b.col == null || st.ball.pid === e.pid) return false;
  return Math.max(Math.abs(p.col - b.col), Math.abs(p.row - b.row)) > 4;
}

// how long each replayed moment holds (slow motion)
const HOLD = { move: (e) => 260 + 230 * (e.path?.length ?? 1), push: 650, check: 1500, sport: 900, scatter: 1100, catch: 900, inflight: 1300, tackle: 1600, sack: 1700, knockdown: 900, fumble: 800, td: 2600, snap: 700 };

// play a replay: returns the board state to show (null when it's over)
export function useReplay(s, play, onDone) {
  const [st, setSt] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    // no replay (or it was skipped): drop the last frame too, or the board stays frozen on it
    if (!play) { setSt(null); return undefined; }
    let cur = startState(s, play);
    // play.from: start part-way in (the touchdown replay opens where the scorer got the ball): the earlier events are
    // applied at once, off the log, so nothing animates from the snap
    let i = 0;
    for (; i < (play.from ?? 0); i++) cur = apply(cur, play.events[i]);
    cur = { ...cur, log: [] };
    setSt(cur);
    const next = () => {
      if (i >= play.events.length) { timer.current = setTimeout(() => { setSt(null); onDone(); }, 900); return; }
      const e = play.events[i++];
      cur = apply(cur, { ...e, id: ++rid });
      setSt(cur);
      // play.speed < 1 runs it quicker (the touchdown replay), but a walk always gets the time it needs on screen
      const h = HOLD[e.kind];
      let ms = (typeof h === 'function' ? h(e) : h ?? 250) * (play.speed ?? 1);
      // away from the ball (a block downfield while the camera rides with the carrier): don't make the viewer wait on it
      if (far(cur, e)) ms = Math.min(ms, e.kind === 'move' ? 150 + 165 * (e.path?.length ?? 1) : 280);
      timer.current = setTimeout(next, e.kind === 'move' ? Math.max(ms, 150 + 165 * (e.path?.length ?? 1)) : ms);
    };
    timer.current = setTimeout(next, 900);
    return () => clearTimeout(timer.current);
  }, [play?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
