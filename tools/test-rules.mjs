// Rules tests: the rulebook's own worked examples, plus scripted engine scenarios with forced dice.
//   node --test tools/test-rules.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance, halfOf, lineAfterTackle, losRows, skillOf, spotCol, yardLabel } from '../src/engine/board.js';
import {
  checkDefense, checkOffense, checkResult, contactMods, leaveCost, moveReach, netModifier, passInfo, pushOptions, scatterOptions,
} from '../src/engine/rules.js';
import { Game, PlayEnd } from '../src/engine/game.js';
import { autoDefense, autoOffense } from '../src/engine/formations.js';

// a bare state: players = [[side, num, col, row, down?]], ball holder pid or null
function state(players, ball = null, extra = {}) {
  const s = { teams: [{ dir: -1 }, { dir: 1 }], players: {}, ball: ball ? { at: 'held', pid: ball } : { at: 'dead' }, play: { forwardDone: false }, ...extra };
  for (const [side, num, col, row, down] of players) s.players[`${side}:${num}`] = { pid: `${side}:${num}`, side, num, skill: skillOf(num), col, row, down: !!down };
  return s;
}

test('skill rating is the first digit; half moves round up', () => {
  assert.equal(skillOf(51), 5); assert.equal(skillOf(6), 6); assert.equal(skillOf(77), 7); assert.equal(skillOf(38), 3);
  assert.equal(halfOf(7), 4); assert.equal(halfOf(5), 3);
});

test('distance: every other diagonal after the first costs 1 (rulebook p.5 diagram: 6-7)', () => {
  // 4 diagonals + 1 straight = 7
  assert.equal(distance([0, 10], [4, 5]), 7);
  assert.equal(distance([0, 0], [1, 1]), 1);
  assert.equal(distance([0, 0], [2, 2]), 3);
  assert.equal(distance([0, 0], [0, 7]), 7);
});

test('check results: 10+ total, 7-9 partial, 6- fail, doubles critical, Rule of 3', () => {
  assert.equal(checkResult(5, 5, 0).result, 'total');
  assert.equal(checkResult(5, 5, 0).crit, true);
  assert.equal(checkResult(4, 3, 0).result, 'partial');
  assert.equal(checkResult(3, 3, 0).result, 'fail');
  assert.equal(checkResult(3, 3, 0).crit, true);
  assert.equal(netModifier(4, 3), 0);   // p.3: four bonuses and three penalties net 0, not +1
  assert.equal(netModifier(5, 1), 2);
});

test('block example p.6: #42 on #43 = 0 skill, +1 teamwork from #51', () => {
  const s = state([[0, 42, 5, 10], [0, 51, 7, 9], [1, 43, 6, 9]]);
  const m = contactMods(s, s.players['0:42'], s.players['1:43']);
  assert.deepEqual(m.parts, { skill: 0, teamwork: 1, ability: 0 });
});

test('block example p.6: #43 on #51 = +1 skill, -1 teamwork from #42 => 0', () => {
  const s = state([[0, 42, 5, 10], [0, 51, 7, 9], [1, 43, 6, 9]]);
  const m = contactMods(s, s.players['1:43'], s.players['0:51']);
  assert.equal(netModifier(m.bonus, m.penalty), 0);
});

test('tackle example p.7: #47 on #7 = +3 (capped, teamwork wasted), -1 from #56 => +2', () => {
  const s = state([[1, 47, 5, 5], [1, 70, 7, 5], [0, 7, 6, 4], [0, 56, 4, 5]]);
  const m = contactMods(s, s.players['1:47'], s.players['0:7']);
  assert.equal(netModifier(m.bonus, m.penalty), 2);
});

test('pass example p.8: #6 to #71 within 6, passer and receiver covered => -2', () => {
  // #6 threatened by #47; #71 threatened by two defenders; 6 squares away
  const s = state([[0, 6, 6, 18], [0, 71, 6, 12], [1, 47, 7, 17], [1, 40, 5, 11], [1, 41, 7, 11]], '0:6');
  const info = passInfo(s, s.players['0:6'], [6, 12]);
  assert.equal(info.dist, 6); assert.equal(info.bonus, 1); assert.equal(Math.min(3, info.penalty), 3);
  assert.equal(netModifier(info.bonus, info.penalty), -2);
  assert.equal(info.max, 12);
});

test('pass range: #7 throws up to 14, +1 within 7; no forward passes once one is thrown', () => {
  const s = state([[0, 7, 6, 20]], '0:7');
  assert.equal(passInfo(s, s.players['0:7'], [6, 6]).ok, true);
  assert.equal(passInfo(s, s.players['0:7'], [6, 5]).ok, false);
  assert.equal(passInfo(s, s.players['0:7'], [6, 13]).bonus, 1);
  s.play.forwardDone = true;
  assert.equal(passInfo(s, s.players['0:7'], [6, 13]).ok, false);
  assert.equal(passInfo(s, s.players['0:7'], [9, 20]).ok, true); // lateral is fine
});

test('movement: leaving a threatened square costs 2 per threat, 3 with the ball (p.8: stepping away costs 3)', () => {
  const s = state([[0, 6, 6, 18], [1, 47, 7, 17]], '0:6');
  assert.equal(leaveCost(s, [6, 18], s.players['0:6'], true), 3);
  assert.equal(leaveCost(s, [6, 18], s.players['0:6'], false), 2);
  const reach = moveReach(s, s.players['0:6'], 3);
  assert.equal(reach.get('6,19').cost, 3);
  assert.equal(reach.has('6,20'), false); // 3 to leave, then 1 more: out of a 3 budget
});

test('movement: the second diagonal costs 2; cannot cut between two players', () => {
  const s = state([[0, 7, 5, 10]]);
  const r = moveReach(s, s.players['0:7'], 7);
  assert.equal(r.get('6,9').cost, 1);
  assert.equal(r.get('7,8').cost, 3);
  const s2 = state([[0, 7, 5, 10], [0, 33, 6, 10], [1, 44, 5, 9]]);
  const r2 = moveReach(s2, s2.players['0:7'], 1);
  assert.equal(r2.has('6,9'), false);
});

test('blocks push straight back or to either side of that square', () => {
  const s = state([[0, 42, 6, 10], [1, 43, 6, 9]]);
  assert.deepEqual(pushOptions(s, [6, 10], [6, 9]).map(String).sort(), ['5,8', '6,8', '7,8']);
  const d = state([[0, 42, 5, 10], [1, 43, 6, 9]]);
  assert.deepEqual(pushOptions(d, [5, 10], [6, 9]).map(String).sort(), ['6,8', '7,8', '7,9']);
  const edge = state([[0, 42, 1, 10], [1, 43, 0, 10]]);
  assert.deepEqual(pushOptions(edge, [1, 10], [0, 10]), []); // would go out: knocked down instead
});

