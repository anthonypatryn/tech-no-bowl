// Techno Bowl rules engine (TECHNO mode: 7-vs-7, no skills, no field goals).
//
// The engine owns the whole game and runs it as async code. Whenever a coach must decide something it calls
// `ask(side, request)`: a computer coach answers through its agent function, a person through the UI
// (`game.answer(value)`). Every answer is checked; nothing the UI sends can break the rules. The UI only renders
// `game.state` and the open request, and animates from the log (each entry carries data: ids, squares, dice).
// Same shape as Long Shot's engine, so online play (host-authoritative) plugs in the same way later.
import {
  START_LINE, adjacent, behindLine, halfOf, inOppEndZone, inOwnEndZone, key, lineAfterTackle, losRows, same, skillOf, spotCol, yardLabel,
} from './board.js';
import {
  ballSquare, carrier, checkDefense, checkOffense, checkResult, contactMods, looseAt, moveReach, netModifier, occupant, passInfo,
  playerList, pushOptions, scatterOptions, sqOf, threatCount,
} from './rules.js';
import { autoDefense, autoOffense } from './formations.js';

export class PlayEnd extends Error {
  constructor(reason, info = {}) { super(reason); this.reason = reason; this.info = info; }
}
class GameOver extends Error {}

export function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MODES = { techno: { pro: false, skills: false, fieldGoals: false } };
export const HALF_CUBES = 6;
const MAX_ACTIVATIONS = 400; // per down: a safety net, never reached in a real game

export class Game {
  // teams: [{ id, name, uniform, roster: [{ num, name }] }, …] (side 0 attacks row 0, side 1 attacks row 23)
  // agents: [fn | null, fn | null]: a computer coach is fn(game, side, request) -> answer; null = a person
  // pacing (UI only): pace(logEntry) -> ms that entry needs on screen; delay(ms) -> Promise. The next decision waits for
  // the time owed, so moves animate and dice can be read. The simulator passes neither and runs flat out.
  // replay: a saved trail of a person's answers to feed back instantly (resume / undo); the engine is deterministic,
  // so the same seed + the same answers rebuild the same game.
  constructor({ teams, seed = Date.now(), mode = 'techno', agents = [null, null], replay = null }, { onChange, pace, delay } = {}) {
    this.replayQueue = replay ? [...replay] : [];
    this.rewinding = this.replayQueue.length > 0;
    this.pace = pace;
    this.delay = delay;
    this.owed = 0;
    this.setup = { teams, seed, mode };
    this.rules = MODES[mode];
    this.random = mulberry32(seed);
    this.agents = agents;
    this.onChange = onChange ?? (() => {});
    this.trail = [];
    this.pending = null;
    this.stopped = false;
    this.logNo = 0;
    this.reqNo = 0;
    this.stats = { downs: 0, activations: 0, checks: 0, botFixes: 0, fixedBy: {}, stalls: 0 };
    const players = {};
    teams.forEach((t, side) => {
      for (const r of t.roster) {
        if (!this.rules.pro && r.num === 51) continue;
        const pid = `${side}:${r.num}`;
        // artNum: whose cube art he wears (an alternate player can take another's slot, e.g. Reapers #4 in #44's)
        players[pid] = { pid, side, num: r.num, artNum: r.artNum ?? r.num, name: r.name, skill: skillOf(r.num), abilities: r.abilities ?? [], col: null, row: null, down: false };
      }
    });
    this.s = {
      teams: teams.map((t, side) => ({ id: t.id, name: t.name, uniform: t.uniform, dir: side === 0 ? -1 : 1 })),
      players,
      ball: { at: 'dead' },
      cards: [0, 1].map(() => ({ bench: [], stack: [], discard: [] })), // dealt at the start of every down
      score: [0, 0],
      timeouts: [2, 2],
      half: 1,
      pile: [],
      overtime: false,
      offense: 0,
      line: START_LINE['-1'],
      spot: 6,
      down: 1,
      phase: 'setup',
      play: null,
      faceUp: [null, null],
      active: null,
      request: null,
      log: [],
      winner: null,
      // box score for the TV overlays: per player, and the drive in progress / finished drives
      box: {},
      drive: null,
      drives: [],
    };
  }

  // ---------- plumbing ----------
  get state() { return this.s; }
  emit() { this.onChange(this.s); }
  log(text, kind = 'info', data = {}) {
    const entry = { ...data, text, kind, id: ++this.logNo };
    this.s.log = [...this.s.log.slice(-299), entry];
    if (this.pace) this.owed += this.pace(entry) ?? 0;
    this.emit();
  }
  rand(n) { return Math.floor(this.random() * n); }
  d6() { return 1 + this.rand(6); }
  roster(side, players = this.s.players) { return Object.values(players).filter((p) => p.side === side); }
  team(side) { return this.s.teams[side]; }
  dir(side) { return this.s.teams[side].dir; }
  name(p) { return `${this.team(p.side).name} #${p.num}`; }
  get defense() { return 1 - this.s.offense; }
  // stat(pid, 'rushYds', 5): the box score the broadcast overlays read
  stat(pid, key, n = 1) {
    const b = (this.s.box[pid] ??= { carries: 0, rushYds: 0, att: 0, comp: 0, passYds: 0, rec: 0, recYds: 0, tackles: 0, sacks: 0, fumbles: 0, tds: 0 });
    b[key] += n;
  }

  ask(side, req) {
    if (this.stopped) return new Promise(() => {});
    const wait = this.rewinding ? 0 : this.owed;
    this.owed = 0;
    const ready = wait && this.delay ? this.delay(wait) : Promise.resolve();
    return ready.then(() => new Promise((resolve) => {
      if (this.stopped) return;
      const id = ++this.reqNo;
      this.s.request = { ...req, side, id };
      this.emit();
      this.pending = (v) => {
        this.pending = null; this.s.request = null;
        if (!this.agents[side]) this.trail.push({ req: id, side, type: req.type, value: v, logAt: this.logNo });
        resolve(v);
      };
      // replaying a saved game: a person's answers come straight from the trail until it runs out
      if (this.rewinding && !this.agents[side]) {
        const next = this.replayQueue.shift();
        if (next && next.type === req.type) { queueMicrotask(() => this.pending?.(next.value)); if (!this.replayQueue.length) this.rewinding = false; return; }
        this.replayQueue = []; this.rewinding = false; // out of step (shouldn't happen): just ask
        this.emit();
      }
      const agent = this.agents[side];
      if (agent) Promise.resolve(agent(this, side, this.s.request)).then((v) => { if (this.s.request?.id === id) this.pending?.(v); });
    }));
  }
  answer(value, reqId) { if (reqId == null || reqId === this.s.request?.id) this.pending?.(value); }

