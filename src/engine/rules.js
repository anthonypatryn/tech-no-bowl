// Pure rules: everything here reads a state and answers a question, nothing changes it.
// state.players: { [pid]: { pid, side, num, skill, col, row, down } }   (down = knocked down)
// state.ball:    { at: 'held', pid } | { at: 'ground' | 'air', col, row } | { at: 'dead' }
import { COLS, DIRS, adjacent, distance, halfOf, inBounds, inOppEndZone, isForward, key, losRows, neighbours, same, skillOf, stepExtra } from './board.js';

export const sqOf = (p) => [p.col, p.row];
export const playerList = (s) => Object.values(s.players);
export function occupant(s, c, r) {
  for (const p of playerList(s)) if (p.col === c && p.row === r) return p;
  return null;
}
export const occupiedMap = (s, except) => {
  const m = new Map();
  for (const p of playerList(s)) if (p.pid !== except) m.set(key(p.col, p.row), p);
  return m;
};
export const carrier = (s) => (s.ball.at === 'held' ? s.players[s.ball.pid] : null);
export const ballSquare = (s) => (s.ball.at === 'held' ? sqOf(s.players[s.ball.pid]) : s.ball.at === 'dead' ? null : [s.ball.col, s.ball.row]);
export const looseAt = (s, c, r) => (s.ball.at === 'ground' || s.ball.at === 'air') && s.ball.col === c && s.ball.row === r;

// standing players of `side` whose threat zone covers the square (knocked-down players threaten nothing)
export function threateners(s, sq, side, except = []) {
  return playerList(s).filter((p) => p.side === side && !p.down && !except.includes(p.pid) && adjacent(sqOf(p), sq));
}
export const threatCount = (s, sq, side, except) => threateners(s, sq, side, except).length;

// ---------- skill checks ----------
// Rule of 3: bonuses stop at +3, penalties stop at -3, then net them
export function netModifier(bonuses, penalties) {
  return Math.min(3, bonuses) - Math.min(3, penalties);
}
export function checkResult(d1, d2, net) {
  const total = d1 + d2 + net;
  const result = total >= 10 ? 'total' : total >= 7 ? 'partial' : 'fail';
  return { dice: [d1, d2], net, total, result, success: result !== 'fail', crit: d1 === d2 };
}
// a comparison of skill ratings for block / tackle: lower-rated actor gets the difference as a bonus, max 3
export function strengthMods(actorSkill, targetSkill) {
  const d = targetSkill - actorSkill;
  return d > 0 ? { bonus: Math.min(3, d), penalty: 0 } : { bonus: 0, penalty: Math.min(3, -d) };
}
// teamwork: +1 per actor's teammate threatening the target, -1 per target's teammate threatening the actor
export function teamwork(s, actor, target) {
  const help = threatCount(s, sqOf(target), actor.side, [actor.pid, target.pid]);
  const hurt = threatCount(s, sqOf(actor), target.side, [actor.pid, target.pid]);
  return { bonus: help, penalty: hurt };
}
// everything about a block or tackle check except bench boosts
export function contactMods(s, actor, target) {
  const st = strengthMods(actor.skill, target.skill);
  const tw = teamwork(s, actor, target);
  return { bonus: st.bonus + tw.bonus, penalty: st.penalty + tw.penalty, parts: { skill: st.bonus - st.penalty, teamwork: tw.bonus - tw.penalty } };
}

// ---------- movement ----------
// cost of LEAVING a square: 1 free, 2 per threatening opponent, 3 per threatening opponent with the ball
export function leaveCost(s, sq, mover, carrying) {
  const t = threatCount(s, sq, 1 - mover.side, [mover.pid]);
  return t === 0 ? 1 : t * (carrying ? 3 : 2);
}