test('scatter: exact distance with the diagonal rule; fumbles stay in, passes can go out', () => {
  const s = state([]);
  const opts = scatterOptions(s, [6, 10], 2, false);
  assert.ok(opts.every((o) => distance([6, 10], o.to) <= 2 && !o.out));
  assert.ok(opts.some((o) => o.to[0] === 6 && o.to[1] === 8));
  const edge = scatterOptions(s, [0, 10], 2, true);
  assert.ok(edge.some((o) => o.out));
  assert.ok(!scatterOptions(s, [0, 10], 2, false).some((o) => o.out));
});

test('spotting the ball (p.13): near the sideline it comes in to the hash, otherwise the middle', () => {
  assert.deepEqual([0, 3, 4, 8, 9, 12].map(spotCol), [4, 4, 6, 6, 8, 8]);
  assert.equal(lineAfterTackle(15, -1), 15);
  assert.equal(lineAfterTackle(8, 1), 9);
  assert.equal(yardLabel(18, -1), 'OWN 20');
  assert.equal(yardLabel(6, 1), 'OWN 20');
  assert.equal(yardLabel(12, -1), '50');
});

test('formations: the rulebook p.10 offense is legal; diagonal-behind and lonely line are not', () => {
  const ctx = { line: 18, dir: -1, col: 6, count: 7 };
  const good = [{ num: 33, col: 6, row: 18 }, { num: 43, col: 4, row: 18 }, { num: 42, col: 8, row: 18 }, { num: 6, col: 6, row: 19 }, { num: 72, col: 0, row: 18 }, { num: 62, col: 11, row: 18 }, { num: 55, col: 6, row: 20 }];
  assert.equal(checkOffense(good, ctx).ok, true, checkOffense(good, ctx).errors.join());
  const diag = good.map((p) => (p.num === 55 ? { ...p, col: 5, row: 19 } : p));
  assert.equal(checkOffense(diag, ctx).ok, false);
  const far = good.map((p) => (p.num === 43 ? { ...p, col: 2 } : p));
  assert.equal(checkOffense(far, ctx).ok, false);
  const { off, def } = losRows(18, -1);
  assert.equal(off, 18); assert.equal(def, 17);
  const d = [{ num: 31, col: 6, row: 17 }, { num: 41, col: 4, row: 17 }, { num: 42, col: 8, row: 17 }, { num: 6, col: 6, row: 12 }, { num: 55, col: 3, row: 15 }, { num: 67, col: 0, row: 17 }, { num: 77, col: 11, row: 17 }];
  assert.equal(checkDefense(d, good, ctx).ok, true, checkDefense(d, good, ctx).errors.join());
  const free = d.map((p) => (p.num === 77 ? { ...p, col: 2 } : p)).map((p) => (p.num === 67 ? { ...p, row: 15, col: 1 } : p));
  assert.equal(checkDefense(free, good, ctx).ok, false); // #77 stands free while #62 is uncovered
});

test('auto formations are always legal, anywhere on the field', () => {
  const roster = [6, 7, 33, 42, 45, 55, 68].map((num) => ({ num, skill: skillOf(num) }));
  for (const dir of [-1, 1]) for (let line = 3; line <= 21; line++) for (const col of [4, 6, 8]) {
    const ctx = { line, dir, col, count: 7 };
    const o = autoOffense(roster, ctx);
    assert.ok(o, `offense ${line}/${dir}/${col}`);
    assert.ok(autoDefense(roster, o, ctx), `defense ${line}/${dir}/${col}`);
  }
});

// ---------- engine scenarios ----------
function scenario(players, ball, dice = []) {
  const roster = (side) => players.filter((p) => p[0] === side).map(([, num]) => ({ num }));
  const g = new Game({ teams: [{ id: 'a', name: 'A', roster: roster(0) }, { id: 'b', name: 'B', roster: roster(1) }], seed: 1, agents: [() => null, () => null] });
  for (const [side, num, col, row, down] of players) Object.assign(g.s.players[`${side}:${num}`], { col, row, down: !!down });
  g.s.ball = ball ? { at: 'held', pid: ball } : { at: 'dead' };
  g.s.offense = 0; g.s.line = 18;
  g.s.play = { startOffense: 0, line: 18, forwardDone: false, crossed: false, passThrown: false, adjustUsed: [false, false], activations: 0 };
  g.s.cards = [{ bench: [], stack: [], discard: [] }, { bench: [], stack: [], discard: [] }];
  const q = [...dice];
  g.d6 = () => (q.length ? q.shift() : 3);
  return g;
}
const scripted = (answers) => (game, side, req) => (answers[req.type] ? answers[req.type](req, game) : null);

test('engine: running into the end zone is a touchdown', async () => {
  const g = scenario([[0, 7, 6, 4], [1, 33, 0, 20]], '0:7');
  g.agents[0] = scripted({ act: () => ({ kind: 'move', to: [6, 1] }) });
  await assert.rejects(g.runActivation('0:7', 'card'), (e) => e instanceof PlayEnd && e.reason === 'td' && e.info.side === 0);
});

test('engine: a tackle (non-critical success) ends the down at the spot', async () => {
  const g = scenario([[0, 6, 6, 10], [1, 45, 6, 9]], '0:6', [4, 5]);
  g.agents[1] = scripted({ act: (req) => ({ kind: 'tackle', pid: req.tackles[0] }) });
  await assert.rejects(g.runActivation('1:45', 'card'), (e) => e.reason === 'tackle' && e.info.at[1] === 10);
});

test('engine: tackled in his own end zone is a safety', async () => {
  const g = scenario([[0, 6, 6, 22], [1, 45, 6, 21]], '0:6', [4, 5]);
  g.agents[1] = scripted({ act: (req) => ({ kind: 'tackle', pid: req.tackles[0] }) });
  await assert.rejects(g.runActivation('1:45', 'card'), (e) => e.reason === 'safety' && e.info.side === 1);
});