  // ask until the answer passes `check` (returns an error string or null). A computer coach gets one retry and then the
  // fallback, so a bot bug shows up in the stats instead of freezing the game.
  async askValid(side, req, check, fallback) {
    for (let i = 0; i < 3; i++) {
      const v = await this.ask(side, i ? { ...req, error: this._lastErr } : req);
      const err = check(v);
      if (!err) return v;
      this._lastErr = err;
      if (this.agents[side] && i >= 1) break;
    }
    this.stats.botFixes++;
    this.stats.fixedBy[req.type] = (this.stats.fixedBy[req.type] ?? 0) + 1;
    if (this.debug) console.warn('fallback for', req.type, this._lastErr);
    return fallback();
  }

  // ---------- the game ----------
  async run() {
    try {
      const winner = this.rand(2);
      // the flip itself (the UI shows a coin): heads = side 0 wins
      this.log(`Coin toss: ${winner === 0 ? 'heads' : 'tails'}.`, 'cointoss', { winner, face: winner === 0 ? 'heads' : 'tails' });
      const choice = await this.askValid(winner, { type: 'toss' }, (v) => (v === 'offense' || v === 'defense' ? null : 'offense or defense'), () => 'offense');
      const first = choice === 'offense' ? winner : 1 - winner;
      this.log(`${this.team(winner).name} win the toss and take the ${choice === 'offense' ? 'ball' : 'defense'}.`, 'toss', { side: winner, choice });
      this.s.firstOffense = first;
      for (const half of [1, 2]) {
        this.s.half = half;
        this.s.pile = Array(HALF_CUBES).fill('y');
        this.startDrive(half === 1 ? first : 1 - first);
        this.log(half === 1 ? 'Kick-off! (There are no kicks in Techno Bowl: the first drive starts at the 20.)' : 'Second half.', 'half', { half });
        while (this.s.pile.length) await this.playDown();
        if (this.s.drive?.open) this.endDrive(half === 1 ? 'HALF TIME' : 'END OF GAME');
      }
      if (this.s.score[0] === this.s.score[1]) {
        this.s.overtime = true;
        const w = this.rand(2);
        this.log(`Overtime coin toss: ${w === 0 ? 'heads' : 'tails'}.`, 'cointoss', { winner: w, face: w === 0 ? 'heads' : 'tails', overtime: true });
        this.log(`Tied at ${this.s.score[0]}! Overtime: ${this.team(w).name} win the coin flip. First score wins.`, 'half', { half: 3 });
        this.startDrive(w);
        for (let n = 0; this.s.score[0] === this.s.score[1]; n++) {
          if (n > 200) { this.stats.stalls++; break; }
          await this.playDown();
        }
      }
      throw new GameOver();
    } catch (e) {
      if (!(e instanceof GameOver)) throw e;
      const [a, b] = this.s.score;
      this.s.winner = a === b ? null : a > b ? 0 : 1;
      this.s.phase = 'over';
      this.log(this.s.winner == null ? `Final: ${a}-${b}.` : `Final: ${this.team(this.s.winner).name} win ${Math.max(a, b)}-${Math.min(a, b)}!`, 'final', { score: [a, b] });
      return this.s;
    }
  }

  startDrive(side) {
    this.beginDrive(side);
    this.s.offense = side;
    this.s.line = START_LINE[String(this.dir(side))];
    this.s.spot = 6;
    this.s.down = 1;
  }

  beginDrive(side, line = START_LINE[String(this.dir(side))]) {
    const s = this.s;
    if (s.drive && s.drive.side === side && s.drive.open) return;
    if (s.drive?.open) this.endDrive(s.drive.result ?? 'turnover');
    s.drive = { side, startLine: line, plays: 0, open: true, result: null };
  }
  // possession changed hands without a score: close the old drive, open one from where the ball is
  changeDrive(result) {
    if (this.s.drive?.open) this.endDrive(result);
    this.beginDrive(this.s.offense, this.s.line);
  }
  endDrive(result) {
    const s = this.s, d = s.drive;
    if (!d?.open) return;
    d.open = false; d.result = result;
    const end = result === 'TOUCHDOWN' ? (this.dir(d.side) < 0 ? 2 : 22) : s.line; // a touchdown drive goes to the goal line
    d.yards = Math.max(0, (end - d.startLine) * this.dir(d.side) * 5);
    s.drives = [...s.drives, { ...d }];
    this.log(`Drive: ${d.plays} play${d.plays === 1 ? '' : 's'}, ${d.yards} yds, ${result}.`, 'drive', { drive: { ...d } });
  }

  // one down: formations, play calls, motion, snap, the play
  async playDown() {
    const s = this.s;
    this.stats.downs++;
    if (s.drive?.side === s.offense) s.drive.plays++;
    s.play = { startOffense: s.offense, line: s.line, forwardDone: false, crossed: false, passThrown: false, adjustUsed: [false, false], activations: 0 };
    for (const p of playerList(s)) { p.col = null; p.row = null; p.down = false; }
    s.ball = { at: 'dead' };
    // every down starts with both of each player's cards back on the bench
    s.cards.forEach((c, side) => { c.bench = this.roster(side).flatMap((p) => [p.num, p.num]).sort((a, b) => a - b); c.stack = []; c.discard = []; });
    this.log(`${['', '1st', '2nd', '3rd', '4th'][s.down]} down, ${this.team(s.offense).name} ball at the ${yardLabel(s.line, this.dir(s.offense))}.`, 'down',
      { down: s.down, line: s.line, offense: s.offense });

    s.phase = 'formation';
    await this.formation(s.offense, 'offense');
    await this.formation(this.defense, 'defense');
    s.phase = 'call';
    await this.callPlays();
    s.phase = 'motion';
    for (const [side, cost] of [[s.offense, 1], [this.defense, 1], [s.offense, 2], [this.defense, 2]]) await this.motion(side, cost);
    if (!s.overtime) {
      await this.timeouts();
      s.play.cube = s.pile.shift();
    }
    this.snap();
    s.phase = 'play';
    let end;
    try {
      await this.runPlay();
    } catch (e) {
      if (!(e instanceof PlayEnd)) throw e;
      end = e;
    }
    s.phase = 'dead';
    s.active = null;
    s.faceUp = [null, null];
    await this.endPlay(end);
  }

