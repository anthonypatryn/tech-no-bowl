// Techno Bowl rules engine: TECHNO (7-vs-7), ALL TECHNO (+ the 25 skills), PRO / ALL PRO (8-vs-8 + field goals) and
// INFERNO (ALL TECHNO + fire tokens, ON FIRE, EN FUEGO, FIRE BOMB, BRING THE HEAT, dirty hits and dogpiles).
//
// The engine owns the whole game and runs it as async code. Whenever a coach must decide something it calls
// `ask(side, request)`: a computer coach answers through its agent function, a person through the UI
// (`game.answer(value)`). Every answer is checked; nothing the UI sends can break the rules. The UI only renders
// `game.state` and the open request, and animates from the log (each entry carries data: ids, squares, dice).
// Same shape as Long Shot's engine, so online play (host-authoritative) plugs in the same way later.
import {
  ROWS, START_LINE, adjacent, behindLine, distance, halfOf, inBounds, inOppEndZone, inOwnEndZone, isForward, key, lineAfterTackle, losRows, same, skillOf,
  spotCol, yardLabel,
} from './board.js';
import {
  SKILLS, ballSquare, carrier, checkDefense, checkOffense, checkResult, contactMods, hasSkill, looseAt, moveReach, netModifier, occupant, occupiedMap,
  passInfo, playerList, pushOptions, scatterOptions, sqOf, threatCount,
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

export const MODES = {
  techno: { pro: false, skills: false, fieldGoals: false, inferno: false },
  alltechno: { pro: false, skills: true, fieldGoals: false, inferno: false },
  pro: { pro: true, skills: false, fieldGoals: true, inferno: false },
  allpro: { pro: true, skills: true, fieldGoals: true, inferno: false },
  inferno: { pro: false, skills: true, fieldGoals: false, inferno: true },
};
const CONTACT = ['block', 'shove', 'juke', 'shake'];
// the questions asked while the ball is dead: a coach may call a timeout from any of them
const DEAD_BALL = ['formation', 'call', 'motion', 'kick', 'onFire'];
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
    this.rules = MODES[mode] ?? MODES.techno;
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
        players[pid] = { pid, side, num: r.num, artNum: r.artNum ?? r.num, name: r.name, skill: skillOf(r.num), abilities: r.abilities ?? [], col: null, row: null, down: false,
          onFire: false, fireSkill: null, fuego: null };
      }
    });
    this.s = {
      teams: teams.map((t, side) => ({ id: t.id, name: t.name, uniform: t.uniform, dir: side === 0 ? -1 : 1 })),
      players,
      mode,
      skills: this.rules.skills,
      inferno: this.rules.inferno,
      fire: [0, 0], // INFERNO fire tokens in each coach's play area (max 3)
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
  // wait for the screen to catch up with what's been logged (UI pacing only: the simulator has no delay)
  async catchUp() {
    const wait = this.rewinding ? 0 : this.owed;
    this.owed = 0;
    if (wait && this.delay) await this.delay(wait);
  }
  get state() { return this.s; }
  emit() { this.onChange(this.s); }
  log(text, kind = 'info', data = {}) {
    const entry = { ...data, text, kind, id: ++this.logNo };
    if (this.rewinding) entry.old = true; // rebuilt while resuming / undoing: the screen doesn't replay its show
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
  has(p, a) { return hasSkill(this.s, p, a); }
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
  // online: the computer coaches a side (the friend dropped) or hands it back (agent = null). A question already
  // waiting on that side is answered straight away.
  setAgent(side, agent) {
    this.agents[side] = agent;
    const r = this.s.request;
    if (agent && r?.side === side && this.pending) Promise.resolve(agent(this, side, r)).then((v) => { if (this.s.request?.id === r.id) this.pending?.(v); });
  }

  // ask until the answer passes `check` (returns an error string or null). A computer coach gets one retry and then the
  // fallback, so a bot bug shows up in the stats instead of freezing the game.
  async askValid(side, req, check, fallback) {
    for (let i = 0; i < 3; i++) {
      const v = await this.ask(side, i ? { ...req, error: this._lastErr } : req);
      // a timeout can be called from any question asked while the ball is dead (rulebook p.13); then the same
      // question comes back. It's an answer like any other, so it's checked, saved for resume / undo, and sent online.
      if (v && v.timeout === true && DEAD_BALL.includes(req.type)) {
        if (this.canTimeout(side)) this.callTimeout(side); else this._lastErr = 'no timeout available';
        i--;
        continue;
      }
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
    // the last play must finish on screen (the runner walking in, the touchdown, the hit) before the field is cleared
    await this.catchUp();
    this.stats.downs++;
    if (s.drive?.side === s.offense) s.drive.plays++;
    s.play = { startOffense: s.offense, line: s.line, forwardDone: false, crossed: false, passThrown: false, adjustUsed: [false, false], activations: 0 };
    for (const p of playerList(s)) { p.col = null; p.row = null; p.down = false; }
    s.ball = { at: 'dead' };
    // every down starts with both of each player's cards back on the bench
    s.cards.forEach((c, side) => { c.bench = this.roster(side).flatMap((p) => [p.num, p.num]).sort((a, b) => a - b); c.stack = []; c.discard = []; });
    this.log(`${['', '1st', '2nd', '3rd', '4th'][s.down]} down, ${this.team(s.offense).name} ball at the ${yardLabel(s.line, this.dir(s.offense))}.`, 'down',
      { down: s.down, line: s.line, offense: s.offense });

    if (this.rules.fieldGoals && await this.maybeKick()) return;
    s.phase = 'formation';
    await this.formation(s.offense, 'offense');
    await this.formation(this.defense, 'defense');
    s.phase = 'call';
    await this.callPlays();
    s.phase = 'motion';
    for (const [side, cost] of [[s.offense, 1], [this.defense, 1], [s.offense, 2], [this.defense, 2]]) await this.motion(side, cost);
    if (s.inferno) for (const side of [s.offense, this.defense]) await this.lightUp(side);
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

  // ---------- field goals (PRO / ALL PRO, p.20-21) ----------
  // from the hiker's square to the square just off the board between the posts, measured normally, +1 for the posts
  fgDistance() {
    const s = this.s;
    const dir = this.dir(s.offense);
    const { off } = losRows(s.line, dir);
    return distance([s.spot, off], [6, dir < 0 ? -1 : ROWS]) + 1;
  }
  inOppTerritory() {
    const s = this.s, dir = this.dir(s.offense);
    const own = dir < 0 ? (ROWS - 2 - s.line) * 5 : (s.line - 2) * 5;
    return own > 50;
  }
  // instead of running a play: 3d6 >= the distance is good for 3; a miss gives the ball over where the kick was
  async maybeKick() {
    const s = this.s;
    if (!this.inOppTerritory()) return false;
    const dist = this.fgDistance();
    const kick = await this.askValid(s.offense, { type: 'kick', dist, down: s.down }, (v) => (typeof v === 'boolean' ? null : 'yes or no'), () => false);
    if (!kick) return false;
    const dir = this.dir(s.offense);
    const { off } = losRows(s.line, dir);
    if (!s.overtime) s.pile.shift(); // one time token, like a pass play
    const dice = [this.d6(), this.d6(), this.d6()];
    const total = dice[0] + dice[1] + dice[2];
    const good = total >= dist;
    this.log(`Field goal try, ${dist} to beat: ${dice.join(' + ')} = ${total}. ${good ? "It's GOOD!" : 'No good!'}`, 'kick',
      { side: s.offense, dice, total, dist, good, from: [s.spot, off], dir, pid: occupant(s, s.spot, off)?.pid ?? null });
    if (good) {
      s.score[s.offense] += 3;
      this.log(`FIELD GOAL ${this.team(s.offense).name}! (+3)`, 'fieldgoal', { side: s.offense, score: [...s.score] });
      if (s.drive?.side === s.offense) this.endDrive('FIELD GOAL');
      if (s.overtime) throw new GameOver();
      this.startDrive(1 - s.offense);
    } else {
      s.offense = 1 - s.offense;
      s.down = 1;
      this.log(`Wide! ${this.team(s.offense).name} take over where it was kicked from.`, 'turnover', { side: s.offense, missedKick: true });
      this.changeDrive('MISSED FG');
    }
    return true;
  }

  // ---------- INFERNO: fire tokens ----------
  earn(side, n, why) {
    const s = this.s;
    if (!s.inferno || side == null || n <= 0) return;
    const got = Math.min(n, 3 - s.fire[side]);
    if (got <= 0) return;
    s.fire[side] += got;
    this.log(`${this.team(side).name} earn ${got} fire token${got > 1 ? 's' : ''}: ${why}.`, 'fire', { side, n: got, why, tokens: s.fire[side] });
  }
  spend(side, n) { if (n > 0) this.s.fire[side] = Math.max(0, this.s.fire[side] - n); }
  fireOut(p, why) {
    if (!p?.onFire) return;
    p.onFire = false;
    this.log(`${this.name(p)} cools off (${why}).`, 'fireout', { pid: p.pid, why });
  }
  setOnFire(p, skill = null) {
    p.onFire = true;
    p.fireSkill = skill ?? (p.abilities?.some((a) => a.includes('QB READ while ON FIRE')) ? 'QB READ' : null);
    this.log(`${this.name(p)} is ON FIRE!`, 'onfire', { pid: p.pid, side: p.side, skill: p.fireSkill });
  }
  // before the snap: 3 tokens set a player ON FIRE (+3 on every skill check), at most 3 on fire per team
  async lightUp(side) {
    const s = this.s;
    if (s.fire[side] < 3) return;
    const roster = this.roster(side);
    if (roster.filter((p) => p.onFire).length >= 3) return;
    const options = roster.filter((p) => !p.onFire).map((p) => p.pid);
    const anySkill = (pid) => !!s.players[pid]?.abilities?.some((a) => a.startsWith('INFERNO: any single skill'));
    const check = (v) => (v == null || (v && options.includes(v.pid) && (!anySkill(v.pid) || SKILLS.includes(v.skill))) ? null : 'pick a player to set on fire');
    const v = await this.askValid(side, { type: 'onFire', options, tokens: s.fire[side], anySkill: options.filter(anySkill) }, check, () => null);
    if (!v) return;
    this.spend(side, 3);
    this.setOnFire(s.players[v.pid], anySkill(v.pid) ? v.skill : null);
  }

  // ---------- setup ----------
  formationCtx() {
    const s = this.s;
    return { line: s.line, dir: this.dir(s.offense), col: s.spot, count: this.roster(0).length };
  }
  async formation(side, role) {
    const s = this.s;
    const ctx = this.formationCtx();
    const roster = this.roster(side).map((p) => ({ num: p.num, skill: p.skill, name: p.name, abilities: p.abilities }));
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
    // the route he runs (the board walks it): the same reach the options came from
    const path = moveReach(s, p, p.skill, 0, { stopRows: [losRow] }).get(key(...v.to))?.path ?? [v.to];
    p.col = v.to[0]; p.row = v.to[1];
    this.log(`${this.name(p)} goes in motion.`, 'motion', { pid: p.pid, from, to: v.to, cost, path });
  }

  // Timeouts (rulebook p.13): 2 per coach per game; only while the ball isn't in play and there's at least one time
  // cube left in the half; a timeout adds a red cube to the half pile (one more play). None in overtime (p.14).
  canTimeout(side) {
    const s = this.s;
    return !s.overtime && s.timeouts[side] > 0 && s.pile.length >= 1 && s.phase !== 'play';
  }
  callTimeout(side) {
    const s = this.s;
    s.timeouts[side]--;
    s.pile.push('r');
    this.log(`TIMEOUT, ${this.team(side).name} (${s.timeouts[side]} left).`, 'timeout', { side, left: s.timeouts[side] });
  }
  // a person calls theirs with the Timeout button (an answer to any dead-ball question: askValid); the computer is
  // asked in the last minute of the half
  async timeouts() {
    const s = this.s;
    if (s.pile.length !== 1) return;
    for (const side of [s.offense, this.defense]) {
      if (!this.agents[side] || !this.canTimeout(side)) continue;
      const v = await this.askValid(side, { type: 'timeout', left: s.timeouts[side], score: s.score }, (x) => (typeof x === 'boolean' ? null : 'yes or no'), () => false);
      if (v) this.callTimeout(side);
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
    s.play.snappedTo = receiver.pid;
    this.log(`Hut-hut! ${this.name(hiker)} snaps it to ${this.name(receiver)}.`, 'snap', { from: hiker.pid, to: receiver.pid });
  }

  // ---------- the play: cards ----------
  async runPlay() {
    const s = this.s;
    for (;;) {
      while (s.cards[0].stack.length || s.cards[1].stack.length) {
        await this.round(s.cards[0].stack.shift(), s.cards[1].stack.shift());
      }
      s.play.pocketReady = true; // the five called cards are done (POCKET PASSER)
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
      let only = null;
      if (side === s.offense && !rr[this.defense]) {
        // QB READ: the offense may still read and react, with a QB READ player who has the ball
        const c = carrier(s);
        if (!c || c.side !== side || !this.has(c, 'QB READ') || !s.cards[side].bench.includes(c.num)) break;
        only = [c.num];
      }
      const bench = s.cards[side].bench;
      if (!bench.length) continue;
      const v = await this.askValid(side, { type: 'readReact', card: up[side], other: up[1 - side], bench: [...bench], only },
        (x) => (x == null || (bench.includes(x) && (!only || only.includes(x))) ? null : 'pick a bench card or pass'), () => null);
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
      this.log(`Same rating: dice ${r[0]} - ${r[1]}.`, 'dice', { dice: r, sides: [0, 1], purpose: 'order' });
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
  // other side), adjust (one half of an adjustment), dogpile (INFERNO: a dirty hit after a tackle)
  async runActivation(pid, mode, { party = false } = {}) {
    const s = this.s;
    const p = s.players[pid];
    if (++s.play.activations > MAX_ACTIVATIONS) { this.stats.stalls++; throw new PlayEnd('stall'); }
    this.stats.activations++;
    // EN FUEGO lasts until the coach acts with another player
    for (const m of this.roster(p.side)) if (m.fuego && m.pid !== pid) m.fuego = null;
    const ctx = { pid, mode, budget: mode === 'half' || mode === 'adjust' ? halfOf(p.skill) : p.skill, spent: 0, parity: 0, acted: false, done: false, fresh: true, left: false,
      pressured: false, used: {}, bought: 0, hurdle: false, last: null, party, couldScore: false };
    const prev = s.active;
    s.active = { pid, mode };
    this.log(`${this.name(p)} ${mode === 'half' ? 'gets a half move' : mode === 'full' ? 'gets a free activation' : mode === 'adjust' ? 'adjusts' : 'is up'}.`, 'activate', { pid, mode });
    try {
      while (!ctx.done) {
        const req = this.actRequest(p, ctx);
        const options = req.moves.length + req.handoffs.length + req.blocks.length + req.tackles.length + req.passes.length + req.jukes.length + req.shakes.length + req.dirty.length;
        if (!options && !req.canStand && !req.canAdjust && !req.fire?.canBuy) break;
        if (carrier(s)?.pid === p.pid && req.moves.some((m) => m.end === 'td')) ctx.couldScore = true;
        const a = await this.askValid(p.side, req, (v) => this.checkAct(req, v), () => ({ kind: 'end' }));
        await this.doAct(p, ctx, a);
        if (!['buy', 'hurdle', 'fuego'].includes(a.kind)) ctx.fresh = false;
      }
    } finally {
      s.active = prev;
    }
    // INFERNO early celebration: he could have scored this activation and chose not to
    if (ctx.couldScore && carrier(s)?.pid === p.pid) this.earn(p.side, 1, 'early celebration');
    // only the last skill check of an activation hands out a free activation (p.15)
    if (mode !== 'dogpile' && ctx.last) {
      const { actor, res, party: bp } = ctx.last;
      if (res.result === 'total') await this.bonus({ side: actor.side, kind: 'full', exclude: actor.pid, party: bp });
      else if (res.result === 'partial') await this.bonus({ side: 1 - actor.side, kind: 'half' });
      else await this.bonus({ side: 1 - actor.side, kind: 'full' });
    }
    return ctx;
  }

  // a normal action: a full activation may move up to half (bought movement doesn't count) and then act
  canAction(p, ctx) {
    if (ctx.acted || p.down) return false;
    const spent = Math.max(0, ctx.spent - ctx.bought);
    if (ctx.mode === 'card' || ctx.mode === 'full' || ctx.mode === 'dogpile') return spent <= halfOf(p.skill);
    if (ctx.mode === 'rr') return ctx.spent === 0;
    return false;
  }
  // a skill used "as part of a move action" (once per activation, doesn't end the activation): BLITZ / RUN BLOCK
  // (block), DIVING TACKLE (tackle), JUKE (with the ball), SHAKE (offense, without it)
  moveSkill(p, ctx, kind) {
    const s = this.s;
    if (p.down || ctx.used[kind] || !['card', 'full', 'rr', 'half'].includes(ctx.mode)) return false;
    const holder = carrier(s);
    const off = p.side === s.offense;
    if (kind === 'block') return (!off && this.has(p, 'BLITZ')) || (off && this.has(p, 'RUN BLOCK'));
    if (kind === 'tackle') return this.has(p, 'DIVING TACKLE');
    if (kind === 'juke') return this.has(p, 'JUKE') && holder?.pid === p.pid;
    if (kind === 'shake') return off && this.has(p, 'SHAKE') && holder?.pid !== p.pid;
    return false;
  }

  actRequest(p, ctx) {
    const s = this.s;
    const left = ctx.budget - ctx.spent;
    const dog = ctx.mode === 'dogpile';
    const req = { type: 'act', pid: p.pid, mode: ctx.mode, left, spent: ctx.spent, parity: ctx.parity, moves: [], handoffs: [], blocks: [], tackles: [], passes: [], shoves: [], jukes: [], shakes: [],
      dirty: [], asMove: [], canStand: false, canAdjust: false, fire: null };
    req.canAdjust = !dog && ctx.fresh && (ctx.mode === 'card' || ctx.mode === 'rr') && !s.play.adjustUsed[p.side] && carrier(s)?.pid !== p.pid;
    if (s.inferno) {
      const t = s.fire[p.side];
      req.fire = { tokens: t, canBuy: t > 0 && !p.down, canHurdle: t > 0 && !ctx.hurdle && !p.down, canFuego: t >= 3 && ctx.fresh && !p.fuego && !dog, bought: ctx.bought };
    }
    if (p.down) { req.canStand = left >= 3; return req; }
    req.moves = [...moveReach(s, p, left, ctx.parity, { allowOut: !dog, hurdle: ctx.hurdle }).values()].map((m) => ({ to: m.to, cost: m.cost, end: m.end }));
    const act = this.canAction(p, ctx);
    if (dog) {
      req.moves = req.moves.filter((m) => !m.end);
      if (act) for (const o of this.roster(1 - p.side)) if (o.down && o.col != null && adjacent(sqOf(o), sqOf(p))) req.dirty.push(o.pid);
      return req;
    }
    const holder = carrier(s);
    // hand-offs: next to each other, or up to 3 away when the ball carrier can PITCH (forward only until a forward pass)
    for (const m of this.roster(p.side)) {
      if (m.pid === p.pid || m.down || m.col == null || !holder || (holder.pid !== p.pid && holder.pid !== m.pid)) continue;
      if (adjacent(sqOf(m), sqOf(p))) { req.handoffs.push(m.pid); continue; }
      const giver = holder.pid === p.pid ? p : m, taker = giver === p ? m : p;
      if (this.has(giver, 'PITCH') && distance(sqOf(p), sqOf(m)) <= 3 && !(s.play.forwardDone && isForward(sqOf(giver), sqOf(taker), this.dir(p.side)))) req.handoffs.push(m.pid);
    }
    const skillBlock = this.moveSkill(p, ctx, 'block'), skillTackle = this.moveSkill(p, ctx, 'tackle');
    if (skillBlock) req.asMove.push('block');
    if (skillTackle) req.asMove.push('tackle');
    const canBlock = skillBlock || (act && !ctx.used.block);
    const canTackle = skillTackle || (act && !ctx.used.tackle);
    const juke = this.moveSkill(p, ctx, 'juke'), shake = this.moveSkill(p, ctx, 'shake');
    for (const o of this.roster(1 - p.side)) {
      if (o.col == null || !adjacent(sqOf(o), sqOf(p))) continue;
      if (o.down) { if (s.inferno && act) req.dirty.push(o.pid); continue; }
      if (canBlock) { req.blocks.push(o.pid); if (this.has(p, 'SHOVE')) req.shoves.push(o.pid); }
      if (canTackle && holder?.pid === o.pid) req.tackles.push(o.pid);
      if (juke) req.jukes.push(o.pid);
      if (shake) req.shakes.push(o.pid);
    }
    if (act && holder?.pid === p.pid) {
      // INFERNO FIRE BOMB (3 tokens): 3x range instead of 2x
      const bomb = s.inferno && s.fire[p.side] >= 3;
      const r = p.skill * (bomb ? 3 : 2);
      for (let c = p.col - r; c <= p.col + r; c++) for (let rw = p.row - r; rw <= p.row + r; rw++) {
        if (c < 0 || c > 12 || rw < 0 || rw > 23) continue;
        let info = passInfo(s, p, [c, rw]), isBomb = false;
        if (!info.ok && bomb && info.reasons.length === 1 && info.reasons[0] === 'out of range') { info = passInfo(s, p, [c, rw], { bomb: true }); isBomb = true; }
        if (info.ok) req.passes.push({ to: [c, rw], target: info.target?.pid ?? null, dist: info.dist, bonus: info.bonus, penalty: Math.min(3, info.penalty), why: info.why, ...(isBomb ? { bomb: true } : {}) });
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
      case 'shove': return req.shoves.includes(v.pid) ? null : 'cannot shove that player';
      case 'juke': return req.jukes.includes(v.pid) ? null : 'cannot juke that player';
      case 'shake': return req.shakes.includes(v.pid) ? null : 'cannot shake that player';
      case 'dirty': return req.dirty.includes(v.pid) ? null : 'no dirty hit on that player';
      case 'tackle': return req.tackles.includes(v.pid) ? null : 'cannot tackle that player';
      case 'pass': return Array.isArray(v.to) && req.passes.some((x) => same(x.to, v.to)) ? null : 'cannot pass there';
      case 'buy': return req.fire?.canBuy && Number.isInteger(v.n) && v.n >= 1 && v.n <= req.fire.tokens ? null : 'not enough fire tokens';
      case 'hurdle': return req.fire?.canHurdle ? null : 'no hurdle now';
      case 'fuego': return req.fire?.canFuego && SKILLS.includes(v.skill) ? null : 'no EN FUEGO now';
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
      case 'adjust': if (await this.adjustment(p)) ctx.done = true; return; // called off: back to his normal turn
      case 'move': {
        const m = moveReach(s, p, ctx.budget - ctx.spent, ctx.parity, { allowOut: ctx.mode !== 'dogpile', hurdle: ctx.hurdle }).get(key(...a.to));
        ctx.spent += m.cost; ctx.parity = m.parity;
        await this.walk(p, m.path, ctx);
        if (m.end === 'ball') await this.grab(p, ctx);
        return;
      }
      case 'handoff': await this.handoff(p, s.players[a.pid], ctx); return;
      case 'block': case 'shove': case 'juke': case 'shake': case 'tackle': {
        const group = a.kind === 'shove' ? 'block' : a.kind;
        const asMove = this.moveSkill(p, ctx, group); // part of a move action: he can keep going afterwards
        ctx.used[group] = true;
        if (!asMove) { ctx.acted = true; ctx.done = true; }
        if (a.kind === 'tackle') await this.tackle(p, s.players[a.pid], ctx, asMove);
        else await this.block(p, s.players[a.pid], ctx, a.kind);
        if (p.down) ctx.done = true;
        return;
      }
      case 'dirty': ctx.acted = true; ctx.done = true; await this.dirtyHit(p, s.players[a.pid], ctx); return;
      case 'pass': {
        ctx.acted = true; ctx.done = true;
        await this.pass(p, a.to, ctx, !passInfo(s, p, a.to).ok);
        return;
      }
      case 'buy':
        this.spend(p.side, a.n); ctx.budget += a.n; ctx.bought += a.n;
        this.log(`${this.name(p)} burns ${a.n} fire token${a.n > 1 ? 's' : ''} for +${a.n} movement.`, 'firebuy', { pid: p.pid, n: a.n });
        return;
      case 'hurdle':
        this.spend(p.side, 1); ctx.hurdle = true;
        this.log(`${this.name(p)} can hurdle fallen players this activation.`, 'firebuy', { pid: p.pid, hurdle: true });
        return;
      case 'fuego':
        this.spend(p.side, 3); p.fuego = a.skill;
        this.log(`EN FUEGO! ${this.name(p)} gets ${a.skill}.`, 'fuego', { pid: p.pid, skill: a.skill });
        return;
    }
  }

  // step along a path square by square: touchdowns, stepping out, crossing the line, defensive pressure
  async walk(p, path, ctx) {
    const s = this.s;
    const start = sqOf(p);
    let from = start, seg = 0;
    if (p.pid === s.play.snappedTo) s.play.pocketMoved = true; // POCKET PASSER: he has moved
    for (let i = 0; i < path.length; i++) {
      const q = path[i];
      const prev = sqOf(p);
      if (q[0] < 0 || q[0] > 12 || q[1] < 0 || q[1] > 23) {
        this.log(`${this.name(p)} steps out of bounds.`, 'move', { pid: p.pid, from, to: prev, path: path.slice(seg) });
        this.fireOut(p, 'ran out of bounds');
        this.endWithBall(p, 'out');
      }
      p.col = q[0]; p.row = q[1];
      // OPTION: a defender closing on the ball carrier halts while the offense decides whether to pitch
      const opt = this.optionCarrier(p, prev, ctx);
      if (opt) {
        this.log(`${this.name(p)} moves.`, 'move', { pid: p.pid, from, to: sqOf(p), path: path.slice(seg, i + 1) });
        seg = i + 1; from = sqOf(p);
        await this.option(opt);
      }
      try {
        this.pressure(p, prev, ctx);
      } catch (e) {
        // a sack mid-run ends the play here: log the steps taken so far (the board and replays need them)
        if (seg <= i) this.log(`${this.name(p)} moves.`, 'move', { pid: p.pid, from, to: sqOf(p), path: path.slice(seg, i + 1) });
        throw e;
      }
    }
    if (s.ball.at === 'held' && s.ball.pid === p.pid) {
      if (!s.play.carried?.includes(p.pid)) { this.stat(p.pid, 'carries'); (s.play.carried ??= []).push(p.pid); }
      this.stat(p.pid, 'rushYds', (p.row - start[1]) * this.dir(p.side) * 5);
    }
    if (seg < path.length) this.log(`${this.name(p)} moves.`, 'move', { pid: p.pid, from, to: sqOf(p), path: path.slice(seg) });
    this.ballMoved();
    this.checkTouchdown(p);
  }

  // the OPTION ball carrier this defender's step has just closed on (once per activation), or null
  optionCarrier(p, prev, ctx) {
    const c = carrier(this.s);
    if (!ctx || ctx.optioned || !c || c.down || c.side === p.side || !this.has(c, 'OPTION') || !this.has(c, 'PITCH')) return null;
    if (!adjacent(sqOf(p), sqOf(c)) || adjacent(prev, sqOf(c))) return null;
    ctx.optioned = true;
    return c;
  }
  async option(c) {
    const s = this.s;
    const targets = this.roster(c.side).filter((m) => m.pid !== c.pid && !m.down && m.col != null && distance(sqOf(m), sqOf(c)) <= 3
      && !(s.play.forwardDone && isForward(sqOf(c), sqOf(m), this.dir(c.side)))).map((m) => m.pid);
    if (!targets.length) return;
    const v = await this.askValid(c.side, { type: 'option', pid: c.pid, targets }, (x) => (x == null || targets.includes(x) ? null : 'pick a teammate or keep it'), () => null);
    if (v == null) return;
    if (!this.sportCheck(c, `${this.name(c)} runs the option`)) {
      this.fireOut(c, 'fumbled');
      await this.scatter(sqOf(c), false, 'option');
      return;
    }
    await this.handoff(c, s.players[v], { done: false });
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
      this.earn(p.side, 1, 'a sack');
      this.fireOut(c, 'sacked');
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
    const v = await this.askValid(b.side, { type: 'bonus', kind: b.kind, options, party: !!b.party }, (x) => (x == null || options.includes(x) ? null : 'pick one of your players or pass'), () => null);
    if (v != null) await this.runActivation(v, b.kind, { party: b.party });
  }

  // an adjustment: he and a partner each move up to half. Picking no partner (null) calls it off before anything moves.
  async adjustment(p) {
    const s = this.s;
    const holder = carrier(s);
    const options = this.roster(p.side).filter((m) => m.pid !== p.pid && m.pid !== holder?.pid).map((m) => m.pid);
    const v = await this.askValid(p.side, { type: 'adjustPartner', pid: p.pid, options },
      (x) => (x == null || (options.includes(x.pid) && (x.first === 'self' || x.first === 'partner')) ? null : 'pick a partner'), () => ({ pid: options[0], first: 'self' }));
    if (v == null) return false;
    s.play.adjustUsed[p.side] = true;
    this.log(`${this.team(p.side).name} make an adjustment: ${this.name(p)} and ${this.name(s.players[v.pid])}.`, 'adjust', { side: p.side, pids: [p.pid, v.pid] });
    const order = v.first === 'self' ? [p.pid, v.pid] : [v.pid, p.pid];
    for (const pid of order) await this.runActivation(pid, 'adjust');
    return true;
  }

  // ---------- checks ----------
  // A skill check. target: who it's aimed at (DODGE); receiver: a pass target (CATCH); playmaker: 'passive' adds the
  // SPIN MOVE / STIFF ARM die (a match cancels that skill die). In INFERNO the boost prompt also takes fire tokens,
  // showboating and BRING THE HEAT, then the other coach may spend tokens against it.
  async skillCheck(actor, { bonus, penalty, label, data = {}, target = null, action = null, receiver = null, playmaker = null }) {
    const s = this.s;
    this.stats.checks++;
    if (target && ['block', 'shove', 'tackle'].includes(action) && this.has(target, 'DODGE')) {
      const tb = s.cards[target.side].bench;
      const max = Math.min(tb.filter((n) => n === target.num).length, Math.max(0, 3 - penalty));
      if (max) {
        const n = await this.askValid(target.side, { type: 'dodge', pid: target.pid, by: actor.pid, max, label }, (v) => (Number.isInteger(v) && v >= 0 && v <= max ? null : `0 to ${max}`), () => 0);
        for (let i = 0; i < n; i++) { tb.splice(tb.indexOf(target.num), 1); s.cards[target.side].discard.push(target.num); }
        if (n) { penalty += n; this.log(`${this.name(target)} DODGES: -${n}.`, 'dodge', { pid: target.pid, n }); }
      }
    }
    const bench = s.cards[actor.side].bench;
    const own = bench.filter((n) => n === actor.num).length;
    const catchCards = receiver && receiver.num !== actor.num && this.has(receiver, 'CATCH') ? bench.filter((n) => n === receiver.num).length : 0;
    const room = Math.max(0, 3 - bonus);
    const max = Math.min(own + catchCards, room);
    const tokens = s.inferno ? s.fire[actor.side] : 0;
    const showMax = s.inferno ? Math.max(0, 3 - penalty) : 0;
    let a = { boost: 0, fire: 0, showboat: 0, heat: false };
    if (max || tokens || showMax) {
      const fire = s.inferno ? { tokens, room, showboat: showMax, heat: tokens >= 3 && CONTACT.includes(action) } : null;
      const req = { type: 'boost', pid: actor.pid, max, bonus, penalty, label, fire, catchFrom: catchCards ? receiver.pid : null };
      const v = await this.askValid(actor.side, req, (x) => this.checkBoost(req, x), () => 0);
      a = { ...a, ...(typeof v === 'number' ? { boost: v } : v) };
      for (let i = 0; i < a.boost; i++) {
        const n = bench.includes(actor.num) ? actor.num : receiver.num;
        bench.splice(bench.indexOf(n), 1); s.cards[actor.side].discard.push(n);
      }
      this.spend(actor.side, a.fire + (a.heat ? 3 : 0));
    }
    let against = 0;
    const penRoom = Math.max(0, 3 - penalty - a.showboat);
    if (s.inferno && s.fire[1 - actor.side] && penRoom) {
      const mx = Math.min(s.fire[1 - actor.side], penRoom);
      against = await this.askValid(1 - actor.side, { type: 'fireDefend', pid: actor.pid, max: mx, label }, (v) => (Number.isInteger(v) && v >= 0 && v <= mx ? null : `0 to ${mx}`), () => 0);
      this.spend(1 - actor.side, against);
    }
    const net = netModifier(bonus + a.boost + a.fire, penalty + a.showboat + against);
    const dice = [this.d6(), this.d6()];
    let pm = null, matches = 0, counted = dice;
    if (playmaker || a.heat) {
      pm = this.d6();
      matches = dice.filter((d) => d === pm).length;
      if (playmaker === 'passive') counted = dice.map((d) => (d === pm ? 0 : d));
    }
    const res = { ...checkResult(counted[0], counted[1], net), dice, crit: dice[0] === dice[1], pm, matches, heat: a.heat, action };
    const words = { total: 'TOTAL SUCCESS', partial: 'success', fail: 'FAILURE' }[res.result];
    const pmText = pm ? ` (playmaker die ${pm}${matches ? `: ${matches === 2 ? 'DOUBLE ' : ''}MATCH` : ''})` : '';
    this.log(`${label}: ${dice[0]}+${dice[1]}${net ? ` ${net > 0 ? '+' : ''}${net}` : ''} = ${res.total}, ${res.crit ? 'CRITICAL ' : ''}${words}.${pmText}`, 'check',
      { pid: actor.pid, label, ...res, boost: a.boost, fire: a.fire, showboat: a.showboat, against, bonus, penalty, ...data });
    if (a.showboat && res.success) this.earn(actor.side, a.showboat, 'showboating');
    if (!res.success) this.fireOut(actor, 'failed a check');
    return res;
  }
  checkBoost(req, x) {
    const v = typeof x === 'number' ? { boost: x } : x;
    if (!v || typeof v !== 'object') return 'how many cards?';
    const { boost = 0, fire = 0, showboat = 0, heat = false } = v;
    if (!Number.isInteger(boost) || boost < 0 || boost > req.max) return `0 to ${req.max} cards`;
    const f = req.fire;
    if (!f) return fire || showboat || heat ? 'no fire tokens in this mode' : null;
    if (!Number.isInteger(fire) || fire < 0 || boost + fire > f.room) return 'that goes past +3';
    if (fire + (heat ? 3 : 0) > f.tokens) return 'not enough fire tokens';
    if (!Number.isInteger(showboat) || showboat < 0 || showboat > f.showboat) return 'that goes past -3';
    if (heat && !f.heat) return 'no BRING THE HEAT on this check';
    return null;
  }

  // what the check means for the activation: a failure ends it; the last check decides the free activation
  afterCheck(ctx, actor, res) {
    ctx.last = { actor, res, party: res.result === 'total' && (res.action === 'block' || res.action === 'shove') && this.has(actor, 'BLOCK PARTY') };
    if (!res.success) ctx.done = true;
  }

  sportCheck(p, label) {
    const d = [this.d6(), this.d6()];
    const ok = d[0] !== d[1];
    this.log(`${label}: ${d[0]} and ${d[1]}, ${ok ? 'got it' : 'DOUBLES, it gets away'}.`, 'sport', { pid: p.pid, dice: d, ok, label });
    return ok;
  }

  // ---------- actions ----------
  // a block, a SHOVE, a JUKE or a SHAKE: all resolve like a block (juke / shake: the faster player gets the bonus)
  async block(actor, target, ctx, kind = 'block') {
    const s = this.s;
    const m = contactMods(s, actor, target, kind);
    const party = ctx.party && (kind === 'block' || kind === 'shove') ? 2 : 0; // BLOCK PARTY
    const verb = { block: 'blocks', shove: 'shoves', juke: 'jukes', shake: 'shakes' }[kind];
    const res = await this.skillCheck(actor, { bonus: m.bonus + party, penalty: m.penalty, target, action: kind, label: `${this.name(actor)} ${verb} ${this.name(target)}`,
      data: { action: kind, target: target.pid, tat: sqOf(target), party: !!party, asMove: !!ctx.used && !ctx.acted } });
    if (res.success) {
      if (kind === 'shove') await this.shove(actor.side, actor, target, res.crit);
      else await this.push(actor.side, actor, target, res.crit);
      // BRING THE HEAT: a playmaker match on a success flattens the target; a double match lights the actor up
      if (res.heat && res.matches) {
        this.log(`BRING THE HEAT! ${this.name(target)} gets flattened.`, 'heat', { pid: actor.pid, target: target.pid, double: res.matches === 2 });
        if (!target.down) await this.knockDown(target, actor.side);
        if (res.matches === 2) {
          const can = !actor.onFire && this.roster(actor.side).filter((p) => p.onFire).length < 3;
          const pick = can ? await this.askValid(actor.side, { type: 'heatCrit', pid: actor.pid }, (v) => (v === 'fire' || v === 'tokens' ? null : 'fire or tokens'), () => 'fire') : 'tokens';
          if (pick === 'fire') this.setOnFire(actor); else this.earn(actor.side, 3, 'BRING THE HEAT');
        }
      }
    } else {
      // the target may turn it round on the initiator (p.6). On a critical failure the initiator "may be pushed back AND
      // is knocked down": the push is the target's choice, the knockdown isn't.
      const reverse = await this.askValid(target.side, { type: 'reverse', pid: target.pid, against: actor.pid, crit: res.crit, kind }, (v) => (typeof v === 'boolean' ? null : 'yes or no'), () => true);
      if (reverse) {
        if (kind === 'shove') await this.shove(target.side, target, actor, res.crit);
        else await this.push(target.side, target, actor, res.crit);
      } else if (res.crit) {
        this.log(`${this.name(actor)} goes down in a heap!`, 'knockdown', { pid: actor.pid });
        await this.knockDown(actor, target.side);
      }
    }
    this.afterCheck(ctx, actor, res);
  }

  // SHOVE: straight back 2 squares. Stopped short: knocked down where he ends up. Then an optional follow-up of the
  // same length (it ignores threat).
  async shove(chooser, by, victim, knock) {
    const s = this.s;
    const d = [Math.sign(victim.col - by.col), Math.sign(victim.row - by.row)];
    const from = sqOf(victim);
    const occ = occupiedMap(s, victim.pid);
    const path = [];
    let at = from;
    for (let i = 0; i < 2; i++) {
      const q = [at[0] + d[0], at[1] + d[1]];
      if (!inBounds(...q) || occ.has(key(...q))) break;
      path.push(q); at = q;
    }
    const short = path.length < 2;
    victim.col = at[0]; victim.row = at[1];
    this.log(`${this.name(victim)} is SHOVED back ${path.length}${short || knock ? ' and knocked flat' : ''}!`, 'push', { pid: victim.pid, from, to: at, path, by: by.pid, shove: true, knock: short || knock });
    if (path.length) {
      if (looseAt(s, ...at)) await this.scatter(at, s.ball.at === 'air', 'the ball bounces off him');
      this.ballMoved();
      this.checkTouchdown(victim);
      const steps = path.length === 2 ? [from, path[0]] : [from];
      const follow = await this.askValid(chooser, { type: 'followUp', pid: by.pid, to: steps.at(-1), steps: steps.length }, (v) => (typeof v === 'boolean' ? null : 'yes or no'), () => true);
      if (follow) {
        const prev = sqOf(by);
        const to = steps.at(-1);
        by.col = to[0]; by.row = to[1];
        this.log(`${this.name(by)} follows up.`, 'move', { pid: by.pid, from: prev, to, path: steps, followUp: true });
        this.pressure(by, prev, { left: false, pressured: false });
        this.ballMoved();
        this.checkTouchdown(by);
      }
    }
    if (short || knock) await this.knockDown(victim, by.side);
  }

  // `by` pushes `victim` one square away (chooser picks the square), with an optional follow-up into the gap.
  // No open square: knocked down where he stands. knock = also knocked down (critical).
  async push(chooser, by, victim, knock) {
    const s = this.s;
    const opts = pushOptions(s, sqOf(by), sqOf(victim));
    const from = sqOf(victim);
    if (!opts.length) {
      this.log(`${this.name(victim)} has nowhere to go and is knocked down!`, 'knockdown', { pid: victim.pid });
      await this.knockDown(victim, by.side);
      return;
    }
    const to = opts.length === 1 ? opts[0] : await this.askValid(chooser, { type: 'push', pid: victim.pid, options: opts }, (v) => (opts.some((q) => same(q, v)) ? null : 'pick a push square'), () => opts[0]);
    victim.col = to[0]; victim.row = to[1];
    this.log(`${this.name(victim)} is driven back${knock ? ' and FLATTENED' : ''}.`, 'push', { pid: victim.pid, from, to, by: by.pid, knock: !!knock });
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
    if (knock) await this.knockDown(victim, by.side);
  }

  // knocked down by anything but a tackle: a ball carrier fumbles. bySide: who did it (INFERNO tokens)
  async knockDown(p, bySide = null) {
    const s = this.s;
    p.down = true;
    this.fireOut(p, 'knocked down');
    const foe = bySide != null && bySide !== p.side;
    if (foe) this.earn(bySide, 1, 'a knockdown');
    if (carrier(s)?.pid === p.pid) {
      this.stat(p.pid, 'fumbles');
      this.log(`${this.name(p)} FUMBLES!`, 'fumble', { pid: p.pid });
      if (foe) this.earn(bySide, 1, 'forced a fumble');
      await this.scatter(sqOf(p), false, 'fumble');
    }
  }

  // diving = a DIVING TACKLE (part of a move): miss it and he's on the turf
  async tackle(actor, target, ctx, diving = false) {
    const s = this.s;
    const m = contactMods(s, actor, target, 'tackle');
    const spin = this.has(target, 'SPIN MOVE'), stiff = this.has(target, 'STIFF ARM');
    const res = await this.skillCheck(actor, { bonus: m.bonus, penalty: m.penalty, target, action: 'tackle', playmaker: spin || stiff ? 'passive' : null,
      label: `${this.name(actor)} ${diving ? 'dives at' : 'tackles'} ${this.name(target)}`, data: { action: 'tackle', target: target.pid, tat: sqOf(target), diving } });
    if (res.success) {
      target.down = true;
      if (behindLine(target.row, s.play.line, this.dir(target.side))) { this.earn(actor.side, 1, 'a tackle behind the line'); this.fireOut(target, 'tackled behind the line'); }
      if (!res.crit) {
        this.stat(actor.pid, 'tackles');
        this.log(`${this.name(target)} is brought down.`, 'tackle', { pid: target.pid, by: actor.pid, at: sqOf(target) });
        if (s.inferno && res.result === 'total') await this.dogpile(actor);
        this.endWithBall(target, 'tackle');
      }
      this.log(`BOOM! ${this.name(target)} is hit so hard the ball comes loose!`, 'fumble', { pid: target.pid, by: actor.pid, crit: true });
      this.earn(actor.side, 1, 'forced a fumble');
      this.fireOut(target, 'fumbled');
      await this.scatter(sqOf(target), false, 'fumble');
    } else {
      if (res.matches && stiff && !actor.down) {
        this.log(`STIFF ARM! ${this.name(target)} plants ${this.name(actor)} in the turf.`, 'stiffarm', { pid: target.pid, by: actor.pid });
        await this.knockDown(actor, target.side);
      }
      if (res.matches && spin) {
        if (res.matches === 2 && !actor.down) {
          this.log(`${this.name(actor)} grabs nothing but air and goes down.`, 'knockdown', { pid: actor.pid });
          await this.knockDown(actor, target.side);
        }
        const swap = await this.askValid(target.side, { type: 'spin', pid: target.pid, with: actor.pid }, (v) => (typeof v === 'boolean' ? null : 'yes or no'), () => true);
        if (swap) {
          const a = sqOf(actor), b = sqOf(target);
          actor.col = b[0]; actor.row = b[1]; target.col = a[0]; target.row = a[1];
          this.log(`SPIN MOVE! ${this.name(target)} spins past ${this.name(actor)}.`, 'spin', { pid: target.pid, with: actor.pid, from: b, to: a });
          this.ballMoved();
          this.checkTouchdown(target);
        }
      }
      if (!actor.down && (res.crit || diving)) {
        actor.down = true;
        this.fireOut(actor, 'hit the turf');
        this.log(`${this.name(actor)} whiffs and hits the turf.`, 'knockdown', { pid: actor.pid });
      }
    }
    this.afterCheck(ctx, actor, res);
  }

  // INFERNO dirty hit: an action on a downed opponent, +1, worth fire tokens (3 on a critical)
  async dirtyHit(actor, target, ctx) {
    const m = contactMods(this.s, actor, target, 'dirty');
    const res = await this.skillCheck(actor, { bonus: m.bonus, penalty: m.penalty, target, action: 'dirty', label: `${this.name(actor)} puts a dirty hit on ${this.name(target)}`,
      data: { action: 'dirty', target: target.pid, tat: sqOf(target) } });
    if (res.success) this.earn(actor.side, res.crit ? 3 : 1, res.crit ? 'a critical dirty hit' : 'a dirty hit');
    this.afterCheck(ctx, actor, res);
  }
  // INFERNO dogpile: a tackle's total success can be spent on a dirty hit even though the play is over, and a dirty hit
  // that's a total success earns another (p.20)
  async dogpile(tackler) {
    let exclude = tackler.pid;
    for (let n = 0; n < 7; n++) {
      if (!this.roster(1 - tackler.side).some((o) => o.down && o.col != null)) return;
      const options = this.roster(tackler.side).filter((p) => p.pid !== exclude && !p.down && p.col != null).map((p) => p.pid);
      const v = await this.askValid(tackler.side, { type: 'bonus', kind: 'dogpile', options }, (x) => (x == null || options.includes(x) ? null : 'pick a player or pass'), () => null);
      if (v == null) return;
      this.log(`DOGPILE! ${this.name(this.s.players[v])} piles on.`, 'dogpile', { pid: v });
      const ctx = await this.runActivation(v, 'dogpile');
      if (ctx.last?.res.result !== 'total') return;
      exclude = v;
    }
  }

  async pass(passer, to, ctx, bomb = false) {
    const s = this.s;
    const info = passInfo(s, passer, to, { bomb });
    if (bomb) { this.spend(passer.side, 3); this.log(`FIRE BOMB! ${this.name(passer)} lets it fly.`, 'firebomb', { pid: passer.pid, to }); }
    if (info.why.includes('+2 pocket passer')) s.play.pocketUsed = true;
    s.play.passThrown = true;
    s.play.lastPasser = passer.pid;
    this.stat(passer.pid, 'att');
    if (info.forward) s.play.forwardDone = true;
    const res = await this.skillCheck(passer, { bonus: info.bonus, penalty: Math.min(3, info.penalty), action: 'pass', receiver: info.target, label: `${this.name(passer)} throws ${info.dist}`,
      data: { action: 'pass', from: sqOf(passer), to, target: info.target?.pid ?? null, dist: info.dist, bomb, why: info.why } });
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
      // INTERCEPTOR: a defender covering the target gets the ball put on him instead of a scatter (sport check to hold it)
      const pick = this.roster(1 - passer.side).filter((p) => !p.down && p.col != null && this.has(p, 'INTERCEPTOR')
        && (adjacent(sqOf(p), to) || (this.has(p, 'ZONE DEFENDER') && distance(sqOf(p), to) <= 3))).sort((a, b) => b.skill - a.skill)[0];
      if (pick) {
        this.log(`${this.name(pick)} jumps the route!`, 'intercept', { pid: pick.pid, to: sqOf(pick) });
        s.ball = { at: 'air', col: pick.col, row: pick.row };
        if (this.sportCheck(pick, `${this.name(pick)} goes for the interception`)) {
          this.earn(pick.side, 1, 'an interception');
          this.fireOut(passer, 'threw an interception');
          this.gain(pick);
        } else await this.scatter(sqOf(pick), true, 'tipped');
      } else await this.scatter(to, true, 'pass');
    }
    this.afterCheck(ctx, passer, res);
  }

  // a hand-off, or a PITCH (up to 3 squares): a forward pitch counts as a forward pass
  async handoff(p, mate, ctx) {
    const s = this.s;
    const giver = carrier(s).pid === p.pid ? p : mate;
    const taker = giver === p ? mate : p;
    const pitch = !adjacent(sqOf(giver), sqOf(taker));
    const forward = pitch && isForward(sqOf(giver), sqOf(taker), this.dir(giver.side));
    if (forward) { s.play.passThrown = true; s.play.forwardDone = true; }
    const pressured = threatCount(s, sqOf(giver), 1 - p.side) || threatCount(s, sqOf(taker), 1 - p.side);
    if (pressured && !this.sportCheck(giver, `${pitch ? 'Pitch' : 'Hand-off'} ${this.name(giver)} to ${this.name(taker)} under pressure`)) {
      ctx.done = true;
      this.fireOut(giver, 'fumbled');
      if (forward) { s.ball = { at: 'air', col: taker.col, row: taker.row }; await this.scatter(sqOf(taker), true, 'botched pitch'); }
      else await this.scatter(sqOf(giver), false, pitch ? 'botched pitch' : 'botched hand-off');
      return;
    }
    s.ball = { at: 'held', pid: taker.pid };
    this.log(`${this.name(giver)} ${pitch ? 'pitches it' : 'hands off'} to ${this.name(taker)}.`, 'handoff', { from: giver.pid, to: taker.pid, pitch });
    this.ballMoved();
    this.checkTouchdown(taker);
  }

  // moving into a loose ball's square: a sport check to scoop it up / pull it in
  async grab(p, ctx) {
    const s = this.s;
    const air = s.ball.at === 'air';
    if (this.sportCheck(p, `${this.name(p)} goes for the ${air ? 'ball in the air' : 'loose ball'}`)) {
      this.earn(p.side, 1, 'grabbed the loose ball');
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
        this.log(`Scatter dice ${d[0]} - ${d[1]}: a dramatic recovery!`, 'scatter', { dice: d, sides: [s.offense, this.defense], from: at, to: at, cause });
        if (holder && !holder.down) { this.gain(holder); return; }
        if (holder) { s.ball = { at: 'held', pid: holder.pid }; this.endWithBall(holder, 'tackle'); }
        return;
      }
      const chooser = d[0] > d[1] ? s.offense : this.defense; // die 0 is the offense's
      const opts = scatterOptions(s, at, n, air);
      const pick = opts.length === 1 ? opts[0]
        : await this.askValid(chooser, { type: 'scatter', from: at, n, options: opts }, (v) => (opts.some((o) => same(o.to, v?.to) && !!o.out === !!v?.out) ? null : 'pick a scatter square'), () => opts[0]);
      this.log(`Scatter dice ${d[0]} - ${d[1]}: the ball goes ${n}${pick.out ? ' and OUT of bounds' : ''}.`, 'scatter', { dice: d, sides: [s.offense, this.defense], n, from: at, to: pick.to, out: !!pick.out, cause });
      if (pick.out) throw new PlayEnd('incomplete', { why: 'out of bounds' });
      at = pick.to;
      const occ = occupant(s, ...at);
      if (!occ) { s.ball = { at: air ? 'air' : 'ground', col: at[0], row: at[1] }; this.ballMoved(); return; }
      if (!occ.down && this.sportCheck(occ, `It comes right to ${this.name(occ)}`)) {
        this.earn(occ.side, 1, 'grabbed the loose ball');
        if (air && occ.side !== s.offense && s.play.lastPasser) this.fireOut(s.players[s.play.lastPasser], 'threw an interception');
        this.gain(occ);
        return;
      }
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
      this.earn(info.side, 1, 'a safety');
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