test('engine: a critical tackle knocks the ball loose and the down goes on', async () => {
  // dice 5,5 = critical total success; scatter dice 6,2 -> 4 squares
  const g = scenario([[0, 6, 6, 10], [1, 45, 6, 9]], '0:6', [5, 5, 6, 2]);
  g.agents[1] = scripted({ act: (req) => ({ kind: 'tackle', pid: req.tackles[0] }), scatter: (req) => req.options[0], bonus: () => null });
  g.agents[0] = scripted({ scatter: (req) => req.options[0], bonus: () => null });
  await g.runActivation('1:45', 'card');
  assert.equal(g.s.players['0:6'].down, true);
  assert.ok(g.s.ball.at === 'ground' || g.s.ball.at === 'held');
  // the scatter roll records whose die is whose as it's rolled (the board colours the dice from this, not from
  // possession later, which a recovery may already have flipped)
  const sc = g.s.log.find((e) => e.kind === 'scatter');
  assert.deepEqual(sc.sides, [0, 1]);
});

test('engine: a failed block can be reversed and gives the other coach a free activation', async () => {
  const g = scenario([[0, 7, 6, 10], [1, 33, 6, 9], [1, 45, 0, 0]], null, [1, 2]);
  const asked = [];
  g.agents[0] = scripted({ act: (req) => (req.blocks.length ? { kind: 'block', pid: req.blocks[0] } : { kind: 'end' }) });
  g.agents[1] = scripted({ reverse: () => true, push: (req) => req.options[0], followUp: () => false, bonus: (req) => { asked.push(req.kind); return null; } });
  await g.runActivation('0:7', 'card');
  assert.deepEqual([g.s.players['0:7'].col, g.s.players['0:7'].row].join(), '6,11'); // pushed back
  assert.deepEqual(asked, ['full']);
});

test('engine: defensive pressure costs two bench cards, or sacks with fewer than two', async () => {
  const g = scenario([[0, 6, 6, 19], [1, 45, 6, 15]], '0:6');
  g.s.cards[0].bench = [6, 6, 33];
  g.agents[1] = scripted({ act: (req) => (req.moves.some((m) => m.to[0] === 6 && m.to[1] === 18) ? { kind: 'move', to: [6, 18] } : { kind: 'end' }) });
  await g.runActivation('1:45', 'card');
  assert.equal(g.s.cards[0].bench.length, 1);
  const g2 = scenario([[0, 6, 6, 19], [1, 45, 6, 15]], '0:6');
  g2.s.cards[0].bench = [6];
  g2.agents[1] = g.agents[1];
  await assert.rejects(g2.runActivation('1:45', 'card'), (e) => e.reason === 'tackle');
});

// ---------- rules double-pass (B5): one scenario per rule, page numbers from the rulebook ----------
test('p.4: after more than half a move, no block / tackle / pass (move-and-X is half then act)', async () => {
  const g = scenario([[0, 6, 6, 14], [1, 45, 6, 9]], null);
  let asked = 0, last = null;
  g.agents[0] = (game, side, req) => {
    if (req.type !== 'act') return null;
    asked++; last = req;
    return asked === 1 ? { kind: 'move', to: [6, 10] } : { kind: 'end' }; // 4 squares: more than half of 6
  };
  await g.runActivation('0:6', 'card');
  assert.equal(last.blocks.length, 0);
});

test('p.13: a read-and-react player may not half-move and then act', async () => {
  const g = scenario([[0, 6, 6, 12], [1, 45, 6, 9]], null);
  let asked = 0, last = null;
  g.agents[0] = (game, side, req) => { if (req.type !== 'act') return null; asked++; last = req; return asked === 1 ? { kind: 'move', to: [6, 11] } : { kind: 'end' }; };
  await g.runActivation('0:6', 'rr');
  assert.equal(last.blocks.length, 0);
});

test('p.3: total success gives a free activation to another player (not the one who acted)', async () => {
  const g = scenario([[0, 42, 6, 10], [0, 33, 0, 20], [1, 45, 6, 9]], null, [5, 6]);
  let bonus = null;
  g.agents[0] = scripted({ act: (req) => (req.blocks.length ? { kind: 'block', pid: req.blocks[0] } : { kind: 'end' }), push: (req) => req.options[0], followUp: () => false, bonus: (req) => { bonus = req; return null; } });
  await g.runActivation('0:42', 'card');
  assert.equal(bonus.kind, 'full');
  assert.ok(!bonus.options.includes('0:42') && bonus.options.includes('0:33'));
});

test('p.3: partial success gives the other coach a half move', async () => {
  const g = scenario([[0, 42, 6, 10], [1, 45, 6, 9]], null, [3, 4]);
  let bonus = null;
  g.agents[0] = scripted({ act: (req) => (req.blocks.length ? { kind: 'block', pid: req.blocks[0] } : { kind: 'end' }), push: (req) => req.options[0], followUp: () => false });
  g.agents[1] = scripted({ bonus: (req) => { bonus = req; return null; } });
  await g.runActivation('0:42', 'card');
  assert.equal(bonus.kind, 'half');
});

test('p.6: critical block failure: the defender may decline the push, the blocker still goes down', async () => {
  const g = scenario([[0, 42, 6, 10], [1, 45, 6, 9]], null, [2, 2]);
  g.agents[0] = scripted({ act: (req) => (req.blocks.length ? { kind: 'block', pid: req.blocks[0] } : { kind: 'end' }) });
  g.agents[1] = scripted({ reverse: () => false, bonus: () => null });
  await g.runActivation('0:42', 'card');
  assert.equal(g.s.players['0:42'].down, true);
  assert.deepEqual([g.s.players['0:42'].col, g.s.players['0:42'].row], [6, 10]);
});

test('p.7: no forward pass once the ball has crossed the line of scrimmage', () => {
  const g = scenario([[0, 7, 6, 15], [0, 33, 6, 10]], '0:7');
  g.ballMoved();
  assert.equal(g.s.play.forwardDone, true);
  assert.equal(passInfo(g.s, g.s.players['0:7'], [6, 10]).ok, false);
});

test('p.7: a pass may not target a knocked-down teammate', () => {
  const s = state([[0, 7, 6, 20], [0, 33, 6, 16, true]], '0:7');
  assert.equal(passInfo(s, s.players['0:7'], [6, 16]).ok, false);
});

test('p.8: a hand-off with nobody threatening is automatic (no dice)', async () => {
  const g = scenario([[0, 6, 6, 19], [0, 33, 6, 18], [1, 45, 0, 5]], '0:6', []);
  let rolled = 0; const d6 = g.d6; g.d6 = () => { rolled++; return d6(); };
  g.agents[0] = scripted({ act: (req) => (req.handoffs.length && g.s.ball.pid === '0:6' ? { kind: 'handoff', pid: req.handoffs[0] } : { kind: 'end' }) });
  await g.runActivation('0:6', 'card');
  assert.equal(g.s.ball.pid, '0:33');
  assert.equal(rolled, 0);
});