// Every square the mover can reach with `budget` movement this step.
// Returns Map key -> { to, cost, parity, path:[squares after start], end: null|'ball'|'td'|'out' }.
// - can't move through players; can't cut a diagonal with players on both sides
// - a loose ball's square, a touchdown square and stepping out of bounds end the move there
// - opts.stopRows: rows that end the move when entered (pre-snap motion onto the line of scrimmage)
// - opts.allowOut: a ball carrier may step out of bounds (ends the play)
export function moveReach(s, mover, budget, parity = 0, opts = {}) {
  const carrying = s.ball.at === 'held' && s.ball.pid === mover.pid;
  const occ = occupiedMap(s, mover.pid);
  const dir = s.teams?.[mover.side]?.dir;
  const start = sqOf(mover);
  const best = new Map(); // `${key}|${parity}` -> node
  const startNode = { to: start, cost: 0, parity, prev: null, end: null };
  best.set(`${key(...start)}|${parity}`, startNode);
  const open = [startNode];
  while (open.length) {
    open.sort((a, b) => a.cost - b.cost);
    const n = open.shift();
    if (n.end) continue;
    const here = n.to;
    const leave = leaveCost(s, here, mover, carrying);
    for (const [dc, dr] of DIRS) {
      const to = [here[0] + dc, here[1] + dr];
      const cost = n.cost + leave + stepExtra(dc, dr, n.parity);
      if (cost > budget) continue;
      const np = dc && dr ? 1 - n.parity : n.parity;
      let end = null;
      if (!inBounds(...to)) {
        if (!(opts.allowOut && carrying)) continue;
        end = 'out';
      } else {
        if (occ.has(key(...to))) continue;
        if (dc && dr && occ.has(key(here[0] + dc, here[1])) && occ.has(key(here[0], here[1] + dr))) continue; // squeeze
        if (looseAt(s, ...to)) end = 'ball';
        else if (carrying && dir != null && inOppEndZone(dir, to[1])) end = 'td';
        else if (opts.stopRows?.includes(to[1])) end = 'stop';
      }
      const k = `${key(...to)}|${np}`;
      const old = best.get(k);
      if (old && old.cost <= cost) continue;
      const node = { to, cost, parity: np, prev: n, end };
      best.set(k, node);
      open.push(node);
    }
  }
  // collapse parities: cheapest per square (prefer even parity on ties: the next diagonal is then free)
  const out = new Map();
  for (const node of best.values()) {
    if (node === startNode) continue;
    const k = key(...node.to);
    const o = out.get(k);
    if (!o || node.cost < o.cost || (node.cost === o.cost && node.parity < o.parity)) out.set(k, node);
  }
  const res = new Map();
  for (const [k, node] of out) {
    const path = [];
    for (let x = node; x.prev; x = x.prev) path.unshift(x.to);
    res.set(k, { to: node.to, cost: node.cost, parity: node.parity, path, end: node.end === 'stop' ? null : node.end });
  }
  return res;
}

// ---------- blocks ----------
// where a blocked player can be pushed: straight back from the blocker, or either square beside that one
export function pushSquares(from, target) {
  const dc = Math.sign(target[0] - from[0]), dr = Math.sign(target[1] - from[1]);
  const back = [target[0] + dc, target[1] + dr];
  if (dc && dr) return [back, [target[0] + dc, target[1]], [target[0], target[1] + dr]];
  if (dc) return [back, [back[0], back[1] - 1], [back[0], back[1] + 1]];
  return [back, [back[0] - 1, back[1]], [back[0] + 1, back[1]]];
}
// legal push squares: open and in bounds. Empty = knocked down where he stands instead.
export function pushOptions(s, from, target) {
  const occ = occupiedMap(s);
  return pushSquares(from, target).filter((q) => inBounds(...q) && !occ.has(key(...q)));
}

// ---------- the ball ----------
// Ways a scatter of `n` can go from `origin` (counted with the diagonal rule). Must, if possible: move exactly n,
// never re-enter a square, not end where it started, only enter a player's square as its last square, and only
// leave the field if it's a pass. Returns [{ to, out }] (out = left the field; `to` = last square in bounds).
export function scatterOptions(s, origin, n, isPass) {
  const occ = occupiedMap(s);
  const exact = new Map(), short = new Map(), outs = new Map();
  const seen = new Set([key(...origin)]);
  const walk = (at, cost, parity) => {
    for (const [dc, dr] of DIRS) {
      const to = [at[0] + dc, at[1] + dr];
      const c = cost + 1 + stepExtra(dc, dr, parity);
      if (c > n) continue;
      const k = key(...to);
      if (seen.has(k)) continue;
      if (!inBounds(...to)) { if (isPass) outs.set(key(...at), { to: at, out: true }); continue; }
      const np = dc && dr ? 1 - parity : parity;
      if (occ.has(k)) { if (c === n) exact.set(k, { to, out: false }); else short.set(k, { to, out: false, cost: c, player: true }); continue; }
      if (c === n) { exact.set(k, { to, out: false }); continue; }
      short.set(k, { to, out: false, cost: c });
      seen.add(k); walk(to, c, np); seen.delete(k);
    }
  };
  walk(origin, 0, 0);
  if (exact.size || outs.size) return [...exact.values(), ...outs.values()];
  // boxed in: go as far as it can (open squares first, then onto a player)
  const shorts = [...short.values()];
  const open = shorts.filter((x) => !x.player);
  const pool = open.length ? open : shorts;
  const far = Math.max(...pool.map((x) => x.cost), -Infinity);
  const res = pool.filter((x) => x.cost === far).map(({ to }) => ({ to, out: false }));
  return res.length ? res : [{ to: origin, out: false }];
}

// a pass from `passer` to square `to`: range, modifiers and whether it's allowed right now
export function passInfo(s, passer, to) {
  const from = sqOf(passer);
  const dist = distance(from, to);
  const max = passer.skill * 2;
  const dir = s.teams[passer.side].dir;
  const target = occupant(s, ...to);
  const reasons = [];
  if (same(from, to)) reasons.push('own square');
  if (!inBounds(...to)) reasons.push('off the field');
  if (dist > max) reasons.push('out of range');
  if (target && (target.side !== passer.side || target.down)) reasons.push('not a standing teammate');
  if (s.play?.forwardDone && isForward(from, to, dir)) reasons.push('only lateral or backward passes now');
  const bonus = dist <= passer.skill ? 1 : 0;
  const penalty = threatCount(s, to, 1 - passer.side, target ? [target.pid] : []) + threatCount(s, from, 1 - passer.side);
  return { ok: !reasons.length, reasons, dist, max, target, bonus, penalty, forward: isForward(from, to, dir) };
}