  // ---------- setup ----------
  formationCtx() {
    const s = this.s;
    return { line: s.line, dir: this.dir(s.offense), col: s.spot, count: this.roster(0).length };
  }
  async formation(side, role) {
    const s = this.s;
    const ctx = this.formationCtx();
    const roster = this.roster(side).map((p) => ({ num: p.num, skill: p.skill }));
    const offense = role === 'defense' ? this.roster(s.offense).map((p) => ({ num: p.num, col: p.col, row: p.row })) : null;
    const nums = new Set(roster.map((p) => p.num));
    const check = (v) => {
      if (!Array.isArray(v) || v.length !== roster.length || new Set(v.map((p) => p.num)).size !== v.length || v.some((p) => !nums.has(p.num))) return 'place every player once';
      const r = role === 'offense' ? checkOffense(v, ctx) : checkDefense(v, offense, ctx);
      return r.ok ? null : r.errors.join('; ');
    };
    const auto = () => (role === 'offense' ? autoOffense(roster, ctx, this.random) : autoDefense(roster, offense, ctx, this.random));
    const spots = await this.askValid(side, { type: 'formation', role, ...ctx, roster, offense }, check, auto);
    for (const sp of spots) Object.assign(s.players[`${side}:${sp.num}`], { col: sp.col, row: sp.row });
    this.log(`${this.team(side).name} line up on ${role}.`, 'formation', { side, role, spots });
  }

  async callPlays() {
    const s = this.s;
    for (const side of [s.offense, this.defense]) {
      const bench = s.cards[side].bench;
      const check = (v) => (Array.isArray(v) && v.length === Math.min(5, bench.length) && fromBench(bench, v) ? null : 'pick 5 cards from your bench');
      const fallback = () => this.shuffle(bench).slice(0, 5);
      const call = await this.askValid(side, { type: 'call', bench: [...bench], count: Math.min(5, bench.length) }, check, fallback);
      s.cards[side].bench = takeFromBench(bench, call);
      s.cards[side].stack = [...call];
    }
    this.log('Both coaches have called their plays.', 'call');
  }

  async motion(side, cost) {
    const s = this.s;
    const bench = s.cards[side].bench;
    if (bench.length < cost) return;
    const role = side === s.offense ? 'offense' : 'defense';
    const { off, def } = losRows(s.line, this.dir(s.offense));
    const losRow = role === 'offense' ? off : def;
    const movers = this.roster(side).filter((p) => p.row !== losRow);
    const ctx = this.formationCtx();
    // a motion must leave a legal formation (the offense still needs its hike receiver); defenders stay on their side
    const legal = (pid, to) => {
      const spots = this.roster(side).map((p) => ({ num: p.num, col: p.pid === pid ? to[0] : p.col, row: p.pid === pid ? to[1] : p.row }));
      if (role === 'offense') return checkOffense(spots, ctx).ok;
      return spots.every((p) => (p.row - def) * this.dir(s.offense) >= 0);
    };
    const options = movers
      .map((p) => ({ pid: p.pid, reach: [...moveReach(s, p, p.skill, 0, { stopRows: [losRow] }).values()].map((m) => m.to).filter((to) => legal(p.pid, to)) }))
      .filter((o) => o.reach.length);
    if (!options.length) return;
    const check = (v) => {
      if (v == null) return null;
      const o = options.find((x) => x.pid === v.pid);
      if (!o || !o.reach.some((q) => same(q, v.to))) return 'that player cannot motion there';
      if (!Array.isArray(v.discard) || v.discard.length !== cost || !fromBench(bench, v.discard)) return `discard ${cost} bench card(s)`;
      return null;
    };
    const v = await this.askValid(side, { type: 'motion', cost, options, bench: [...bench] }, check, () => null);
    if (!v) return;
    s.cards[side].bench = takeFromBench(bench, v.discard);
    s.cards[side].discard.push(...v.discard);
    const p = s.players[v.pid];
    const from = sqOf(p);
    p.col = v.to[0]; p.row = v.to[1];
    this.log(`${this.name(p)} goes in motion.`, 'motion', { pid: p.pid, from, to: v.to, cost });
  }

  async timeouts() {
    const s = this.s;
    if (s.pile.length !== 1) return; // the last minute: a timeout buys one more play
    for (const side of [s.offense, this.defense]) {
      if (!s.timeouts[side]) continue;
      const v = await this.askValid(side, { type: 'timeout', left: s.timeouts[side], score: s.score }, (x) => (typeof x === 'boolean' ? null : 'yes or no'), () => false);
      if (v) {
        s.timeouts[side]--;
        s.pile.push('r');
        this.log(`Timeout, ${this.team(side).name}.`, 'timeout', { side });
      }
    }
  }

  snap() {
    const s = this.s;
    const { off, back } = losRows(s.line, this.dir(s.offense));
    const hiker = occupant(s, s.spot, off);
    let receiver = null;
    for (let i = 1; i <= hiker.skill && !receiver; i++) {
      const p = occupant(s, s.spot, off + back * i);
      if (p) receiver = p;
    }
    s.ball = { at: 'held', pid: receiver.pid };
    this.log(`Hut-hut! ${this.name(hiker)} snaps it to ${this.name(receiver)}.`, 'snap', { from: hiker.pid, to: receiver.pid });
  }