test('p.8: a threatened hand-off on doubles fails: ball scattered, activation over', async () => {
  const g = scenario([[0, 6, 6, 19], [0, 33, 6, 18], [1, 45, 7, 17]], '0:6', [4, 4, 5, 2]);
  let acts = 0;
  g.agents[0] = scripted({ act: (req) => { acts++; return req.handoffs.length ? { kind: 'handoff', pid: req.handoffs[0] } : { kind: 'end' }; }, scatter: (req) => req.options[0] });
  g.agents[1] = scripted({ scatter: (req) => req.options[0] });
  await g.runActivation('0:6', 'card');
  assert.equal(acts, 1);
  assert.notEqual(g.s.ball.at, 'held');
});

test('p.8: a pass scattering out of bounds is incomplete', async () => {
  const g = scenario([[0, 7, 6, 20], [1, 45, 12, 10]], '0:7', [1, 2, 6, 1]);
  g.agents[0] = scripted({ act: () => ({ kind: 'pass', to: [12, 12] }), scatter: (req) => req.options.find((o) => o.out) ?? req.options[0], bonus: () => null });
  g.agents[1] = scripted({ scatter: (req) => req.options.find((o) => o.out) ?? req.options[0], bonus: () => null });
  await assert.rejects(g.runActivation('0:7', 'card'), (e) => e.reason === 'incomplete');
});

test('p.8: equal scatter dice: a dramatic recovery (a downed carrier who keeps it is down)', async () => {
  const g = scenario([[0, 6, 6, 10], [1, 45, 6, 9]], '0:6', [5, 5, 3, 3]);
  g.agents[1] = scripted({ act: (req) => ({ kind: 'tackle', pid: req.tackles[0] }), bonus: () => null });
  g.agents[0] = scripted({ bonus: () => null });
  await assert.rejects(g.runActivation('1:45', 'card'), (e) => e.reason === 'tackle');
});

test('p.13: a running play uses two minutes; a passing play one; a timeout cube is never doubled', async () => {
  const run = scenario([[0, 6, 6, 10]], null);
  run.s.pile = ['y', 'y', 'y']; run.s.play.cube = 'y';
  await run.endPlay(new PlayEnd('tackle', { side: 0, at: [6, 10] }));
  assert.equal(run.s.pile.length, 2);
  const pass = scenario([[0, 6, 6, 10]], null);
  pass.s.pile = ['y', 'y', 'y']; pass.s.play.cube = 'y'; pass.s.play.passThrown = true;
  await pass.endPlay(new PlayEnd('tackle', { side: 0, at: [6, 10] }));
  assert.equal(pass.s.pile.length, 3);
  const last = scenario([[0, 6, 6, 10]], null);
  last.s.pile = ['r']; last.s.play.cube = 'y';
  await last.endPlay(new PlayEnd('tackle', { side: 0, at: [6, 10] }));
  assert.equal(last.s.pile.length, 1);
});

test('p.7: a tackle on 4th down hands the ball over at the spot', async () => {
  const g = scenario([[0, 6, 6, 10]], null);
  g.s.down = 4;
  await g.endPlay(new PlayEnd('tackle', { side: 0, at: [6, 12] }));
  assert.equal(g.s.offense, 1);
  assert.equal(g.s.down, 1);
});

test('p.5: defensive pressure happens once per activation (out and back in is no second hit)', async () => {
  const g = scenario([[0, 6, 6, 19], [1, 45, 6, 16]], '0:6');
  g.s.cards[0].bench = [6, 6, 33, 33, 42, 42];
  const path = [[6, 18], [6, 17], [7, 18]];
  let i = 0;
  g.agents[1] = scripted({ act: (req) => (i < path.length && req.moves.some((m) => m.to[0] === path[i][0] && m.to[1] === path[i][1]) ? { kind: 'move', to: path[i++] } : { kind: 'end' }) });
  await g.runActivation('1:45', 'card');
  assert.equal(g.s.cards[0].bench.length, 4);
});

test('p.9-10: the hike receiver must be within the hiker skill rating, straight behind', () => {
  const ctx = { line: 18, dir: -1, col: 6, count: 7 };
  const spots = [{ num: 33, col: 6, row: 18 }, { num: 43, col: 4, row: 18 }, { num: 42, col: 8, row: 18 }, { num: 6, col: 6, row: 22 }, { num: 72, col: 0, row: 18 }, { num: 62, col: 11, row: 18 }, { num: 55, col: 5, row: 21 }];
  assert.equal(checkOffense(spots, ctx).ok, false);
});

test('p.13: no adjustment for a player holding the ball; partners exclude the carrier', async () => {
  const g = scenario([[0, 6, 6, 19], [0, 33, 5, 18], [0, 42, 7, 18]], '0:6');
  const req = await new Promise((res) => { g.agents[0] = (game, side, r) => { if (r.type === 'act') { res(r); return { kind: 'end' }; } return null; }; g.runActivation('0:6', 'card'); });
  assert.equal(req.canAdjust, false);
  const g2 = scenario([[0, 6, 6, 19], [0, 33, 5, 18], [0, 42, 7, 18]], '0:6');
  let partner = null;
  g2.agents[0] = (game, side, r) => {
    if (r.type === 'act') return r.canAdjust ? { kind: 'adjust' } : { kind: 'end' };
    if (r.type === 'adjustPartner') { partner = r; return { pid: r.options[0], first: 'self' }; }
    return null;
  };
  await g2.runActivation('0:33', 'card');
  assert.ok(partner && !partner.options.includes('0:6'));
});

test('p.5: standing up costs 3 (a half move of 2 cannot stand)', async () => {
  const g = scenario([[0, 42, 6, 10, true]], null);
  const p = g.s.players['0:42'];
  assert.equal(g.actRequest(p, { mode: 'half', budget: 2, spent: 0, parity: 0, fresh: true }).canStand, false);
  assert.equal(g.actRequest(p, { mode: 'card', budget: 4, spent: 0, parity: 0, fresh: true }).canStand, true);
});

test('p.13: catching a pass in the end zone is a touchdown', async () => {
  const g = scenario([[0, 7, 6, 10], [0, 33, 6, 1]], '0:7', [5, 4]);
  g.agents[0] = scripted({ act: () => ({ kind: 'pass', to: [6, 1] }) });
  await assert.rejects(g.runActivation('0:7', 'card'), (e) => e.reason === 'td');
});

