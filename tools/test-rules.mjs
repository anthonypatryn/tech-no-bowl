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
  assert.deepEqual(m.parts, { skill: 0, teamwork: 1 });
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
