// Plays bot-vs-bot games with the real engine and checks the rules hold up.
//   node tools/simulate.mjs [games=200] [firstSeed=1] [mode] [rules=techno]
//   mode: (none or -) = simple bot vs bot · passive = side 0 never acts unless it must · allpro:starter = AI level vs level
//         (levels swap sides every game; the win rates per level are printed)
//   rules: techno · alltechno · pro · allpro · inferno
// Must print `errors: 0`. Any crash prints its seed so the game can be replayed exactly.
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/game.js';
import { makeBot, makePassive } from '../src/engine/bot.js';
import { makeAI } from '../src/engine/ai.js';
import { playerList } from '../src/engine/rules.js';

const TEAMS = JSON.parse(readFileSync(new URL('../src/data/teams.json', import.meta.url), 'utf8'));
const N = Number(process.argv[2] ?? 200);
const SEED0 = Number(process.argv[3] ?? 1);
const MODE = process.argv[4] === '-' ? '' : process.argv[4] ?? '';
const RULES = process.argv[5] ?? 'techno';
const PASSIVE = MODE === 'passive';
const LADDER = MODE.includes(':') ? MODE.split(':') : null;
const wins = {};

const tally = { maxActs: 0, games: 0, errors: 0, ties: 0, overtime: 0, points: 0, tds: 0, safeties: 0, downs: 0, activations: 0, checks: 0, passes: 0, catches: 0,
  turnovers: 0, sacks: 0, fumbles: 0, pressure: 0, stalls: 0, botFixes: 0, invariant: 0, fieldGoals: 0, kicks: 0, onFire: 0, fireTokens: 0, skills: 0 };
const SKILL_LOG = ['dodge', 'intercept', 'stiffarm', 'spin', 'heat', 'dogpile', 'fuego', 'firebomb'];
const fails = [];
const fixedBy = {};

function invariants(g, where) {
  const s = g.state;
  const seen = new Set();
  for (const p of playerList(s)) {
    if (p.col == null) continue;
    const k = `${p.col},${p.row}`;
    if (seen.has(k)) throw new Error(`two players on ${k} (${where})`);
    if (p.col < 0 || p.col > 12 || p.row < 0 || p.row > 23) throw new Error(`${p.pid} off the board (${where})`);
    seen.add(k);
  }
  for (const side of [0, 1]) {
    const c = s.cards[side];
    const n = c.bench.length + c.stack.length + c.discard.length + (s.faceUp[side] != null ? 1 : 0);
    if (n > g.roster(side).length * 2) throw new Error(`side ${side} has ${n} cards (${where})`);
  }
  if (s.ball.at === 'held' && !s.players[s.ball.pid]) throw new Error('ball held by nobody');
}