  // ---------- the play: cards ----------
  async runPlay() {
    const s = this.s;
    for (;;) {
      while (s.cards[0].stack.length || s.cards[1].stack.length) {
        await this.round(s.cards[0].stack.shift(), s.cards[1].stack.shift());
      }
      // the called play is run: now one card at a time from the bench
      for (;;) {
        const b0 = s.cards[0].bench.length, b1 = s.cards[1].bench.length;
        if (!b0 && !b1) break;
        if (!b0 || !b1) {
          // one coach is out of players: the other runs the rest of his bench, one at a time, in any order
          const side = b0 ? 0 : 1;
          while (s.cards[side].bench.length) {
            const num = await this.pickCard(side, 'flatfooted');
            s.faceUp[side] = num;
            await this.activateCard(side, num, false);
            s.cards[side].discard.push(num);
            s.faceUp[side] = null;
          }
          continue;
        }
        const n0 = await this.pickCard(0, 'next'), n1 = await this.pickCard(1, 'next');
        await this.round(n0, n1);
      }
      if (s.ball.at === 'air') throw new PlayEnd('incomplete', { why: 'nobody caught it' });
      // a whole cycle of cards where nobody moved, hit anyone or touched the ball: the officials blow it dead
      const busy = s.log.some((e) => e.id > (s.play.cycleMark ?? 0) && ['move', 'push', 'check', 'handoff', 'sport', 'stand'].includes(e.kind));
      s.play.cycleMark = this.logNo;
      if (!busy) {
        this.log('Nobody is going anywhere: the officials blow the play dead.', 'deadball');
        const c = carrier(s);
        if (c) this.endWithBall(c, 'tackle');
        throw new PlayEnd('stall');
      }
      // everybody has gone and the ball is still alive: coaches take control again with fresh 5-card plays
      for (const c of s.cards) { c.bench = [...c.bench, ...c.discard].sort((a, b) => a - b); c.discard = []; }
      if (!s.cards[0].bench.length && !s.cards[1].bench.length) { this.stats.stalls++; throw new PlayEnd('stall'); }
      this.log('Every player has gone and the play is still alive: both coaches call new plays.', 'recall');
      await this.callPlays();
    }
  }

  async pickCard(side, why) {
    const bench = this.s.cards[side].bench;
    const num = await this.askValid(side, { type: 'pick', why, bench: [...bench] }, (v) => (bench.includes(v) ? null : 'pick a card from your bench'), () => bench[this.rand(bench.length)]);
    bench.splice(bench.indexOf(num), 1);
    return num;
  }

  // both coaches have a card face up: read-and-react, who goes first, then each activates
  async round(c0, c1) {
    const s = this.s;
    const up = [c0, c1];
    const rr = [false, false];
    if (up[0] == null || up[1] == null) {
      // can't happen with equal stacks; keep going with whoever has a card
      for (const side of [0, 1]) if (up[side] != null) { s.faceUp[side] = up[side]; await this.activateCard(side, up[side], false); s.cards[side].discard.push(up[side]); }
      s.faceUp = [null, null];
      return;
    }
    s.faceUp = [...up];
    this.log(`Cards up: #${up[0]} and #${up[1]}.`, 'flip', { cards: [...up] });
    // read-and-react: the defense may swap its card for one off the bench; then (only then) the offense may too
    for (const side of [this.defense, s.offense]) {
      if (side === s.offense && !rr[this.defense]) break;
      const bench = s.cards[side].bench;
      if (!bench.length) continue;
      const v = await this.askValid(side, { type: 'readReact', card: up[side], other: up[1 - side], bench: [...bench] },
        (x) => (x == null || bench.includes(x) ? null : 'pick a bench card or pass'), () => null);
      if (v == null) continue;
      bench.splice(bench.indexOf(v), 1);
      s.cards[side].discard.push(up[side]);
      this.log(`${this.team(side).name} read and react: #${up[side]} out, #${v} in.`, 'readReact', { side, out: up[side], in: v });
      up[side] = v; rr[side] = true; s.faceUp = [...up];
    }
    // the higher skill rating decides who goes first; ties roll a die each; tie again: the offense decides
    const k0 = skillOf(up[0]), k1 = skillOf(up[1]);
    let decider;
    if (k0 !== k1) decider = k0 > k1 ? 0 : 1;
    else {
      const r = [this.d6(), this.d6()];
      decider = r[0] === r[1] ? s.offense : r[0] > r[1] ? 0 : 1;
      this.log(`Same rating: dice ${r[0]} - ${r[1]}.`, 'dice', { dice: r, purpose: 'order' });
    }
    const who = await this.askValid(decider, { type: 'first', cards: [...up] }, (v) => (v === 'me' || v === 'them' ? null : 'me or them'), () => 'me');
    const first = who === 'me' ? decider : 1 - decider;
    for (const side of [first, 1 - first]) {
      await this.activateCard(side, up[side], rr[side]);
      s.cards[side].discard.push(up[side]);
      s.faceUp[side] = null;
    }
  }

  async activateCard(side, num, rr) {
    await this.runActivation(`${side}:${num}`, rr ? 'rr' : 'card');
  }

  // ---------- activations ----------
  // modes: card (from a play card), rr (read-and-react), full (a free activation from a 10+), half (a 7-9 for the
  // other side), adjust (one half of an adjustment)
  async runActivation(pid, mode) {
    const s = this.s;
    const p = s.players[pid];
    if (++s.play.activations > MAX_ACTIVATIONS) { this.stats.stalls++; throw new PlayEnd('stall'); }
    this.stats.activations++;
    const ctx = { pid, mode, budget: mode === 'half' || mode === 'adjust' ? halfOf(p.skill) : p.skill, spent: 0, parity: 0, acted: false, done: false, bonuses: [], fresh: true, left: false, pressured: false };
    const prev = s.active;
    s.active = { pid, mode };
    this.log(`${this.name(p)} ${mode === 'half' ? 'gets a half move' : mode === 'full' ? 'gets a free activation' : mode === 'adjust' ? 'adjusts' : 'is up'}.`, 'activate', { pid, mode });
    try {
      while (!ctx.done) {
        const req = this.actRequest(p, ctx);
        if (!req.moves.length && !req.handoffs.length && !req.blocks.length && !req.tackles.length && !req.passes.length && !req.canStand && !req.canAdjust) break;
        const a = await this.askValid(p.side, req, (v) => this.checkAct(req, v), () => ({ kind: 'end' }));
        await this.doAct(p, ctx, a);
        ctx.fresh = false;
      }
    } finally {
      s.active = prev;
    }
    for (const b of ctx.bonuses) await this.bonus(b);
  }