test('p.12: same skill ratings: a die each decides; a tie again lets the offense decide', async () => {
  const g = scenario([[0, 42, 0, 20], [1, 45, 12, 2]], null, [3, 3]);
  let decider = null;
  const who = () => (game, sd, r) => { if (r.type === 'first') { decider = sd; return 'me'; } return r.type === 'act' ? { kind: 'end' } : null; };
  g.agents = [who(), who()];
  await g.round(42, 45);
  assert.equal(decider, 0);
});

test('playbook: every built-in offense and defense is legal everywhere on the field', async () => {
  const { OFFENSE_SETS, DEFENSE_SETS, buildOffense, buildDefense } = await import('../src/data/playbook.js');
  const roster = [6, 7, 33, 42, 45, 55, 68].map((num) => ({ num, skill: skillOf(num) }));
  const bad = [];
  for (const dir of [-1, 1]) for (let line = 3; line <= 21; line++) for (const col of [4, 6, 8]) {
    const ctx = { line, dir, col, count: 7 };
    for (const set of OFFENSE_SETS) {
      const o = buildOffense(set, roster, ctx);
      const r = checkOffense(o, ctx);
      if (!r.ok) bad.push(`${set.id} ${dir}/${line}/${col}: ${r.errors[0]}`);
      for (const ds of DEFENSE_SETS) {
        const d = buildDefense(ds, roster, o, ctx);
        const rd = checkDefense(d, o, ctx);
        if (!rd.ok) bad.push(`${ds.id} vs ${set.id} ${dir}/${line}/${col}: ${rd.errors[0]}`);
      }
    }
  }
  assert.equal(bad.length, 0, bad.slice(0, 5).join(' | '));
});

// ---------- B6: skills (rulebook pp.15-18), field goals (pp.20-21), INFERNO (pp.19-20) ----------
function skillGame(players, ball, dice = [], abilities = {}, mode = 'alltechno') {
  const roster = (side) => players.filter((p) => p[0] === side).map(([, num]) => ({ num, abilities: abilities[`${side}:${num}`] ?? [] }));
  const g = new Game({ teams: [{ id: 'a', name: 'A', roster: roster(0) }, { id: 'b', name: 'B', roster: roster(1) }], seed: 1, mode, agents: [() => null, () => null] });
  for (const [side, num, col, row, down] of players) Object.assign(g.s.players[`${side}:${num}`], { col, row, down: !!down });
  g.s.ball = ball ? { at: 'held', pid: ball } : { at: 'dead' };
  g.s.offense = 0; g.s.line = 18;
  g.s.play = { startOffense: 0, line: 18, forwardDone: false, crossed: false, passThrown: false, adjustUsed: [false, false], activations: 0 };
  g.s.cards = [{ bench: [], stack: [], discard: [] }, { bench: [], stack: [], discard: [] }];
  const q = [...dice];
  g.d6 = () => (q.length ? q.shift() : 3);
  return g;
}
const withSkills = (players, ball, ab) => { const s = state(players, ball, { skills: true, offense: 0, play: { line: 18, forwardDone: false } }); for (const [pid, a] of Object.entries(ab)) s.players[pid].abilities = a; return s; };

test('p.16-18: BLOCK +1, TACKLE +3 and TEAM PLAYER change the numbers (and only in a skills mode)', () => {
  const s = withSkills([[0, 42, 6, 10], [0, 44, 7, 9], [1, 43, 6, 9]], '1:43', { '0:42': ['BLOCK +1', 'TACKLE +3'], '0:44': ['TEAM PLAYER'] });
  const b = contactMods(s, s.players['0:42'], s.players['1:43'], 'block');
  assert.equal(b.parts.ability, 1);
  assert.equal(b.parts.teamwork, 2); // #44 is a team player: +2
  assert.equal(contactMods(s, s.players['0:42'], s.players['1:43'], 'tackle').parts.ability, 3);
  s.skills = false;
  assert.equal(contactMods(s, s.players['0:42'], s.players['1:43'], 'block').parts.ability, 0);
});

test('p.17: JUKE / SHAKE: the higher-rated player gets the rating bonus', () => {
  const s = withSkills([[0, 7, 6, 10], [1, 43, 6, 9]], '0:7', {});
  assert.equal(contactMods(s, s.players['0:7'], s.players['1:43'], 'juke').parts.skill, 3);
  assert.equal(contactMods(s, s.players['0:7'], s.players['1:43'], 'block').parts.skill, -3);
});

test('p.17: LOCKDOWN makes leaving his zone cost 3 without the ball; SIDELINER ignores threat along the sideline', () => {
  const s = withSkills([[0, 6, 0, 18], [1, 45, 1, 17]], null, { '1:45': ['LOCKDOWN'], '0:6': ['SIDELINER'] });
  assert.equal(leaveCost(s, [0, 18], s.players['0:6'], false, [1, 19]), 3);
  assert.equal(leaveCost(s, [0, 18], s.players['0:6'], false, [0, 17]), 1); // sideline to sideline: no threat at all
  assert.equal(leaveCost(s, [0, 18], s.players['0:6'], true, [0, 17]), 2);  // with the ball: 2 per threat, lockdown ignored
});

test('p.18: SQUEEZE PLAY slips through a diagonal with players on both sides', () => {
  const s = withSkills([[0, 6, 6, 10], [1, 45, 7, 10], [1, 46, 6, 9]], null, {});
  assert.equal(moveReach(s, s.players['0:6'], 6).has('7,9'), false);
  s.players['0:6'].abilities = ['SQUEEZE PLAY'];
  assert.equal(moveReach(s, s.players['0:6'], 6).has('7,9'), true);
});

test('p.17-18: ROUTE / SCREEN / ZONE DEFENDER / MAN DEFENDER on a pass', () => {
  const s = withSkills([[0, 7, 6, 20], [0, 33, 6, 14], [1, 45, 9, 12], [1, 46, 7, 13]], '0:7', { '0:7': ['ROUTE PASSER', 'SCREEN PASSER'], '1:45': ['ZONE DEFENDER'], '1:46': ['MAN DEFENDER'] });
  const open = passInfo(s, s.players['0:7'], [10, 15]); // open grass, 3 from the zone defender
  assert.ok(open.why.includes('+1 route passer'));
  assert.equal(open.penalty, 1);
  const man = passInfo(s, s.players['0:7'], [6, 14]); // #46 covers #33
  assert.ok(man.penalty >= 3);
  const screen = passInfo(s, s.players['0:7'], [4, 19]);
  assert.ok(screen.why.includes('+1 screen passer'));
});