for (let i = 0; i < N; i++) {
  const seed = SEED0 + i;
  const pick = (k) => TEAMS[(seed * 7 + k * 13) % TEAMS.length];
  const a = pick(0), b = pick(1) === a ? pick(2) : pick(1);
  const teams = [a, b].map((t) => ({ id: t.id, name: t.name, uniform: 'home', roster: t.players.map((p) => ({ num: p.num, name: p.name, abilities: p.abilities })) }));
  let lastScore = [0, 0];
  const g = new Game({ teams, seed, mode: RULES, agents: LADDER ? (i % 2 ? [makeAI(LADDER[1]), makeAI(LADDER[0])] : [makeAI(LADDER[0]), makeAI(LADDER[1])]) : [PASSIVE ? makePassive() : makeBot(), makeBot()] }, {
    onChange: (st) => {
      const last = st.log[st.log.length - 1];
      if (!last || last.seen) return;
      last.seen = true;
      if (last.kind === 'move' || last.kind === 'push' || last.kind === 'formation') invariants(g, last.kind);
      if (last.kind === 'check' && last.action === 'pass') tally.passes++;
      if (last.kind === 'catch') tally.catches++;
      if (last.kind === 'turnover') tally.turnovers++;
      if (last.kind === 'sack') tally.sacks++;
      if (last.kind === 'fumble') tally.fumbles++;
      if (last.kind === 'pressure') tally.pressure++;
      if (last.kind === 'kick') tally.kicks++;
      if (last.kind === 'fieldgoal') tally.fieldGoals++;
      if (last.kind === 'onfire') tally.onFire++;
      if (last.kind === 'fire') tally.fireTokens += last.n;
      if (SKILL_LOG.includes(last.kind) || (last.kind === 'check' && ['shove', 'juke', 'shake', 'dirty'].includes(last.action))) tally.skills++;
      for (const side of [0, 1]) if (st.fire[side] < 0 || st.fire[side] > 3) throw new Error(`fire tokens out of range: ${st.fire[side]}`);
      if (g.roster(0).filter((p) => p.onFire).length > 3 || g.roster(1).filter((p) => p.onFire).length > 3) throw new Error('more than 3 on fire');
      const d = [st.score[0] - lastScore[0], st.score[1] - lastScore[1]];
      for (const x of d) if (x && x !== 7 && x !== 2 && x !== 3) throw new Error(`score jumped by ${x}`);
      if (d.includes(3) && !g.rules.fieldGoals) throw new Error('a field goal outside PRO');
      if (last.kind === 'td') tally.tds++;
      tally.maxActs = Math.max(tally.maxActs, st.play?.activations ?? 0);
      if (last.kind === 'safety') tally.safeties++;
      lastScore = [...st.score];
    },
  });
  try {
    const t0 = Date.now();
    const end = await Promise.race([g.run(), new Promise((_, rej) => setTimeout(() => rej(new Error('timed out')), 20000))]);
    tally.games++;
    tally.points += end.score[0] + end.score[1];
    if (end.winner == null) tally.ties++;
    if (LADDER && end.winner != null) { const lv = LADDER[(end.winner + i) % 2]; wins[lv] = (wins[lv] ?? 0) + 1; }
    if (end.overtime) tally.overtime++;
    for (const k of ['downs', 'activations', 'checks', 'stalls', 'botFixes']) tally[k] += g.stats[k];
    for (const [k, v] of Object.entries(g.stats.fixedBy)) fixedBy[k] = (fixedBy[k] ?? 0) + v;
    if (Date.now() - t0 > 5000) console.log(`seed ${seed}: slow (${Date.now() - t0} ms)`);
  } catch (e) {
    tally.errors++;
    g.stopped = true;
    fails.push(`seed ${seed}: ${e.stack?.split('\n').slice(0, 4).join(' | ')}`);
  }
}

const per = (k) => (tally[k] / Math.max(1, tally.games)).toFixed(2);
console.log(`games: ${tally.games}/${N}  points/game: ${per('points')}  TDs/game: ${per('tds')}  safeties: ${tally.safeties}  ties: ${tally.ties}  overtime: ${tally.overtime}`);
console.log(`downs/game: ${per('downs')}  activations/down: ${(tally.activations / Math.max(1, tally.downs)).toFixed(1)}  checks/game: ${per('checks')}`);
console.log(`passes: ${tally.passes} (caught ${tally.catches})  turnovers: ${tally.turnovers}  fumbles: ${tally.fumbles}  pressure: ${tally.pressure}  sacks: ${tally.sacks}`);
console.log(`most activations in one down: ${tally.maxActs}`);
if (RULES !== 'techno') console.log(`rules: ${RULES}  field goals: ${tally.fieldGoals}/${tally.kicks}  on fire: ${tally.onFire}  fire tokens earned: ${tally.fireTokens}  skill moments: ${tally.skills}`);
if (LADDER) console.log(`wins: ${LADDER.map((l) => `${l} ${wins[l] ?? 0} (${Math.round(100 * (wins[l] ?? 0) / Math.max(1, tally.games))}%)`).join(' · ')}`);
console.log(`bot answers fixed by fallback: ${tally.botFixes} ${JSON.stringify(fixedBy)}  stalled downs: ${tally.stalls}`);
for (const f of fails.slice(0, 8)) console.log(f);
console.log(`errors: ${tally.errors}`);
process.exit(tally.errors ? 1 : 0);
