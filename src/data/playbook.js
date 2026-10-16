// The playbook: ready-made formations that drop in adapted to the ball's spot and your roster (you can still move
// anyone before confirming), plus your own saved formations and 5-card play calls (per team, on this device).
// Offense spots are [columns from the hiker, rows behind the line (0 = on the line)].
// Defense sets are built against the offense actually on the field, so the line coverage rules always hold.
import { COLS, inBounds, key, losRows } from '../engine/board.js';
import { adjacent, checkDefense, checkOffense } from '../engine/rules.js';

// roles: C hikes (low rating), Q takes the snap (best passer), W wide / receivers (fast), L line, B backs
export const OFFENSE_SETS = [
  { id: 'iform', name: 'I-Form', spots: [['C', 0, 0], ['L', -1, 0], ['L', 1, 0], ['W', -5, 0], ['W', 5, 0], ['Q', 0, 1], ['B', 0, 2], ['B', 0, 3]] },
  { id: 'spread', name: 'Spread', spots: [['C', 0, 0], ['L', -2, 0], ['L', 2, 0], ['W', -6, 0], ['W', 6, 0], ['W', -4, 1], ['Q', 0, 1], ['W', 4, 1]] },
  { id: 'shotgun', name: 'Shotgun', spots: [['C', 0, 0], ['L', -1, 0], ['L', 1, 0], ['W', -5, 0], ['W', 5, 0], ['Q', 0, 3], ['B', 1, 3], ['B', -1, 3]] },
  { id: 'goalline', name: 'Goal Line', spots: [['C', 0, 0], ['L', -1, 0], ['L', 1, 0], ['L', -2, 0], ['L', 2, 0], ['Q', 0, 1], ['B', 0, 2], ['B', 1, 2]] },
  { id: 'trips', name: 'Trips Right', spots: [['C', 0, 0], ['L', -1, 0], ['L', 1, 0], ['W', 4, 0], ['W', 6, 0], ['W', 5, 1], ['Q', 0, 1], ['B', 0, 2]] },
];
// defense: how many line men cover the offensive line (nearest the hiker first), then the rest at [column from the
// ball, rows off the line]
export const DEFENSE_SETS = [
  { id: '43', name: '4-3', line: 4, rest: [[-3, 2], [0, 2], [3, 2], [0, 5]] },
  { id: 'nickel', name: 'Nickel', line: 3, rest: [[-2, 2], [2, 2], [-5, 4], [5, 4], [0, 6]] },
  { id: 'blitz', name: 'Blitz', line: 5, rest: [[-1, 1], [1, 1], [0, 4]] },
  { id: 'prevent', name: 'Prevent', line: 3, rest: [[-5, 5], [-2, 6], [2, 6], [5, 5], [0, 8]] },
  { id: 'man', name: 'Man', line: 7, rest: [[0, 3], [-3, 4], [3, 4]] },
];

const clampCol = (c) => Math.max(0, Math.min(COLS - 1, c));

// fill a list of squares without collisions: nudge sideways when a square is taken or off the board
function place(wanted, used) {
  for (const d of [0, 1, -1, 2, -2, 3, -3]) {
    const q = [clampCol(wanted[0] + d), wanted[1]];
    if (inBounds(...q) && !used.has(key(...q))) { used.add(key(...q)); return q; }
  }
  return null;
}

// how good a passer is on paper: his rating plus the passing abilities
const PASSING = ['POCKET PASSER', 'ROUTE PASSER', 'SCREEN PASSER', 'QB READ'];
const passer = (p) => p.skill + 1.5 * (p.abilities ?? []).filter((a) => PASSING.includes(a)).length;