  canAction(p, ctx) {
    if (ctx.acted || p.down) return false;
    if (ctx.mode === 'card' || ctx.mode === 'full') return ctx.spent <= halfOf(p.skill);
    if (ctx.mode === 'rr') return ctx.spent === 0;
    return false;
  }

  actRequest(p, ctx) {
    const s = this.s;
    const left = ctx.budget - ctx.spent;
    const req = { type: 'act', pid: p.pid, mode: ctx.mode, left, spent: ctx.spent, moves: [], handoffs: [], blocks: [], tackles: [], passes: [], canStand: false, canAdjust: false };
    req.canAdjust = ctx.fresh && (ctx.mode === 'card' || ctx.mode === 'rr') && !s.play.adjustUsed[p.side] && carrier(s)?.pid !== p.pid;
    if (p.down) { req.canStand = left >= 3; return req; }
    req.moves = [...moveReach(s, p, left, ctx.parity, { allowOut: true }).values()].map((m) => ({ to: m.to, cost: m.cost, end: m.end }));
    const holder = carrier(s);
    for (const m of this.roster(p.side)) {
      if (m.pid === p.pid || m.down || !adjacent(sqOf(m), sqOf(p))) continue;
      if (holder && (holder.pid === p.pid || holder.pid === m.pid)) req.handoffs.push(m.pid);
    }
    if (this.canAction(p, ctx)) {
      for (const o of this.roster(1 - p.side)) {
        if (o.down || !adjacent(sqOf(o), sqOf(p))) continue;
        req.blocks.push(o.pid);
        if (holder?.pid === o.pid) req.tackles.push(o.pid);
      }
      if (holder?.pid === p.pid) {
        const r = p.skill * 2;
        for (let c = p.col - r; c <= p.col + r; c++) for (let rw = p.row - r; rw <= p.row + r; rw++) {
          if (c < 0 || c > 12 || rw < 0 || rw > 23) continue;
          const info = passInfo(s, p, [c, rw]);
          if (info.ok) req.passes.push({ to: [c, rw], target: info.target?.pid ?? null, dist: info.dist, bonus: info.bonus, penalty: Math.min(3, info.penalty) });
        }
      }
    }
    return req;
  }

  checkAct(req, v) {
    if (!v || typeof v !== 'object') return 'choose an action';
    switch (v.kind) {
      case 'end': return null;
      case 'stand': return req.canStand ? null : 'cannot stand up now';
      case 'adjust': return req.canAdjust ? null : 'no adjustment available';
      case 'move': return req.moves.some((m) => same(m.to, v.to)) ? null : 'cannot reach that square';
      case 'handoff': return req.handoffs.includes(v.pid) ? null : 'no hand-off with that player';
      case 'block': return req.blocks.includes(v.pid) ? null : 'cannot block that player';
      case 'tackle': return req.tackles.includes(v.pid) ? null : 'cannot tackle that player';
      case 'pass': return req.passes.some((x) => same(x.to, v.to)) ? null : 'cannot pass there';
      default: return 'unknown action';
    }
  }

  async doAct(p, ctx, a) {
    const s = this.s;
    switch (a.kind) {
      case 'end': ctx.done = true; return;
      case 'stand':
        p.down = false; ctx.spent += 3;
        this.log(`${this.name(p)} gets up.`, 'stand', { pid: p.pid });
        return;
      case 'adjust': ctx.done = true; await this.adjustment(p); return;
      case 'move': {
        const m = moveReach(s, p, ctx.budget - ctx.spent, ctx.parity, { allowOut: true }).get(key(...a.to));
        ctx.spent += m.cost; ctx.parity = m.parity;
        await this.walk(p, m.path, ctx);
        if (m.end === 'ball') await this.grab(p, ctx);
        return;
      }
      case 'handoff': await this.handoff(p, s.players[a.pid], ctx); return;
      case 'block': ctx.acted = true; ctx.done = true; await this.block(p, s.players[a.pid], ctx); return;
      case 'tackle': ctx.acted = true; ctx.done = true; await this.tackle(p, s.players[a.pid], ctx); return;
      case 'pass': ctx.acted = true; ctx.done = true; await this.pass(p, a.to, ctx); return;
    }
  }

  // step along a path square by square: touchdowns, stepping out, crossing the line, defensive pressure
  async walk(p, path, ctx) {
    const from = sqOf(p);
    for (const q of path) {
      const prev = sqOf(p);
      if (q[0] < 0 || q[0] > 12 || q[1] < 0 || q[1] > 23) {
        this.log(`${this.name(p)} steps out of bounds.`, 'move', { pid: p.pid, from, to: prev, path });
        this.endWithBall(p, 'out');
      }
      p.col = q[0]; p.row = q[1];
      try {
        this.pressure(p, prev, ctx);
      } catch (e) {
        // a sack mid-run ends the play here: log the steps taken so far (the board and replays need them)
        const done = path.slice(0, path.indexOf(q) + 1);
        this.log(`${this.name(p)} moves.`, 'move', { pid: p.pid, from, to: sqOf(p), path: done });
        throw e;
      }
    }
    if (this.s.ball.at === 'held' && this.s.ball.pid === p.pid) {
      if (!this.s.play.carried?.includes(p.pid)) { this.stat(p.pid, 'carries'); (this.s.play.carried ??= []).push(p.pid); }
      this.stat(p.pid, 'rushYds', (p.row - from[1]) * this.dir(p.side) * 5);
    }
    this.log(`${this.name(p)} moves.`, 'move', { pid: p.pid, from, to: sqOf(p), path });
    this.ballMoved();
    this.checkTouchdown(p);
  }

