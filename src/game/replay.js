// Instant replay. The engine records where every player and the ball really were after each log entry of a play
// (`game.frames`), so a replay is the actual play, not a guess: each step shows that moment's recorded positions, with
// its log entry so cubes walk the same paths and hits lunge. No dice, no choices: it plays like TV.
// (A friend's screen in an online game has no frames: it falls back to rebuilding the play from the log.)
import { useEffect, useRef, useState } from 'react';

const ENDS = ['whistle', 'td', 'safety'];
let rid = 1e7; // replayed entries get fresh ids, so shots fire again
// the moments a replay shows (the rest change nothing on the field)
const SHOW = new Set(['snap', 'move', 'push', 'handoff', 'catch', 'inflight', 'offtarget', 'scatter', 'knockdown', 'tackle', 'sack', 'fumble', 'stand', 'check',
  'sport', 'spin', 'stiffarm', 'intercept', 'dogpile', 'heat', 'turnover', 'td', 'safety', 'whistle']);
const KEEP = ['move', 'push', 'snap', 'handoff', 'catch', 'inflight', 'offtarget', 'scatter', 'knockdown', 'tackle', 'sack', 'fumble', 'stand', 'check', 'sport', 'turnover', 'td', 'safety'];

// the most recent finished play (or the one ending at log id `endId`), or null. frames = game.frames
export function lastPlay(s, frames = null, endId = null) {
  const log = s.log;
  let end = -1;
  for (let i = log.length - 1; i >= 0; i--) if (ENDS.includes(log[i].kind) && (endId == null || log[i].id <= endId)) { end = i; break; }
  if (end < 0) return null;
  let snap = -1;
  for (let i = end; i >= 0; i--) if (log[i].kind === 'snap') { snap = i; break; }
  if (snap < 0) return null;
  const all = log.slice(snap, end + 1);
  const downE = log.slice(0, snap).findLast((e) => e.kind === 'down');
  const down = downE ? { down: downE.down, line: downE.line, offense: downE.offense } : null;
  const chain = all.filter((e) => e.kind === 'activate' && e.mode === 'full').length;
  const big = all.some((e) => e.kind === 'td' || e.kind === 'turnover' || (e.kind === 'catch' && e.yds >= 25));
  const id = log[end].id;
  // exact: every step carries the recorded positions after it
  const snapFrame = frames?.get(log[snap].id);
  if (snapFrame) {
    const steps = all.filter((e) => SHOW.has(e.kind) && frames.has(e.id)).map((e) => ({ e, f: frames.get(e.id) }));
    // something the move set off (a sack, a pressure, a pickup) is logged before the move itself: show the walk first,
    // or the mover appears at the end square and then "walks" there
    for (let i = 0; i < steps.length - 1; i++) {
      const a = steps[i], b = steps[i + 1], prev = i ? steps[i - 1].f : snapFrame;
      if (a.e.kind === 'move' || b.e.kind !== 'move' || !b.e.pid) continue;
      const was = prev.p[b.e.pid], now = a.f.p[b.e.pid];
      // only when he is already standing on that walk's last square (a push or a spin move really does move him first)
      const end = b.e.path?.at(-1) ?? b.e.to;
      if (was && now && end && (was[0] !== now[0] || was[1] !== now[1]) && now[0] === end[0] && now[1] === end[1]) { steps[i] = b; steps[i + 1] = a; i++; }
    }
    return { id, exact: true, start: { p: snapFrame.p, b: { at: 'dead' } }, steps, events: steps.map((x) => x.e), all: all.map(({ id: i, kind, pid, to, mode }) => ({ id: i, kind, pid, to, mode })), chain, down, big };
  }
  // fallback: rebuild from the formations and the events
  const spots = {};
  for (let i = snap; i >= 0 && Object.keys(spots).length < 2; i--) {
    const e = log[i];
    if (e.kind === 'formation' && !spots[e.side]) spots[e.side] = e.spots;
    if (e.kind === 'down' && Object.keys(spots).length) break;
  }
  if (!spots[0] || !spots[1]) return null;
  const motions = log.slice(0, snap).filter((e, i, a) => e.kind === 'motion' && i > a.findLastIndex((x) => x.kind === 'down'));
  const events = all.filter((e) => KEEP.includes(e.kind));
  return { id, exact: false, spots, motions, events, chain, down, big };
}

// the board state for a recorded frame
function atFrame(base, f, prevBall) {
  const players = {};
  for (const [pid, p] of Object.entries(base.players)) {
    const q = f.p[pid];
    players[pid] = q ? { ...p, col: q[0], row: q[1], down: !!q[2] } : { ...p, col: null, row: null };
  }
  // the play ended (touchdown, whistle): the ball stays where it was rather than vanishing
  return { ...base, players, ball: f.b.at === 'dead' && prevBall ? prevBall : { ...f.b } };
}