// chart = the team's depth chart for this side ({ [num]: role }): players go to the role they're charted at first
export function buildOffense(set, roster, { line, dir, col }, chart = {}) {
  const { off, back } = losRows(line, dir);
  const bySkill = [...roster].sort((a, b) => a.skill - b.skill);
  const pool = [...bySkill];
  const free = (x) => !chart[x.num]; // nobody charted him: the auto picks may use him
  const take = (role, pick) => {
    let i = pool.findIndex((x) => chart[x.num] === role);
    if (i < 0) i = pick(pool.map((x, k) => [x, k]).filter(([x]) => free(x)));
    if (i < 0) i = pick(pool.map((x, k) => [x, k]));
    return i >= 0 ? pool.splice(i, 1)[0] : pool.shift();
  };
  const lowest = (list) => list[0]?.[1] ?? -1, highest = (list) => list.at(-1)?.[1] ?? -1;
  const roles = set.spots.slice(0, roster.length);
  // the hiker first (a solid 3/4), the passer next (the best passer), receivers (fast), then line and backs
  const order = ['C', 'Q', 'W', 'B', 'L'];
  const assigned = new Map();
  for (const role of order) for (const [i, slot] of roles.entries()) {
    if (slot[0] !== role) continue;
    const p = role === 'C' ? take('C', (list) => list.find(([x]) => x.skill <= 4)?.[1] ?? -1)
      : role === 'Q' ? take('Q', (list) => list.reduce((b, e) => (!b || passer(e[0]) > passer(b[0]) ? e : b), null)?.[1] ?? -1)
        : role === 'W' ? take('W', highest)
          : take(role, lowest);
    assigned.set(i, p);
  }
  const used = new Set();
  const out = [];
  roles.forEach((slot, i) => {
    const p = assigned.get(i);
    if (!p) return;
    // near the end line a deep set squeezes up to fit on the board
    const room = back > 0 ? 23 - off : off;
    const q = place([col + slot[1], off + back * Math.min(slot[2], room)], used);
    if (q) out.push({ num: p.num, col: q[0], row: q[1] });
  });
  return out;
}

export function buildDefense(set, roster, offense, { line, dir, col }, chart = {}) {
  const { off, def } = losRows(line, dir);
  const deeper = dir; // away from the ball, for the defense
  const offLos = offense.filter((p) => p.row === off).sort((a, b) => Math.abs(a.col - col) - Math.abs(b.col - col));
  const bySkill = [...roster].sort((a, b) => a.skill - b.skill); // low ratings up front, the fast ones deep
  const used = new Set(offense.map((p) => key(p.col, p.row)));
  const spots = [];
  const n = Math.min(Math.max(3, set.line), offLos.length, roster.length);
  for (const o of offLos.slice(0, n)) {
    const q = [o.col, def];
    if (!used.has(key(...q))) { used.add(key(...q)); spots.push(q); continue; }
    const alt = [[o.col - 1, def], [o.col + 1, def]].find((x) => inBounds(...x) && !used.has(key(...x)) && adjacent(x, [o.col, o.row]));
    if (alt) { used.add(key(...alt)); spots.push(alt); }
  }
  for (const [dc, d] of set.rest) {
    if (spots.length >= roster.length) break;
    const row = def + deeper * Math.max(1, d);
    const q = place([col + dc, Math.max(0, Math.min(23, row))], used);
    if (q) spots.push(q);
  }
  // anyone left over goes a row back from the line
  while (spots.length < roster.length) { const q = place([col + spots.length - 3, def + deeper * 2], used); if (!q) break; spots.push(q); }
  // the depth chart: charted line men take the line spots (they come first), charted backs the deep ones (last)
  const rank = (p) => (chart[p.num] === 'L' ? 0 : chart[p.num] === 'B' ? 2 : 1);
  const order = [...bySkill].sort((a, b) => rank(a) - rank(b) || a.skill - b.skill);
  return order.map((p, i) => (spots[i] ? { num: p.num, col: spots[i][0], row: spots[i][1] } : null)).filter(Boolean);
}