  // a defender moving into the ball carrier's threat zone behind the line: two random bench cards, or a sack
  pressure(p, prev, ctx) {
    const s = this.s;
    const c = carrier(s);
    if (!c || c.down || c.side === p.side || p.side !== this.defense || !ctx) return;
    const was = adjacent(prev, sqOf(c)), now = adjacent(sqOf(p), sqOf(c));
    if (was && !now) ctx.left = true;
    if (!now || was || ctx.left || ctx.pressured) return;
    if (!behindLine(c.row, s.play.line, this.dir(c.side))) return;
    ctx.pressured = true;
    const bench = s.cards[c.side].bench;
    if (bench.length < 2) {
      this.stat(p.pid, 'sacks');
      this.log(`Pressure! ${this.name(c)} has nowhere to go: SACKED.`, 'sack', { pid: c.pid, by: p.pid });
      this.endWithBall(c, 'tackle');
    }
    const lost = [];
    for (let i = 0; i < 2; i++) lost.push(bench.splice(this.rand(bench.length), 1)[0]);
    s.cards[c.side].discard.push(...lost);
    this.log(`Defensive pressure! ${this.team(c.side).name} lose two bench cards.`, 'pressure', { side: c.side, cards: lost, by: p.pid });
  }

  ballMoved() {
    const s = this.s;
    const sq = ballSquare(s);
    if (sq && !s.play.crossed && !behindLine(sq[1], s.play.line, this.dir(s.play.startOffense))) s.play.crossed = true;
    if (s.play.crossed) s.play.forwardDone = true;
  }

  // the ball carrier's play ends where he stands (tackle, sack, out of bounds): a safety in his own end zone
  endWithBall(p, reason) {
    const at = sqOf(p);
    if (inOwnEndZone(this.dir(p.side), p.row)) throw new PlayEnd('safety', { side: 1 - p.side, pid: p.pid, at });
    throw new PlayEnd(reason, { pid: p.pid, side: p.side, at });
  }

  async bonus(b) {
    const options = this.roster(b.side).filter((p) => p.pid !== b.exclude).map((p) => p.pid);
    const v = await this.askValid(b.side, { type: 'bonus', kind: b.kind, options }, (x) => (x == null || options.includes(x) ? null : 'pick one of your players or pass'), () => null);
    if (v != null) await this.runActivation(v, b.kind);
  }

  async adjustment(p) {
    const s = this.s;
    s.play.adjustUsed[p.side] = true;
    const holder = carrier(s);
    const options = this.roster(p.side).filter((m) => m.pid !== p.pid && m.pid !== holder?.pid).map((m) => m.pid);
    const v = await this.askValid(p.side, { type: 'adjustPartner', pid: p.pid, options },
      (x) => (x && options.includes(x.pid) && (x.first === 'self' || x.first === 'partner') ? null : 'pick a partner'), () => ({ pid: options[0], first: 'self' }));
    this.log(`${this.team(p.side).name} make an adjustment: ${this.name(p)} and ${this.name(s.players[v.pid])}.`, 'adjust', { side: p.side, pids: [p.pid, v.pid] });
    const order = v.first === 'self' ? [p.pid, v.pid] : [v.pid, p.pid];
    for (const pid of order) await this.runActivation(pid, 'adjust');
  }

  // ---------- checks ----------
  async skillCheck(actor, { bonus, penalty, label, data = {} }) {
    const s = this.s;
    this.stats.checks++;
    const bench = s.cards[actor.side].bench;
    const cards = bench.filter((n) => n === actor.num).length;
    const room = Math.max(0, 3 - bonus);
    let boost = 0;
    if (cards && room) {
      const max = Math.min(cards, room);
      boost = await this.askValid(actor.side, { type: 'boost', pid: actor.pid, max, bonus, penalty, label },
        (v) => (Number.isInteger(v) && v >= 0 && v <= max ? null : `0 to ${max}`), () => 0);
      for (let i = 0; i < boost; i++) { bench.splice(bench.indexOf(actor.num), 1); s.cards[actor.side].discard.push(actor.num); }
    }
    const net = netModifier(bonus + boost, penalty);
    const res = checkResult(this.d6(), this.d6(), net);
    const words = { total: 'TOTAL SUCCESS', partial: 'success', fail: 'FAILURE' }[res.result];
    this.log(`${label}: ${res.dice[0]}+${res.dice[1]}${net ? ` ${net > 0 ? '+' : ''}${net}` : ''} = ${res.total}, ${res.crit ? 'CRITICAL ' : ''}${words}.`, 'check',
      { pid: actor.pid, label, ...res, boost, bonus, penalty, ...data });
    return res;
  }

  // what a check result hands out once the activation is over
  afterCheck(ctx, actor, res) {
    if (res.result === 'total') ctx.bonuses.push({ side: actor.side, kind: 'full', exclude: actor.pid });
    else if (res.result === 'partial') ctx.bonuses.push({ side: 1 - actor.side, kind: 'half' });
    else { ctx.bonuses.push({ side: 1 - actor.side, kind: 'full' }); ctx.done = true; }
  }

  sportCheck(p, label) {
    const d = [this.d6(), this.d6()];
    const ok = d[0] !== d[1];
    this.log(`${label}: ${d[0]} and ${d[1]}, ${ok ? 'got it' : 'DOUBLES, it gets away'}.`, 'sport', { pid: p.pid, dice: d, ok, label });
    return ok;
  }

  // ---------- actions ----------
  async block(actor, target, ctx) {
    const s = this.s;
    const m = contactMods(s, actor, target);
    const res = await this.skillCheck(actor, { bonus: m.bonus, penalty: m.penalty, label: `${this.name(actor)} blocks ${this.name(target)}`, data: { action: 'block', target: target.pid } });
    if (res.success) {
      await this.push(actor.side, actor, target, res.crit);
    } else {
      // the target may turn it round on the initiator (p.6). On a critical failure the initiator "may be pushed back AND
      // is knocked down": the push is the target's choice, the knockdown isn't.
      const reverse = await this.askValid(target.side, { type: 'reverse', pid: target.pid, against: actor.pid, crit: res.crit }, (v) => (typeof v === 'boolean' ? null : 'yes or no'), () => true);
      if (reverse) await this.push(target.side, target, actor, res.crit);
      else if (res.crit) {
        this.log(`${this.name(actor)} goes down in a heap!`, 'knockdown', { pid: actor.pid });
        await this.knockDown(actor);
      }
    }
    this.afterCheck(ctx, actor, res);
  }

