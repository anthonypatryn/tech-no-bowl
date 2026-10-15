// The computer coach: Rookie, Starter, All-Pro.
// One coach that scores every legal choice (utility) and picks the best; the level decides how well it sees the
// field: Rookie is noisy and short-sighted, Starter reads the odds (dice + teamwork) and uses read-and-react,
// All-Pro also manages its cards and bench boosts, the clock, zone coverage, and picks the best of several formations.
// All randomness goes through game.random, so a seed replays a game exactly.
import { adjacent, distance, halfOf, inOppEndZone, losRows } from './board.js';
import { ballSquare, carrier, contactMods, netModifier, sqOf, threatCount } from './rules.js';
import { autoDefense, autoOffense } from './formations.js';

export const LEVELS = [['rookie', 'Rookie'], ['starter', 'Starter'], ['allpro', 'All-Pro']];

const TRAITS = {
  rookie: { noise: 2.2, slip: 0.15, odds: false, readReact: 0, smartCalls: false, smartFirst: false, boost: 'never', zone: false, clock: false, formations: 1 },
  starter: { noise: 0.8, slip: 0.04, odds: true, readReact: 0.6, smartCalls: true, smartFirst: true, boost: 'big', zone: false, clock: false, formations: 3 },
  allpro: { noise: 0.25, slip: 0, odds: true, readReact: 1, smartCalls: true, smartFirst: true, boost: 'smart', zone: true, clock: true, formations: 8 },
};

// P(2d6 + net >= target)
const P2D6 = (() => { const c = Array(13).fill(0); for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) c[a + b]++; return c.map((n) => n / 36); })();
export function pAtLeast(target, net) { let p = 0; for (let t = 2; t <= 12; t++) if (t + net >= target) p += P2D6[t]; return p; }

export function makeAI(level = 'starter') {
  const T = TRAITS[level] ?? TRAITS.starter;
  return (game, side, req) => decide(game, side, req, T);
}

function decide(game, side, req, T) {
  const s = game.state;
  const r = () => game.random();
  const any = (a) => a[Math.floor(r() * a.length)];
  switch (req.type) {
    case 'toss': return 'offense';
    case 'formation': return formation(game, side, req, T);
    case 'call': return callPlay(game, side, req, T);
    case 'motion': return null;
    case 'timeout': {
      const diff = s.score[side] - s.score[1 - side];
      return T.clock ? diff <= 0 || (side === s.offense && diff <= 7) : Math.abs(diff) <= 8;
    }
    case 'pick': return pickCard(game, side, req, T);
    case 'readReact': return readReact(game, side, req, T);
    case 'first': return whoFirst(game, side, req, T);
    case 'bonus': return bestPlayer(game, side, req.options, req.kind);
    case 'adjustPartner': return { pid: bestPlayer(game, side, req.options, 'half') ?? req.options[0], first: 'self' };
    case 'boost': return boost(game, side, req, T);
    case 'reverse': return true;
    case 'push': return pushPick(game, side, req);
    case 'followUp': return followUp(game, side, req);
    case 'scatter': return scatterPick(game, side, req);
    case 'act': return act(game, side, req, T);
    default: return any([null]);
  }
}

// ---------- reading the field ----------
// bigger = closer to scoring
const progress = (game, side, sq) => game.dir(side) * sq[1];
const opps = (game, side) => game.roster(1 - side).filter((p) => !p.down && p.col != null);
const mates = (game, side) => game.roster(side).filter((p) => !p.down && p.col != null);
const nearestOpp = (game, side, sq) => Math.min(99, ...opps(game, side).map((o) => distance(sqOf(o), sq)));
// how far from the end zone, in squares
const toGo = (game, side, sq) => (game.dir(side) < 0 ? sq[1] - 1 : 22 - sq[1]);

// ---------- setup ----------
function formation(game, side, req, T) {
  const ctx = { line: req.line, dir: req.dir, col: req.col };
  const make = () => (req.role === 'offense' ? autoOffense(req.roster, ctx, game.random) : autoDefense(req.roster, req.offense, ctx, game.random));
  let best = make(), score = -Infinity;
  for (let i = 0; i < T.formations; i++) {
    const f = i ? make() : best;
    if (!f) continue;
    const v = req.role === 'offense' ? rateOffense(f, ctx) : rateDefense(f, req, ctx, T);
    if (v > score) { score = v; best = f; }
  }
  return best;
}
function rateOffense(f, { col }) {
  // receivers spread wide, a back behind the passer
  const wide = f.filter((p) => Math.abs(p.col - col) >= 4).length;
  return Math.min(wide, 3) + (f.some((p) => p.col === col) ? 0.5 : 0);
}
function rateDefense(f, req, ctx, T) {
  const { def } = losRows(ctx.line, ctx.dir);
  const deep = f.filter((p) => Math.abs(p.row - def) >= 3).length;
  const line = f.filter((p) => p.row === def).length;
  return (T.zone ? Math.min(deep, 2) * 1.5 : 0) + Math.min(line, 4) * 0.6;
}