// ---------- the depth chart: who plays where, per team on this device ----------
// offense roles: C center (hikes), Q quarterback (takes the snap), W receiver, L line, B back. defense: L line, B back
const DKEY = 'tb-depth';
const readD = () => { try { return JSON.parse(localStorage.getItem(DKEY) || '{}'); } catch { return {}; } };
export const depthFor = (teamId) => ({ offense: {}, defense: {}, ...readD()[teamId] });
export function saveDepth(teamId, depth) { try { const all = readD(); all[teamId] = depth; localStorage.setItem(DKEY, JSON.stringify(all)); } catch { /* not saved */ } }
export const hasDepth = (teamId, role) => Object.keys(depthFor(teamId)[role] ?? {}).length > 0;
// the set you used last, per team and side (the depth chart lines up in it at the next down)
const SKEY = 'tb-lastset';
export const lastSetFor = (teamId, role) => { try { return JSON.parse(localStorage.getItem(SKEY) || '{}')[`${teamId}:${role}`] ?? null; } catch { return null; } };
export function rememberSet(teamId, role, id) { try { const all = JSON.parse(localStorage.getItem(SKEY) || '{}'); all[`${teamId}:${role}`] = id; localStorage.setItem(SKEY, JSON.stringify(all)); } catch { /* not saved */ } }

// ---------- your own: saved per team on this device ----------
const KEY = 'tb-playbook';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const write = (all) => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* not saved */ } };
export const savedFor = (teamId) => ({ offense: [], defense: [], plays: [], ...read()[teamId] });

// a formation saved relative to the spot and the line, so it works anywhere on the field
export function saveFormation(teamId, role, name, spots, { line, dir, col }) {
  const { off, def, back } = losRows(line, dir);
  const base = role === 'offense' ? off : def;
  const step = role === 'offense' ? back : -back;
  const rel = spots.map((p) => ({ num: p.num, dc: p.col - col, d: (p.row - base) * step }));
  const all = read();
  const t = (all[teamId] ??= {});
  t[role] = [...(t[role] ?? []).filter((x) => x.name !== name), { name, spots: rel }];
  write(all);
}
export function applySaved(saved, role, { line, dir, col }) {
  const { off, def, back } = losRows(line, dir);
  const base = role === 'offense' ? off : def;
  const step = role === 'offense' ? back : -back;
  const used = new Set();
  return saved.spots.map((p) => { const q = place([col + p.dc, base + step * p.d], used); return q ? { num: p.num, col: q[0], row: q[1] } : null; }).filter(Boolean);
}
// "same as last down": the formation (relative to the ball) and play call each team used last, on this device
const LAST = 'tb-last';
const readLast = () => { try { return JSON.parse(localStorage.getItem(LAST) || '{}'); } catch { return {}; } };
export function rememberLast(teamId, role, spots, { line, dir, col }) {
  const { off, def, back } = losRows(line, dir);
  const base = role === 'offense' ? off : def;
  const step = role === 'offense' ? back : -back;
  const all = readLast();
  (all[teamId] ??= {})[role] = { spots: spots.map((p) => ({ num: p.num, dc: p.col - col, d: (p.row - base) * step })) };
  try { localStorage.setItem(LAST, JSON.stringify(all)); } catch { /* not kept */ }
}
export function rememberCall(teamId, call) {
  const all = readLast();
  (all[teamId] ??= {}).call = call;
  try { localStorage.setItem(LAST, JSON.stringify(all)); } catch { /* not kept */ }
}
export const lastFor = (teamId, key) => readLast()[teamId]?.[key] ?? null;

export function deleteSaved(teamId, role, name) {
  const all = read();
  if (all[teamId]?.[role]) all[teamId][role] = all[teamId][role].filter((x) => x.name !== name);
  write(all);
}
export function savePlay(teamId, name, call) {
  const all = read();
  const t = (all[teamId] ??= {});
  t.plays = [...(t.plays ?? []).filter((x) => x.name !== name), { name, call }];
  write(all);
}

// is a built-in set legal right here? (a set can fail near the sidelines / goal line; the editor then shows why)
export function check(role, spots, req) {
  const ctx = { line: req.line, dir: req.dir, col: req.col, count: req.roster.length };
  return role === 'offense' ? checkOffense(spots, ctx) : checkDefense(spots, req.offense, ctx);
}