test('p.16: BLITZ blocks as part of a move and keeps going', async () => {
  const g = skillGame([[1, 45, 6, 9], [0, 42, 6, 10]], null, [5, 4], { '1:45': ['BLITZ'] });
  let acts = 0;
  g.agents[1] = scripted({ act: () => { acts++; return acts === 1 ? { kind: 'block', pid: '0:42' } : { kind: 'end' }; }, push: (req) => req.options[0], followUp: () => true, bonus: () => null });
  g.agents[0] = scripted({ bonus: () => null });
  await g.runActivation('1:45', 'card');
  assert.equal(acts, 2); // asked again after the block
});

test('p.18: SHOVE drives the target straight back 2 squares', async () => {
  const g = skillGame([[1, 45, 6, 9], [0, 42, 6, 10]], null, [5, 4], { '1:45': ['SHOVE'] });
  g.agents[1] = scripted({ act: (req) => (req.shoves.length ? { kind: 'shove', pid: req.shoves[0] } : { kind: 'end' }), followUp: () => false, bonus: () => null });
  g.agents[0] = scripted({ bonus: () => null });
  await g.runActivation('1:45', 'card');
  assert.deepEqual([g.s.players['0:42'].col, g.s.players['0:42'].row], [6, 12]);
  assert.equal(g.s.players['0:42'].down, false);
});

test('p.18: STIFF ARM: a playmaker match cancels a die, and a missed tackle flattens the tackler', async () => {
  // tackle dice 4,2 + playmaker 4: the 4 is cancelled -> 2 + 0 = fail
  const g = skillGame([[0, 6, 6, 12], [1, 65, 6, 11]], '0:6', [4, 2, 4], { '0:6': ['STIFF ARM'] });
  g.agents[1] = scripted({ act: (req) => (req.tackles.length ? { kind: 'tackle', pid: req.tackles[0] } : { kind: 'end' }) });
  g.agents[0] = scripted({ bonus: () => null });
  await g.runActivation('1:65', 'card');
  assert.equal(g.s.players['1:65'].down, true);
  assert.equal(g.s.players['0:6'].down, false);
});

test('p.18: SPIN MOVE: on a matched miss he can swap squares with the tackler', async () => {
  const g = skillGame([[0, 6, 6, 12], [1, 65, 6, 11]], '0:6', [4, 2, 4], { '0:6': ['SPIN MOVE'] });
  g.agents[1] = scripted({ act: (req) => (req.tackles.length ? { kind: 'tackle', pid: req.tackles[0] } : { kind: 'end' }) });
  g.agents[0] = scripted({ spin: () => true, bonus: () => null });
  await g.runActivation('1:65', 'card');
  assert.deepEqual([g.s.players['0:6'].col, g.s.players['0:6'].row], [6, 11]);
});

test('p.17: PITCH hands off from up to 3 squares away', async () => {
  const g = skillGame([[0, 7, 6, 18], [0, 33, 9, 18], [1, 45, 0, 5]], '0:7', [], { '0:7': ['PITCH'] });
  g.agents[0] = scripted({ act: (req) => (g.s.ball.pid === '0:7' && req.handoffs.includes('0:33') ? { kind: 'handoff', pid: '0:33' } : { kind: 'end' }) });
  await g.runActivation('0:7', 'card');
  assert.equal(g.s.ball.pid, '0:33');
});

test('p.17: INTERCEPTOR: a missed throw near him lands on him (sport check to hold on)', async () => {
  // pass dice 1,1 (fail), then the interception sport check 2,5
  const g = skillGame([[0, 7, 6, 20], [0, 33, 6, 14], [1, 45, 7, 13]], '0:7', [1, 1, 2, 5], { '1:45': ['INTERCEPTOR'] });
  g.agents[0] = scripted({ act: () => ({ kind: 'pass', to: [6, 14] }), bonus: () => null });
  g.agents[1] = scripted({ bonus: () => null });
  await g.runActivation('0:7', 'card');
  assert.equal(g.s.ball.pid, '1:45');
  assert.equal(g.s.offense, 1);
});

test('p.17: DODGE spends his cards for -1 each on a tackle at him', async () => {
  const g = skillGame([[0, 6, 6, 12], [1, 45, 6, 11]], '0:6', [2, 3], { '0:6': ['DODGE'] });
  g.s.cards[0].bench = [6, 6];
  let check = null;
  g.onChange = (st) => { const l = st.log.at(-1); if (l?.kind === 'check') check = l; };
  g.agents[1] = scripted({ act: (req) => (req.tackles.length ? { kind: 'tackle', pid: req.tackles[0] } : { kind: 'end' }) });
  g.agents[0] = scripted({ dodge: (req) => req.max, bonus: () => null });
  await g.runActivation('1:45', 'card');
  assert.equal(check.penalty, 2);
});

test('p.17: QB READ lets the offense read and react only with him, when he has the ball', async () => {
  const g = skillGame([[0, 7, 6, 18], [0, 33, 5, 17], [1, 45, 6, 10], [1, 46, 2, 10]], '0:7', [], { '0:7': ['QB READ'] });
  g.s.cards[0].bench = [7, 33];
  g.s.cards[1].bench = [46];
  let asked = null;
  g.agents[1] = scripted({ readReact: () => null, first: () => 'me', act: () => ({ kind: 'end' }) });
  g.agents[0] = scripted({ readReact: (req) => { asked = req; return null; }, first: () => 'me', act: () => ({ kind: 'end' }) });
  await g.round(33, 45);
  assert.deepEqual(asked.only, [7]);
});

test('PRO: 8-vs-8 (#51 plays) and the field goal distance (p.20 example: kick from the 45-yard square = 12)', () => {
  const g = skillGame([[0, 51, 6, 10], [1, 45, 6, 9]], null, [], {}, 'pro');
  assert.ok(g.s.players['0:51']);
  g.s.line = 10; g.s.spot = 6;
  assert.equal(g.fgDistance(), 12);
  const t = new Game({ teams: [{ id: 'a', name: 'A', roster: [{ num: 51 }, { num: 6 }] }, { id: 'b', name: 'B', roster: [{ num: 45 }] }], mode: 'techno' });
  assert.equal(t.s.players['0:51'], undefined);
});