function startState(s, play) {
  const d = play.down;
  const base = { ...s, ...(d ? { down: d.down, line: d.line, offense: d.offense } : {}), log: [], phase: 'play', request: null, active: null };
  if (play.exact) {
    const from = play.from ? play.steps[play.from - 1].f : play.start;
    return atFrame(base, from, null);
  }
  const players = {};
  for (const p of Object.values(s.players)) {
    const sp = play.spots[p.side]?.find((x) => x.num === p.num);
    players[p.pid] = { ...p, col: sp?.col ?? null, row: sp?.row ?? null, down: false };
  }
  for (const m of play.motions) if (players[m.pid]) { players[m.pid].col = m.to[0]; players[m.pid].row = m.to[1]; }
  return { ...base, players, ball: { at: 'dead' } };
}

// the fallback's guesswork, one event at a time
function apply(st, e) {
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
    case 'knockdown': case 'sack': case 'tackle': if (players[e.pid]) players[e.pid] = { ...players[e.pid], down: true }; break;
    case 'fumble': { const p = players[e.pid]; if (p) { players[e.pid] = { ...p, down: true }; ball = { at: 'ground', col: p.col, row: p.row }; } break; }
    case 'stand': if (players[e.pid]) players[e.pid] = { ...players[e.pid], down: false }; break;
    default:
  }
  return { ...st, players, ball };
}

// is this moment well away from the ball (more than 4 squares)?
function far(st, e) {
  const p = e.pid && st.players[e.pid];
  const b = st.ball.at === 'held' ? st.players[st.ball.pid] : st.ball.col != null ? { col: st.ball.col, row: st.ball.row } : null;
  if (!p || !b || p.col == null || b.col == null || st.ball.pid === e.pid) return false;
  return Math.max(Math.abs(p.col - b.col), Math.abs(p.row - b.row)) > 4;
}

// how long each moment holds: the moves, hits, throws and skills flow on like TV
const HOLD = { move: (e) => 200 + 175 * (e.path?.length ?? 1), push: 450, check: (e) => (e.action === 'pass' ? 350 : 550), sport: 250, scatter: 800, catch: 550,
  inflight: 1300, tackle: 1200, sack: 1400, knockdown: 700, fumble: 600, td: 2400, snap: 750, spin: 900, stiffarm: 900, intercept: 900, dogpile: 1200, heat: 700 };

// play a replay: returns the board state to show (null when it's over). state.step = how many steps have played
export function useReplay(s, play, onDone) {
  const [st, setSt] = useState(null);
  const timer = useRef(null);
  useEffect(() => {
    // no replay (or it was skipped): drop the last frame too, or the board stays frozen on it
    if (!play) { setSt(null); return undefined; }
    let cur = { ...startState(s, play), step: play.from ?? 0, replayStep: play.from ?? 0 };
    if (!play.exact) for (let k = 0; k < (play.from ?? 0); k++) cur = apply(cur, play.events[k]);
    setSt(cur);
    if (import.meta.env.DEV) window.__rsStep = { step: play.from ?? 0, play, at: performance.now() };
    let i = play.from ?? 0;
    const next = () => {
      if (i >= play.events.length) { timer.current = setTimeout(() => { setSt(null); onDone(); }, 900); return; }
      const e = play.events[i];
      const shown = { ...e, id: ++rid, dice: undefined, replay: true }; // no dice on screen in a replay
      const moved = play.exact ? atFrame(cur, play.steps[i].f, cur.ball) : apply(cur, e);
      i++;
      cur = { ...moved, log: [...cur.log, shown], step: i, replayStep: i };
      if (import.meta.env.DEV) window.__rsStep = { step: i, play, at: performance.now() };
      setSt(cur);
      const h = HOLD[e.kind];
      let ms = (typeof h === 'function' ? h(e) : h ?? 250) * (play.speed ?? 1);
      // a throw: wait for the ball to land (the board flies a long throw in slow motion, ~2.2 s), or the next moment
      // starts with the ball still in the air
      if (['catch', 'inflight', 'offtarget'].includes(e.kind) && e.to) {
        const prevF = play.exact ? (i > 1 ? play.steps[i - 2].f : play.start) : null;
        const from = prevF && e.from ? prevF.p[e.from] : null;
        const d = from ? Math.hypot(from[0] - e.to[0], from[1] - e.to[1]) : 6;
        ms = Math.max(ms, (d >= 7.5 ? 2200 : 250 + d * 60) + 250);
      }
      // the touchdown: hold until its cinematic is over (it waits for the runner's walk, then plays ~3.4 s), or the
      // replay would end first and the orbit play on over the live field
      if (e.kind === 'td') {
        const walk = play.events.slice(0, i - 1).reverse().find((x) => x.kind === 'move' && x.pid === e.pid);
        ms = (Math.min(2.5, (walk?.path?.length ?? 1) / 6.5 + 0.15) + 3.6) * 1000;
      }
      // away from the ball (a block downfield while the camera rides with the carrier): don't make the viewer wait on it
      if (far(cur, e)) ms = Math.min(ms, e.kind === 'move' ? 250 + 190 * (e.path?.length ?? 1) : 280);
      // a walk always gets the time it needs on screen (or the next step cuts it off mid-stride)
      timer.current = setTimeout(next, e.kind === 'move' ? Math.max(ms, 250 + 190 * (e.path?.length ?? 1)) : ms); // a little slack for slow devices
    };
    timer.current = setTimeout(next, 700);
    return () => clearTimeout(timer.current);
  }, [play?.id, play?.from]); // eslint-disable-line react-hooks/exhaustive-deps
  return st;
}