  // `by` pushes `victim` one square away (chooser picks the square), with an optional follow-up into the gap.
  // No open square: knocked down where he stands. knock = also knocked down (critical).
  async push(chooser, by, victim, knock) {
    const s = this.s;
    const opts = pushOptions(s, sqOf(by), sqOf(victim));
    const from = sqOf(victim);
    if (!opts.length) {
      this.log(`${this.name(victim)} has nowhere to go and is knocked down!`, 'knockdown', { pid: victim.pid });
      await this.knockDown(victim);
      return;
    }
    const to = opts.length === 1 ? opts[0] : await this.askValid(chooser, { type: 'push', pid: victim.pid, options: opts }, (v) => (opts.some((q) => same(q, v)) ? null : 'pick a push square'), () => opts[0]);
    victim.col = to[0]; victim.row = to[1];
    this.log(`${this.name(victim)} is driven back${knock ? ' and FLATTENED' : ''}.`, 'push', { pid: victim.pid, from, to, by: by.pid });
    if (looseAt(s, ...to)) await this.scatter(to, s.ball.at === 'air', 'the ball bounces off him');
    this.ballMoved();
    this.checkTouchdown(victim);
    const follow = await this.askValid(chooser, { type: 'followUp', pid: by.pid, to: from }, (v) => (typeof v === 'boolean' ? null : 'yes or no'), () => true);
    if (follow) {
      const prev = sqOf(by);
      by.col = from[0]; by.row = from[1];
      this.log(`${this.name(by)} follows up.`, 'move', { pid: by.pid, from: prev, to: from, path: [from], followUp: true });
      this.pressure(by, prev, { left: false, pressured: false });
      this.ballMoved();
      this.checkTouchdown(by);
    }
    if (knock) await this.knockDown(victim);
  }

  // knocked down by anything but a tackle: a ball carrier fumbles
  async knockDown(p) {
    const s = this.s;
    p.down = true;
    if (carrier(s)?.pid === p.pid) {
      this.stat(p.pid, 'fumbles');
      this.log(`${this.name(p)} FUMBLES!`, 'fumble', { pid: p.pid });
      await this.scatter(sqOf(p), false, 'fumble');
    }
  }

  async tackle(actor, target, ctx) {
    const s = this.s;
    const m = contactMods(s, actor, target);
    const res = await this.skillCheck(actor, { bonus: m.bonus, penalty: m.penalty, label: `${this.name(actor)} tackles ${this.name(target)}`, data: { action: 'tackle', target: target.pid } });
    if (res.success) {
      target.down = true;
      if (!res.crit) {
        this.stat(actor.pid, 'tackles');
        this.log(`${this.name(target)} is brought down.`, 'tackle', { pid: target.pid, by: actor.pid, at: sqOf(target) });
        this.endWithBall(target, 'tackle');
      }
      this.log(`BOOM! ${this.name(target)} is hit so hard the ball comes loose!`, 'fumble', { pid: target.pid, by: actor.pid, crit: true });
      await this.scatter(sqOf(target), false, 'fumble');
    } else if (res.crit) {
      actor.down = true;
      this.log(`${this.name(actor)} whiffs and hits the turf.`, 'knockdown', { pid: actor.pid });
    }
    this.afterCheck(ctx, actor, res);
  }

  async pass(passer, to, ctx) {
    const s = this.s;
    const info = passInfo(s, passer, to);
    s.play.passThrown = true;
    this.stat(passer.pid, 'att');
    if (info.forward) s.play.forwardDone = true;
    const res = await this.skillCheck(passer, { bonus: info.bonus, penalty: Math.min(3, info.penalty), label: `${this.name(passer)} throws ${info.dist}`, data: { action: 'pass', from: sqOf(passer), to, target: info.target?.pid ?? null, dist: info.dist } });
    if (res.success) {
      if (info.target) {
        const yds = (to[1] - passer.row) * this.dir(passer.side) * 5;
        this.stat(passer.pid, 'comp'); this.stat(passer.pid, 'passYds', yds);
        this.stat(info.target.pid, 'rec'); this.stat(info.target.pid, 'recYds', yds);
        this.log(`Caught by ${this.name(info.target)}!`, 'catch', { pid: info.target.pid, from: passer.pid, to, yds });
        this.gain(info.target);
      } else {
        s.ball = { at: 'air', col: to[0], row: to[1] };
        this.log('The ball hangs in the air over the target square.', 'inflight', { from: passer.pid, to });
        this.ballMoved();
      }
    } else {
      s.ball = { at: 'air', col: to[0], row: to[1] };
      this.log('Off target!', 'offtarget', { from: passer.pid, to });
      await this.scatter(to, true, 'pass');
    }
    this.afterCheck(ctx, passer, res);
  }

  async handoff(p, mate, ctx) {
    const s = this.s;
    const giver = carrier(s).pid === p.pid ? p : mate;
    const taker = giver === p ? mate : p;
    const pressured = threatCount(s, sqOf(giver), 1 - p.side) || threatCount(s, sqOf(taker), 1 - p.side);
    if (pressured && !this.sportCheck(giver, `Hand-off ${this.name(giver)} to ${this.name(taker)} under pressure`)) {
      ctx.done = true;
      await this.scatter(sqOf(giver), false, 'botched hand-off');
      return;
    }
    s.ball = { at: 'held', pid: taker.pid };
    this.log(`${this.name(giver)} hands off to ${this.name(taker)}.`, 'handoff', { from: giver.pid, to: taker.pid });
    this.ballMoved();
    this.checkTouchdown(taker);
  }

  // moving into a loose ball's square: a sport check to scoop it up / pull it in
  async grab(p, ctx) {
    const s = this.s;
    const air = s.ball.at === 'air';
    if (this.sportCheck(p, `${this.name(p)} goes for the ${air ? 'ball in the air' : 'loose ball'}`)) {
      this.gain(p);
    } else {
      ctx.done = true;
      await this.scatter(sqOf(p), air, 'bobbled');
    }
  }

