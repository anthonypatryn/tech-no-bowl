// A simple computer coach: legal, greedy and a bit sloppy. It is the placeholder for the Rookie level and the
// opponent the simulator uses to shake out rules bugs. (Batch 3 brings the real Rookie / Starter / All-Pro.)
// All randomness goes through game.random, so a seed replays a game exactly.
import { distance, same } from './board.js';
import { ballSquare, carrier, sqOf, threatCount } from './rules.js';
import { autoDefense, autoOffense } from './formations.js';

export function makeBot({ slip = 0.12 } = {}) {
  return (game, side, req) => decide(game, side, req, slip);
}

function decide(game, side, req, slip) {
  const s = game.state;
  const r = () => game.random();
  const any = (a) => a[Math.floor(r() * a.length)];
  switch (req.type) {
    case 'toss': return 'offense';
    case 'formation': return req.role === 'offense' ? autoOffense(req.roster, req, game.random) : autoDefense(req.roster, req.offense, req, game.random);
    case 'call': return game.shuffle(req.bench).slice(0, req.count);
    case 'motion': {
      // now and then send someone in motion (it costs bench cards, so not often)
      if (r() > 0.12 || !req.options.length) return null;
      const o = any(req.options);
      if (!o.reach.length) return null;
      return { pid: o.pid, to: any(o.reach), discard: game.shuffle(req.bench).slice(0, req.cost) };
    }
    case 'timeout': return Math.abs(s.score[0] - s.score[1]) <= 8;
    case 'pick': return any(req.bench);
    case 'readReact': return r() < 0.1 && side !== s.offense ? any(req.bench) : null;
    case 'first': return r() < 0.7 ? 'me' : 'them';
    case 'bonus': return bestPlayer(game, side, req.options);
    case 'adjustPartner': return { pid: any(req.options), first: 'self' };
    case 'boost': return req.bonus - req.penalty <= 0 ? Math.min(1, req.max) : 0;
    case 'reverse': return true;
    case 'push': return any(req.options);
    case 'followUp': return r() < 0.7;
    case 'scatter': return scatterPick(game, side, req);
    case 'act': return act(game, side, req, slip);
    default: return null;
  }
}

// the player best placed to do something useful: closest to the ball
function bestPlayer(game, side, options) {
  const s = game.state;
  const ball = ballSquare(s);
  if (!ball) return options[0] ?? null;
  let best = null, bd = Infinity;
  for (const pid of options) {
    const p = s.players[pid];
    const d = distance(sqOf(p), ball) + (p.down ? 3 : 0);
    if (d < bd) { bd = d; best = pid; }
  }
  return best;
}

function scatterPick(game, side, req) {
  const s = game.state;
  const mine = game.roster(side).filter((p) => !p.down);
  let best = req.options[0], bd = Infinity;
  for (const o of req.options) {
    if (o.out) { if (side !== s.offense && bd > 0.5) { best = o; bd = 0.5; } continue; } // the defense likes an incomplete
    const d = Math.min(...mine.map((p) => distance(sqOf(p), o.to)));
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}

// forward progress of a square for `side` (bigger = closer to scoring)
const progress = (game, side, sq) => game.dir(side) * sq[1];

function act(game, side, req, slip) {
  const s = game.state;
  const r = () => game.random();
  const me = s.players[req.pid];
  const c = carrier(s);
  const ball = ballSquare(s);
  const end = { kind: 'end' };
  if (req.canStand) return { kind: 'stand' };
  if (req.canAdjust && r() < 0.06) return { kind: 'adjust' };
  if (r() < slip) {
    // a sloppy moment: something legal at random, or nothing
    const opts = [end, ...req.moves.filter((m) => m.end !== 'out').map((m) => ({ kind: 'move', to: m.to }))];
    return opts[Math.floor(r() * opts.length)];
  }
  if (req.tackles.length) return { kind: 'tackle', pid: req.tackles[0] };
  const moves = req.moves.filter((m) => m.end !== 'out');
  const here = sqOf(me);

  // loose ball: go get it
  if (!c && ball) {
    const grab = moves.find((m) => m.end === 'ball');
    if (grab) return { kind: 'move', to: grab.to };
    return closer(moves, here, ball) ?? end;
  }

  if (c?.pid === me.pid) {
    const td = moves.find((m) => m.end === 'td');
    if (td) return { kind: 'move', to: td.to };
    // a pass to a teammate further downfield who isn't covered
    const good = req.passes.filter((p) => p.target && progress(game, side, p.to) > progress(game, side, here) + 1 && p.bonus - p.penalty >= 0);
    if (good.length && r() < 0.55) {
      good.sort((a, b) => progress(game, side, b.to) - progress(game, side, a.to));
      return { kind: 'pass', to: good[0].to };
    }
    // or lead a receiver: throw to open grass ahead of a teammate
    const lead = req.passes.filter((p) => !p.target && progress(game, side, p.to) > progress(game, side, here) + 3 && p.penalty === 0);
    if (lead.length && r() < 0.12) return { kind: 'pass', to: lead[Math.floor(r() * lead.length)].to };
    // run: furthest forward, avoiding traffic
    let best = null, score = progress(game, side, here) - threatCount(s, here, 1 - side) * 0.8;
    for (const m of moves) {
      const v = progress(game, side, m.to) - threatCount(s, m.to, 1 - side) * 0.8 - m.cost * 0.05;
      if (v > score + 0.01) { score = v; best = m; }
    }
    if (best) return { kind: 'move', to: best.to };
    if (req.handoffs.length && r() < 0.3) {
      const mate = req.handoffs.map((pid) => s.players[pid]).sort((a, b) => progress(game, side, sqOf(b)) - progress(game, side, sqOf(a)))[0];
      if (progress(game, side, sqOf(mate)) > progress(game, side, here)) return { kind: 'handoff', pid: mate.pid };
    }
    if (req.blocks.length && r() < 0.4) return { kind: 'block', pid: req.blocks[0] };
    return end;
  }

  if (c && c.side === side) {
    // teammate of the ball carrier: block someone near him, or get open downfield
    const near = req.blocks.filter((pid) => distance(sqOf(s.players[pid]), sqOf(c)) <= 2);
    if (near.length && r() < 0.7) return { kind: 'block', pid: near[0] };
    let best = null, score = progress(game, side, here) - threatCount(s, here, 1 - side);
    for (const m of moves) {
      const v = progress(game, side, m.to) - threatCount(s, m.to, 1 - side) - m.cost * 0.05;
      if (v > score + 0.5 && progress(game, side, m.to) <= progress(game, side, sqOf(c)) + 8) { score = v; best = m; }
    }
    return best ? { kind: 'move', to: best.to } : end;
  }

  if (c) {
    // defense: get next to the ball carrier (then tackle), or block whoever is in the way
    const adj = moves.filter((m) => distance(m.to, sqOf(c)) === 1);
    if (adj.length && req.mode !== 'half' && req.mode !== 'adjust') { adj.sort((a, b) => a.cost - b.cost); return { kind: 'move', to: adj[0].to }; }
    const step = closer(moves, here, sqOf(c));
    if (step) return step;
    if (req.blocks.length && r() < 0.5) return { kind: 'block', pid: req.blocks[0] };
  }
  return end;
}

function closer(moves, here, target) {
  let best = null, bd = distance(here, target);
  for (const m of moves) {
    const d = distance(m.to, target) + m.cost * 0.01;
    if (d < bd - 0.001 && !same(m.to, here)) { bd = d; best = m; }
  }
  return best ? { kind: 'move', to: best.to } : null;
}