test('PRO: a field goal is 3d6 against the distance: good = 3 points, other team on its 20', async () => {
  const g = skillGame([[0, 51, 6, 10], [1, 45, 6, 9]], null, [6, 5, 4], {}, 'pro');
  g.s.line = 10; g.s.spot = 6; g.s.pile = ['y', 'y']; g.s.down = 4;
  g.agents[0] = scripted({ kick: () => true });
  assert.equal(await g.maybeKick(), true);
  assert.equal(g.s.score[0], 3);
  assert.equal(g.s.offense, 1);
});

test('INFERNO: tokens cap at 3; ON FIRE gives +3 on checks and ends on a failed check', async () => {
  const g = skillGame([[0, 42, 6, 10], [1, 45, 6, 9]], null, [1, 2], {}, 'inferno');
  g.earn(0, 2, 'test'); g.earn(0, 2, 'test');
  assert.equal(g.s.fire[0], 3);
  const p = g.s.players['0:42'];
  g.setOnFire(p);
  assert.equal(contactMods(g.s, p, g.s.players['1:45'], 'block').parts.ability, 3);
  g.agents[0] = scripted({ act: (req) => (req.blocks.length ? { kind: 'block', pid: req.blocks[0] } : { kind: 'end' }), boost: () => 0 });
  g.agents[1] = scripted({ reverse: () => false, bonus: () => null, fireDefend: () => 0 });
  await g.runActivation('0:42', 'card');
  assert.equal(p.onFire, false); // 1+2 -3 +3 = 3: failed
});

test('INFERNO: a dirty hit on a downed player earns a token (3 on a critical)', async () => {
  const g = skillGame([[0, 42, 6, 10], [1, 45, 6, 9, true]], null, [5, 5], {}, 'inferno');
  g.agents[0] = scripted({ act: (req) => (req.dirty.length ? { kind: 'dirty', pid: req.dirty[0] } : { kind: 'end' }), boost: () => 0, bonus: () => null });
  await g.runActivation('0:42', 'card');
  assert.equal(g.s.fire[0], 3);
});

test('an adjustment can be called off before a partner is picked (owner bug #2): his turn carries on', async () => {
  const g = scenario([[0, 42, 6, 10], [0, 33, 2, 12], [1, 45, 0, 0]], null);
  let acts = 0, adjustSeen = false;
  g.agents[0] = scripted({
    act: (req) => { acts++; if (acts === 1) { adjustSeen = req.canAdjust; return { kind: 'adjust' }; } return { kind: 'end' }; },
    adjustPartner: () => null,
  });
  await g.runActivation('0:42', 'card');
  assert.equal(adjustSeen, true);
  assert.equal(acts, 2); // asked again after cancelling
  assert.equal(g.s.play.adjustUsed[0], false);
});

test('an empty / broken answer to a square prompt never crashes the game (owner bug: the fumble scatter)', async () => {
  // a critical tackle fumbles; the offense's scatter pick comes back empty, then as junk: the engine asks again and
  // falls back to a legal square instead of throwing
  const g = scenario([[0, 6, 6, 10], [1, 45, 6, 9]], '0:6', [5, 5, 6, 2]);
  g.agents[1] = scripted({ act: (req) => ({ kind: 'tackle', pid: req.tackles[0] }), scatter: () => undefined, bonus: () => null });
  g.agents[0] = scripted({ scatter: () => ({ sq: [1, 1] }), bonus: () => null, push: () => undefined });
  await g.runActivation('1:45', 'card');
  assert.ok(g.s.ball.at === 'ground' || g.s.ball.at === 'held');
});

test('p.13: a timeout from a dead-ball question adds a play to the half and comes back to the same question', async () => {
  const g = skillGame([[0, 42, 6, 10], [1, 45, 6, 9]], null);
  g.s.pile = ['y']; g.s.phase = 'formation';
  let asked = 0;
  g.agents[0] = (game, side, req) => (req.type === 'call' ? (asked++ === 0 ? { timeout: true } : req.bench.slice(0, req.count)) : null);
  g.agents[1] = (game, side, req) => (req.type === 'call' ? req.bench.slice(0, req.count) : null);
  g.s.cards = [{ bench: [42, 42], stack: [], discard: [] }, { bench: [45, 45], stack: [], discard: [] }];
  await g.callPlays();
  assert.equal(asked, 2);
  assert.equal(g.s.timeouts[0], 1);
  assert.deepEqual(g.s.pile, ['y', 'r']);
});

test('p.13-14: no timeout while the ball is live, with none left, with no time left, or in overtime', () => {
  const g = skillGame([[0, 42, 6, 10], [1, 45, 6, 9]], null);
  g.s.pile = ['y']; g.s.phase = 'formation';
  assert.equal(g.canTimeout(0), true);
  g.s.phase = 'play'; assert.equal(g.canTimeout(0), false); g.s.phase = 'formation';
  g.s.timeouts[0] = 0; assert.equal(g.canTimeout(0), false); g.s.timeouts[0] = 2;
  g.s.pile = []; assert.equal(g.canTimeout(0), false); g.s.pile = ['y'];
  g.s.overtime = true; assert.equal(g.canTimeout(0), false);
});

test('motion logs the route he runs (the board walks it instead of teleporting)', async () => {
  const g = skillGame([[0, 6, 6, 20], [0, 42, 6, 18], [0, 33, 5, 18], [0, 44, 7, 18], [0, 7, 6, 19], [1, 45, 6, 17]], null);
  g.s.line = 18;
  g.s.cards[0].bench = [6, 6, 42, 42];
  let opt = null;
  g.agents[0] = (game, side, req) => { if (req.type !== 'motion') return null; opt = req.options.find((o) => o.pid === '0:6'); const to = opt.reach.find((q) => Math.abs(q[0] - 6) >= 2) ?? opt.reach[0]; return { pid: '0:6', to, discard: [req.bench[0]] }; };
  let entry = null;
  g.onChange = (st) => { const l = st.log.at(-1); if (l?.kind === 'motion') entry = l; };
  await g.motion(0, 1);
  assert.ok(entry && entry.path.length >= 1);
  assert.deepEqual(entry.path.at(-1), entry.to);
});