  // p now has the ball: a turnover if he's on the other side, a touchdown if he's in the end zone
  gain(p) {
    const s = this.s;
    s.ball = { at: 'held', pid: p.pid };
    if (p.side !== s.offense) {
      s.offense = p.side;
      s.play.forwardDone = true;
      s.play.turnover = true;
      this.log(`TURNOVER! ${this.team(p.side).name} have the ball.`, 'turnover', { side: p.side, pid: p.pid });
    }
    this.ballMoved();
    this.checkTouchdown(p);
  }

  checkTouchdown(p) {
    const s = this.s;
    if (carrier(s)?.pid === p.pid && !p.down && inOppEndZone(this.dir(p.side), p.row)) throw new PlayEnd('td', { side: p.side, pid: p.pid, at: sqOf(p) });
  }

  // Each coach rolls a die; the difference is how far it goes and the higher die picks the way.
  async scatter(origin, air, cause) {
    const s = this.s;
    let at = origin;
    for (let guard = 0; guard < 12; guard++) {
      s.ball = { at: air ? 'air' : 'ground', col: at[0], row: at[1] };
      const d = [this.d6(), this.d6()];
      const n = Math.abs(d[0] - d[1]);
      const holder = occupant(s, ...at);
      if (!n) {
        this.log(`Scatter dice ${d[0]} - ${d[1]}: a dramatic recovery!`, 'scatter', { dice: d, from: at, to: at, cause });
        if (holder && !holder.down) { this.gain(holder); return; }
        if (holder) { s.ball = { at: 'held', pid: holder.pid }; this.endWithBall(holder, 'tackle'); }
        return;
      }
      const chooser = d[0] > d[1] ? s.offense : this.defense; // die 0 is the offense's
      const opts = scatterOptions(s, at, n, air);
      const pick = opts.length === 1 ? opts[0]
        : await this.askValid(chooser, { type: 'scatter', from: at, n, options: opts }, (v) => (opts.some((o) => same(o.to, v?.to) && !!o.out === !!v?.out) ? null : 'pick a scatter square'), () => opts[0]);
      this.log(`Scatter dice ${d[0]} - ${d[1]}: the ball goes ${n}${pick.out ? ' and OUT of bounds' : ''}.`, 'scatter', { dice: d, n, from: at, to: pick.to, out: !!pick.out, cause });
      if (pick.out) throw new PlayEnd('incomplete', { why: 'out of bounds' });
      at = pick.to;
      const occ = occupant(s, ...at);
      if (!occ) { s.ball = { at: air ? 'air' : 'ground', col: at[0], row: at[1] }; this.ballMoved(); return; }
      if (!occ.down && this.sportCheck(occ, `It comes right to ${this.name(occ)}`)) { this.gain(occ); return; }
      cause = 'deflected';
    }
    // a ball that keeps bouncing off people settles on the nearest open square
    for (let r = 1; r < 5; r++) for (let dc = -r; dc <= r; dc++) for (let dr = -r; dr <= r; dr++) {
      const q = [at[0] + dc, at[1] + dr];
      if (q[0] >= 0 && q[0] <= 12 && q[1] >= 0 && q[1] <= 23 && !occupant(s, ...q)) { s.ball = { at: air ? 'air' : 'ground', col: q[0], row: q[1] }; return; }
    }
  }

  // ---------- after the play ----------
  async endPlay(e) {
    const s = this.s;
    const play = s.play;
    const reason = e?.reason ?? 'incomplete';
    const info = e?.info ?? {};
    // the clock: a running play (no pass, nobody out of bounds) uses a second minute, but never a timeout cube
    if (!s.overtime && !play.passThrown && reason !== 'out' && play.cube === 'y' && s.pile[0] === 'y') s.pile.shift();
    s.ball = { at: 'dead' };
    if (reason === 'td') {
      s.score[info.side] += 7;
      if (info.pid) this.stat(info.pid, 'tds');
      this.log(`TOUCHDOWN ${this.team(info.side).name}! (+7)`, 'td', { side: info.side, pid: info.pid, at: info.at, score: [...s.score] });
      if (s.drive?.side === info.side) this.endDrive('TOUCHDOWN');
      if (s.overtime) throw new GameOver();
      this.startDrive(1 - info.side);
      return;
    }
    if (reason === 'safety') {
      s.score[info.side] += 2;
      this.log(`SAFETY! ${this.team(info.side).name} score 2 and get the ball.`, 'safety', { side: info.side, score: [...s.score] });
      if (s.drive) s.drive.result = 'SAFETY';
      if (s.overtime) throw new GameOver();
      this.startDrive(info.side);
      return;
    }
    const turnedOver = s.offense !== play.startOffense;
    if (reason === 'tackle' || reason === 'out') {
      s.line = lineAfterTackle(info.at[1], this.dir(info.side));
      s.spot = spotCol(info.at[0]);
      this.log(reason === 'out' ? 'Out of bounds.' : 'Down.', 'whistle', { reason, at: info.at, line: s.line });
    } else {
      this.log(reason === 'stall' ? 'The officials blow it dead.' : 'Incomplete!', 'whistle', { reason });
      if (!turnedOver) { s.line = play.line; }
    }
    if (turnedOver) { s.down = 1; this.changeDrive('TURNOVER'); return; }
    if (++s.down > 4) {
      s.offense = 1 - s.offense;
      s.down = 1;
      this.log(`Turnover on downs! ${this.team(s.offense).name} take over.`, 'turnover', { side: s.offense, downs: true });
      this.changeDrive('DOWNS');
    }
  }

  shuffle(a) { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = this.rand(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; }
}

// multiset helpers for cards
export function fromBench(bench, cards) {
  const left = [...bench];
  for (const c of cards) { const i = left.indexOf(c); if (i < 0) return false; left.splice(i, 1); }
  return true;
}
function takeFromBench(bench, cards) {
  const left = [...bench];
  for (const c of cards) left.splice(left.indexOf(c), 1);
  return left;
}