// ---------- formations ----------
// rows a team may stand in for a formation: its LOS row and everything behind it, on the board
export function sideRows(losRow, back) {
  const rows = [];
  for (let r = losRow; r >= 0 && r < 24; r += back) rows.push(r);
  return rows;
}

// Offensive formation (rulebook p.9-10). spots: [{ num, col, row }]. Returns { ok, errors, hiker, receiver }.
export function checkOffense(spots, { line, dir, col, count }) {
  const { off, back } = losRows(line, dir);
  const errors = [];
  const at = new Map(spots.map((p) => [key(p.col, p.row), p]));
  if (spots.length !== count) errors.push(`needs ${count} players`);
  if (at.size !== spots.length) errors.push('two players on one square');
  const rows = sideRows(off, back);
  for (const p of spots) if (!inBounds(p.col, p.row) || !rows.includes(p.row)) errors.push(`#${p.num} is not on the offense's side`);
  const hiker = at.get(key(col, off));
  if (!hiker) errors.push('a player must hike the ball from the spot');
  const los = spots.filter((p) => p.row === off);
  if (los.length < 3) errors.push('at least 3 players on the line of scrimmage');
  if (!los.some((p) => p.col >= col - 2 && p.col <= col - 1) || !los.some((p) => p.col >= col + 1 && p.col <= col + 2)) {
    errors.push('one line player within 2 squares on each side of the hiker');
  }
  if (at.has(key(col - 1, off + back)) || at.has(key(col + 1, off + back))) errors.push('nobody in the two squares diagonally behind the hiker');
  // the hike goes straight back to the first player behind the hiker, up to the hiker's skill rating
  let receiver = null;
  if (hiker) {
    for (let i = 1; i <= skillOf(hiker.num); i++) {
      const p = at.get(key(col, off + back * i));
      if (p) { receiver = p; break; }
    }
    if (!receiver) errors.push(`someone must be straight behind the hiker, within ${skillOf(hiker.num)} squares`);
  }
  // backfield: deeper than the row right behind the line, plus the receiver: max 4, all in the 3 lanes round the hiker
  const deep = spots.filter((p) => (p.row - off) * back >= 2);
  const backfield = new Set([...deep, receiver].filter(Boolean));
  if (backfield.size > 4) errors.push('at most 4 players in the backfield');
  for (const p of deep) if (Math.abs(p.col - col) > 1) errors.push(`#${p.num}: backfield players stay in the three lanes behind the hiker`);
  return { ok: !errors.length, errors: [...new Set(errors)], hiker, receiver };
}

// largest 1:1 matching of defenders on the line to offensive line players they threaten
function matching(defs, offs) {
  const match = new Map(); // off key -> def
  const tryDef = (d, seen) => {
    for (const o of offs) {
      if (!adjacent([d.col, d.row], [o.col, o.row]) || seen.has(o)) continue;
      seen.add(o);
      const cur = match.get(o);
      if (!cur || tryDef(cur, seen)) { match.set(o, d); return true; }
    }
    return false;
  };
  let size = 0;
  for (const d of defs) if (tryDef(d, new Set())) size++;
  return { size, match };
}

// Defensive formation (rulebook p.10-11), checked against the offense already on the field.
export function checkDefense(spots, offense, { line, dir, col, count }) {
  const { off, def, back } = losRows(line, dir);
  const errors = [];
  const at = new Map(spots.map((p) => [key(p.col, p.row), p]));
  if (spots.length !== count) errors.push(`needs ${count} players`);
  if (at.size !== spots.length) errors.push('two players on one square');
  const rows = sideRows(def, -back);
  for (const p of spots) if (!inBounds(p.col, p.row) || !rows.includes(p.row)) errors.push(`#${p.num} is not on the defense's side`);
  const los = spots.filter((p) => p.row === def);
  if (los.length < 3) errors.push('at least 3 players on the line of scrimmage');
  const offLos = offense.filter((p) => p.row === off);
  const { size } = matching(los, offLos);
  if (los.length > size && size < offLos.length) errors.push('every offensive line player must be covered 1:1 before a line defender stands free');
  // the first three defenders: one on the hiker and two on line players within 2 squares of him
  const key3 = offLos.filter((p) => Math.abs(p.col - col) <= 2);
  const hikerP = offLos.find((p) => p.col === col);
  const m3 = matching(los, key3);
  const hikerCovered = hikerP && los.some((d) => adjacent([d.col, d.row], [hikerP.col, hikerP.row]));
  if (!hikerCovered || m3.size < Math.min(3, key3.length)) errors.push('cover the hiker and two line players within 2 squares of him');
  return { ok: !errors.length, errors: [...new Set(errors)] };
}

export const ALL_COLS = Array.from({ length: COLS }, (_, i) => i);
export { distance, halfOf, neighbours, adjacent };