test('why: a move breakdown adds up to the cost, and names the players whose zones it leaves', async () => {
  const { moveWhy, contactWhy } = await import('../src/game/why.js');
  const { moveReach, contactMods, netModifier } = await import('../src/engine/rules.js');
  // carrier #6 at (6,10) next to defender #45 at (6,9) and #33 at (7,10): leaving costs 3 + 3 with the ball
  const g = scenario([[0, 6, 6, 10], [1, 45, 6, 9], [1, 33, 7, 10], [0, 22, 4, 12]], '0:6');
  const p = g.s.players['0:6'];
  for (const m of moveReach(g.s, p, 6, 0).values()) {
    const w = moveWhy(g.s, p, m.to, 6, 0);
    const sum = w.lines.reduce((n, [, v]) => n + Number(v.replace('+', '')), 0);
    assert.equal(sum, m.cost, `cost to ${m.to}`);
  }
  const w = moveWhy(g.s, p, [5, 11], 6, 0);
  assert.deepEqual(w.against.sort(), ['1:33', '1:45']);
  // a tackle: the listed modifiers net to the engine's own (within the rule of 3)
  const c = contactWhy(g.s, g.s.players['1:45'], p, 'tackle');
  const mods = contactMods(g.s, g.s.players['1:45'], p, 'tackle');
  assert.equal(c.net, netModifier(mods.bonus, mods.penalty));
  assert.deepEqual(c.help, ['1:33']);
});

test('depth chart: the charted QB takes the snap in every set, charted line men line up on defense', async () => {
  const { OFFENSE_SETS, DEFENSE_SETS, buildOffense, buildDefense } = await import('../src/data/playbook.js');
  const { checkOffense, checkDefense } = await import('../src/engine/rules.js');
  const roster = [6, 7, 33, 42, 45, 55, 68].map((num) => ({ num, skill: num < 10 ? num : Math.floor(num / 10) }));
  const ctx = { line: 12, dir: -1, col: 6, count: roster.length };
  for (const set of OFFENSE_SETS) {
    const o = buildOffense(set, roster, ctx, { 6: 'Q', 33: 'C' });
    assert.ok(checkOffense(o, ctx).ok, set.name);
    const qSlot = set.spots.findIndex((x) => x[0] === 'Q');
    const [, dc, d] = set.spots[qSlot];
    const at = o.find((x) => x.col === 6 + dc && x.row === 12 + d); // offense on row 12, backs further back (+1 per row)
    assert.equal(at?.num, 6, `${set.name}: #6 is the QB`);
    const hiker = o.find((x) => x.col === 6 && x.row === 12);
    assert.equal(hiker?.num, 33, `${set.name}: #33 hikes`);
  }
  const off = buildOffense(OFFENSE_SETS[0], roster, ctx);
  const d = buildDefense(DEFENSE_SETS[0], roster, off, ctx, { 68: 'L', 6: 'B' });
  assert.ok(checkDefense(d, off, ctx).ok);
  assert.equal(d.find((x) => x.num === 68).row, 11); // on the defense's line row
  assert.notEqual(d.find((x) => x.num === 6).row, 11);
});

test('p.15: total successes chain free activations (each free activation can earn the next)', async () => {
  // A #34 blocks B #55, then free activation #45 blocks B #77, then free activation #22 blocks B #31
  const g = scenario([[0, 34, 2, 10], [1, 55, 2, 9], [0, 45, 6, 10], [1, 77, 6, 9], [0, 22, 10, 10], [1, 31, 10, 9], [0, 6, 6, 14]], '0:6', [5, 6, 5, 6, 5, 6]);
  const acted = [];
  const next = { '0:34': '0:45', '0:45': '0:22' };
  let last = '0:34';
  g.agents[0] = scripted({
    act: (req) => { acted.push(req.pid); last = req.pid; return req.blocks.length ? { kind: 'block', pid: req.blocks[0] } : { kind: 'end' }; },
    bonus: (req) => (next[last] && req.options.includes(next[last]) ? next[last] : null), push: (req) => req.options[0], followUp: () => false, boost: () => 0,
  });
  g.agents[1] = scripted({ reverse: () => false, push: (req) => req.options[0], followUp: () => false, boost: () => 0, bonus: () => null });
  await g.runActivation('0:34', 'card');
  assert.deepEqual(acted, ['0:34', '0:45', '0:22']);
});

test('replays: every play rebuilt from the recorded frames matches what happened (walks start and end in place)', async () => {
  const { makeAI } = await import('../src/engine/ai.js');
  const { lastPlay } = await import('../src/game/replay.js');
  let plays = 0, tds = 0;
  for (const seed of [11, 22, 33]) {
    const ai = makeAI('starter');
    const problems = [];
    let seen = 0;
    const g = new Game({ teams: [{ id: 'a', name: 'A', roster: [6, 7, 33, 42, 45, 55, 68].map((num) => ({ num })) }, { id: 'b', name: 'B', roster: [6, 7, 33, 42, 45, 55, 68].map((num) => ({ num })) }], seed, mode: 'alltechno', agents: [ai, ai] }, {
      pace: () => 0,
      onChange: (st) => {
        const end = st.log.at(-1);
        if (!end || !['whistle', 'td', 'safety'].includes(end.kind) || end.id <= seen) return;
        seen = end.id;
        const play = lastPlay(st, g.frames);
        if (!play) return;
        plays++;
        assert.ok(play.exact, 'screen games replay from frames');
        let prev = play.start;
        for (const { e, f } of play.steps) {
          if (e.kind === 'move' && e.path?.length) {
            const a = prev.p[e.pid], b = f.p[e.pid], last = e.path.at(-1), first = e.path[0];
            if (b[0] !== last[0] || b[1] !== last[1]) problems.push(`move ${e.id} ends off its path`);
            if (Math.max(Math.abs(a[0] - first[0]), Math.abs(a[1] - first[1])) > 1) problems.push(`move ${e.id} starts away from ${e.pid}`);
          }
          // nobody shares a square in any frame
          const taken = new Set();
          for (const [pid, q] of Object.entries(f.p)) { if (q[0] == null) continue; const k = `${q[0]},${q[1]}`; if (taken.has(k)) problems.push(`two on ${k} at ${e.id} (${pid})`); taken.add(k); }
          prev = f;
        }
        if (end.kind === 'td') {
          tds++;
          // the touchdown replay is the whole play: it ends with the scorer in the end zone holding the ball
          const last = play.steps.at(-1);
          assert.equal(last.e.kind, 'td');
          assert.ok(play.steps.some((x) => x.e.kind === 'move' && x.e.pid === end.pid), 'the scorer moves in the replay');
        }
      },
    });
    await g.run();
    assert.deepEqual(problems, [], `seed ${seed}`);
  }
  assert.ok(plays > 20 && tds > 0, `${plays} plays, ${tds} touchdowns checked`);
});