function callPlay(game, side, req, T) {
  const s = game.state;
  if (!T.smartCalls) return game.shuffle(req.bench).slice(0, req.count);
  const offense = side === s.offense;
  const { off, back } = losRows(s.line, game.dir(s.offense));
  const qbSq = [s.spot, off + back];
  const value = (num) => {
    const p = s.players[`${side}:${num}`];
    if (!p) return 0;
    const d = distance(sqOf(p), qbSq);
    if (offense) return (d <= 1 ? 4 : 0) + p.skill * 0.4 + (Math.abs(p.col - s.spot) >= 4 ? 1.2 : 0) + game.random() * 0.8;
    return Math.max(0, 6 - d) + p.skill * 0.3 + game.random() * 0.8;
  };
  // best five distinct players first (a second card for the star only if needed), most urgent first
  const uniq = [...new Set(req.bench)].sort((a, b) => value(b) - value(a));
  const pick = uniq.slice(0, req.count);
  for (const n of req.bench) if (pick.length < req.count && pick.filter((x) => x === n).length < req.bench.filter((x) => x === n).length && !pick.includes(n)) pick.push(n);
  while (pick.length < req.count) pick.push(req.bench.find((n) => pick.filter((x) => x === n).length < req.bench.filter((x) => x === n).length));
  // All-Pro keeps the passer's second card on the bench (a bench boost for the big throw) when it can
  return pick;
}

function pickCard(game, side, req, T) {
  if (!T.smartCalls) return req.bench[Math.floor(game.random() * req.bench.length)];
  let best = req.bench[0], bv = -Infinity;
  for (const n of req.bench) { const v = urgency(game, side, game.state.players[`${side}:${n}`]); if (v > bv) { bv = v; best = n; } }
  return best;
}

// how much this player could do right now
function urgency(game, side, p) {
  if (!p || p.col == null) return -9;
  const s = game.state;
  const c = carrier(s);
  const ball = ballSquare(s);
  if (!ball) return p.skill * 0.1;
  const d = distance(sqOf(p), ball);
  let v = -d + p.skill * 0.3 - (p.down ? 2 : 0);
  if (c && c.pid === p.pid) v += 6;
  if (c && c.side !== side && d <= halfOf(p.skill) + 1) v += 4; // can reach the carrier and still tackle
  return v;
}

function readReact(game, side, req, T) {
  if (game.random() >= T.readReact) return null;
  const s = game.state;
  const mine = urgency(game, side, s.players[`${side}:${req.card}`]);
  let best = null, bv = mine + 2.5; // only swap for a clearly better player
  for (const n of new Set(req.bench)) { const v = urgency(game, side, s.players[`${side}:${n}`]); if (v > bv) { bv = v; best = n; } }
  return best;
}

function whoFirst(game, side, req, T) {
  if (!T.smartFirst) return game.random() < 0.7 ? 'me' : 'them';
  const s = game.state;
  const me = urgency(game, side, s.players[`${side}:${req.cards[side]}`]);
  const them = urgency(game, 1 - side, s.players[`${1 - side}:${req.cards[1 - side]}`]);
  // act first when it matters (a tackle to make, a lane to hit); otherwise make them commit first
  return me >= 2 || me > them + 1 ? 'me' : 'them';
}

function bestPlayer(game, side, options, kind) {
  let best = null, bv = -Infinity;
  for (const pid of options) {
    const p = game.state.players[pid];
    const v = urgency(game, side, p) - (kind === 'half' && p.down ? 4 : 0);
    if (v > bv) { bv = v; best = pid; }
  }
  return best;
}

function boost(game, side, req, T) {
  if (T.boost === 'never') return 0;
  const s = game.state;
  const bench = s.cards[side].bench.length;
  const net = netModifier(req.bonus, req.penalty);
  const big = /tackles|throws/.test(req.label);
  if (T.boost === 'big') return big && net <= 0 && bench > 4 ? 1 : 0;
  // smart: buy the odds up to a sure-ish success on the plays that decide downs, but keep enough cards to keep moving
  if (!big && net >= 0) return 0;
  const want = Math.max(0, Math.min(req.max, 1 - net + (big ? 1 : 0)));
  return Math.min(want, Math.max(0, bench - 4));
}

function pushPick(game, side, req) {
  const c = carrier(game.state);
  if (!c) return req.options[0];
  const mineBall = c.side === side;
  // push defenders away from our carrier, push their blockers / carrier away from our defenders' help
  return req.options.reduce((a, b) => {
    const da = distance(a, sqOf(c)), db = distance(b, sqOf(c));
    return mineBall ? (db > da ? b : a) : (db < da ? a : b);
  });
}

function followUp(game, side, req) {
  const c = carrier(game.state);
  if (!c) return false;
  return c.side === side ? true : distance(req.to, sqOf(c)) <= 2;
}

function scatterPick(game, side, req) {
  const s = game.state;
  let best = req.options[0], bv = -Infinity;
  for (const o of req.options) {
    if (o.out) { const v = side === s.offense ? -3 : 2; if (v > bv) { bv = v; best = o; } continue; }
    const mine = Math.min(99, ...mates(game, side).map((p) => distance(sqOf(p), o.to)));
    const theirs = Math.min(99, ...opps(game, side).map((p) => distance(sqOf(p), o.to)));
    const v = theirs - mine;
    if (v > bv) { bv = v; best = o; }
  }
  return best;
}

// ---------- activations: score every legal choice ----------
function act(game, side, req, T) {
  const s = game.state;
  const me = s.players[req.pid];
  if (req.canStand) return { kind: 'stand' };
  if (game.random() < T.slip) {
    const opts = [{ kind: 'end' }, ...req.moves.filter((m) => m.end !== 'out').map((m) => ({ kind: 'move', to: m.to }))];
    return opts[Math.floor(game.random() * opts.length)];
  }
  const c = carrier(s);
  const ball = ballSquare(s);
  const here = sqOf(me);
  const canStillAct = (cost) => (req.mode === 'card' || req.mode === 'full') && req.spent + cost <= halfOf(me.skill);
  const pSucc = (net) => (T.odds ? pAtLeast(7, net) : 0.6);
  const noise = () => (game.random() - 0.5) * T.noise;
  const cands = [{ a: { kind: 'end' }, v: endValue(game, side, me, c, T) }];

  for (const pid of req.tackles) {
    const t = s.players[pid];
    const m = contactMods(s, me, t);
    const p = pSucc(netModifier(m.bonus, m.penalty));
    const urgencyGain = 12 + Math.max(0, 8 - toGo(game, t.side, sqOf(t)));
    cands.push({ a: { kind: 'tackle', pid }, v: p * urgencyGain - (1 - p) * 3 });
  }
  for (const pid of req.blocks) {
    if (req.tackles.includes(pid)) continue;
    const t = s.players[pid];
    const m = contactMods(s, me, t);
    const p = pSucc(netModifier(m.bonus, m.penalty));
    let gain = 1;
    if (c && c.side === side && adjacent(sqOf(t), sqOf(c))) gain = 5; // clear a tackler off our carrier
    else if (c && c.side === side && distance(sqOf(t), sqOf(c)) <= 3) gain = 2.5;
    else if (c && c.side !== side && distance(sqOf(t), sqOf(c)) <= 2) gain = 2; // shove a lead blocker
    if (c?.pid === me.pid) gain = 2.5; // trucking
    cands.push({ a: { kind: 'block', pid }, v: p * gain - (1 - p) * 3 });
  }
  if (req.passes.length && c?.pid === me.pid) {
    for (const ps of req.passes) {
      const net = Math.min(3, ps.bonus) - ps.penalty;
      const p = pSucc(net);
      const gainSq = progress(game, side, ps.to) - progress(game, side, here);
      if (gainSq <= 1) continue;
      const tdBonus = ps.target && inOppEndZone(game.dir(side), ps.to[1]) ? 25 : 0;
      let space;
      if (ps.target) {
        // an open receiver keeps going after the catch
        const open = nearestOpp(game, side, ps.to);
        space = Math.min(3, open - 1) + (open >= 3 ? game.state.players[ps.target].skill * 0.6 : 0);
      }
      else {
        // open grass: only worth it if one of ours gets there clearly before any of theirs (it still needs a catch)
        const ours = Math.min(99, ...mates(game, side).filter((m) => m.pid !== me.pid).map((m) => distance(sqOf(m), ps.to) / m.skill));
        const theirs = Math.min(99, ...opps(game, side).map((o) => distance(sqOf(o), ps.to) / o.skill));
        if (ours >= theirs * 0.7 || ours > 1) continue;
        space = -2;
      }
      const v = p * (gainSq * 1.1 + tdBonus + space) * (ps.target ? 1 : 5 / 6) - (1 - p) * 6;
      cands.push({ a: { kind: 'pass', to: ps.to }, v });
    }
  }
  for (const pid of req.handoffs) {
    const m = s.players[pid];
    if (c?.pid === me.pid) {
      const v = (progress(game, side, sqOf(m)) - progress(game, side, here)) * 0.8 - threatCount(s, sqOf(m), 1 - side) * 1.5 - (threatCount(s, here, 1 - side) ? 0.8 : 0);
      cands.push({ a: { kind: 'handoff', pid }, v });
    }
  }
  for (const mv of req.moves) {
    const v = moveValue(game, side, me, mv, c, ball, canStillAct(mv.cost), T);
    if (v != null) cands.push({ a: { kind: 'move', to: mv.to }, v });
  }
  if (req.canAdjust && T.zone && c && c.side !== side && c.row != null) cands.push({ a: { kind: 'adjust' }, v: 1.2 });
  let best = cands[0], bv = -Infinity;
  for (const x of cands) { const v = x.v + noise(); if (v > bv) { bv = v; best = x; } }
  return best.a;
}

function endValue(game, side, me, c, T) {
  // "stay home": a defender already between the carrier and the end zone, or a blocker in front of the carrier
  if (!c) return 0;
  if (c.side !== side && T.zone && progress(game, c.side, sqOf(me)) > progress(game, c.side, sqOf(c)) && distance(sqOf(me), sqOf(c)) <= 4) return 0.6;
  return 0;
}

function moveValue(game, side, me, mv, c, ball, canAct, T) {
  const s = game.state;
  const here = sqOf(me);
  if (mv.end === 'out') return -8;
  if (mv.end === 'td') return 100;
  if (mv.end === 'ball') return 9 + (c ? 0 : 3);
  // loose ball: race to it
  if (!c && ball) return (distance(here, ball) - distance(mv.to, ball)) * 1.2 - mv.cost * 0.05;
  if (!c) return null;
  if (c.pid === me.pid) {
    // the carrier: gain ground, stay away from tacklers, keep enough movement to matter
    const gain = progress(game, side, mv.to) - progress(game, side, here);
    const thin = s.cards[side].bench.length <= 3 && (game.dir(side) < 0 ? mv.to[1] >= s.line : mv.to[1] <= s.line - 1) ? 1.8 : 1; // a sack waiting to happen
    const danger = (threatCount(s, mv.to, 1 - side) * 2.2 + Math.max(0, 3 - nearestOpp(game, side, mv.to)) * 0.7) * thin;
    return gain * 1.3 - danger - mv.cost * 0.04 + (toGo(game, side, mv.to) <= 2 ? 2 : 0);
  }
  if (c.side === side) {
    // a teammate of the carrier: get between him and the nearest tackler, or get open downfield
    const threats = opps(game, side).filter((o) => distance(sqOf(o), sqOf(c)) <= 3);
    const screen = threats.some((o) => distance(mv.to, sqOf(o)) === 1 && distance(mv.to, sqOf(c)) <= 2) ? 2.5 : 0;
    const ahead = progress(game, side, mv.to) - progress(game, side, sqOf(c));
    const open = ahead >= 2 && nearestOpp(game, side, mv.to) >= 2 ? 1.5 + Math.min(ahead, 8) * 0.25 : 0;
    const wasScreen = threats.some((o) => adjacent(here, sqOf(o)) && distance(here, sqOf(c)) <= 2) ? 2.5 : 0;
    return screen + open - wasScreen - mv.cost * 0.05;
  }
  // defense: chase the carrier; next to him with an action left is the best place on the field
  const cs = sqOf(c);
  const d0 = distance(here, cs), d1 = distance(mv.to, cs);
  if (d1 === 1) {
    const help = threatCount(s, cs, side, [me.pid]);
    const pressure = (game.dir(c.side) < 0 ? c.row >= (s.play?.line ?? s.line) : c.row <= (s.play?.line ?? s.line) - 1) && !adjacent(here, cs) ? 2 : 0;
    return (canAct ? 7 : 3) + help * 0.6 + pressure;
  }
  let v = (d0 - d1) * 0.9 - mv.cost * 0.03;
  // zone: deep defenders keep between the receivers and the end zone instead of all piling in
  if (T.zone && d1 > 4) {
    const deepest = game.roster(c.side).filter((p) => !p.down && p.pid !== c.pid).sort((a, b) => progress(game, c.side, sqOf(b)) - progress(game, c.side, sqOf(a)))[0];
    if (deepest) v += (distance(here, sqOf(deepest)) - distance(mv.to, sqOf(deepest))) * 0.4 + (progress(game, c.side, mv.to) > progress(game, c.side, sqOf(deepest)) ? 0.6 : 0);
  }
  return v;
}

