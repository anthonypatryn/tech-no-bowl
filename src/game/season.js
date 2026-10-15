// A season: you play a schedule; every other team's game that week is simulated from roster strength. The top 8 make
// the playoffs (quarterfinal, semifinal, the Techno Bowl). Saved on this device.
import { TEAMS, uniformsFor } from '../data/art';

const KEY = 'tb-season';
export const loadSeason = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
const store = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not saved */ } return s; };
export const endSeason = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };

const shuffle = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
// how good a roster is on paper: skill ratings plus a little for every special ability
const strength = (id) => { const t = TEAMS.find((x) => x.id === id); return t.players.filter((p) => p.num !== 51).reduce((n, p) => n + p.skill + (p.abilities?.length ?? 0) * 0.6, 0); };
// a simulated score: touchdowns (and the odd safety) from the strength gap plus luck; ties go to an overtime TD
function simGame(a, b) {
  const edge = (strength(a) - strength(b)) / 12;
  const tds = (e) => Math.max(0, Math.round(1.6 + e + (Math.random() - 0.5) * 2.6));
  let sa = tds(edge) * 7 + (Math.random() < 0.07 ? 2 : 0), sb = tds(-edge) * 7 + (Math.random() < 0.07 ? 2 : 0);
  if (sa === sb) { if (Math.random() < 0.5 + edge / 4) sa += 7; else sb += 7; }
  return [sa, sb];
}

export function newSeason({ team, uni, picks, level, weeks }) {
  const opps = shuffle(TEAMS.map((t) => t.id).filter((id) => id !== team)).slice(0, weeks);
  const table = Object.fromEntries(TEAMS.map((t) => [t.id, { w: 0, l: 0, t: 0, pf: 0, pa: 0 }]));
  return store({ team, uni, picks: picks ?? {}, level, weeks, week: 0, schedule: opps.map((opp) => ({ opp, us: null, them: null })), table, phase: 'regular', bracket: null, champion: null, seed: Date.now() });
}

function record(table, a, b, sa, sb) {
  table[a].pf += sa; table[a].pa += sb; table[b].pf += sb; table[b].pa += sa;
  if (sa > sb) { table[a].w++; table[b].l++; } else if (sb > sa) { table[b].w++; table[a].l++; } else { table[a].t++; table[b].t++; }
}

export const standings = (s) => Object.entries(s.table)
  .map(([id, r]) => ({ id, ...r, pct: (r.w + r.t / 2) / Math.max(1, r.w + r.l + r.t), diff: r.pf - r.pa }))
  .sort((x, y) => y.pct - x.pct || y.diff - x.diff || y.pf - x.pf);

// the uniform for an opponent: home, or the first other uniform if it would clash with yours
export function oppUniform(s, opp) {
  const list = uniformsFor(opp);
  return list.find((u) => !(opp === s.team && u.id === s.uni))?.id ?? 'home';
}

// the game you play next (or null): { opp, label, round }
export function nextGame(s) {
  if (!s || s.champion) return null;
  if (s.phase === 'regular') { const g = s.schedule[s.week]; return g && { opp: g.opp, label: `Week ${s.week + 1}`, round: 'regular' }; }
  const r = s.bracket?.rounds.at(-1);
  const m = r?.games.find((g) => (g.a === s.team || g.b === s.team) && g.winner == null);
  return m && { opp: m.a === s.team ? m.b : m.a, label: r.name, round: r.name };
}

// your result is in: record it, simulate the rest of the round, move the season on
export function reportResult(s, us, them) {
  s = structuredClone(s);
  if (s.phase === 'regular') {
    const g = s.schedule[s.week];
    g.us = us; g.them = them;
    record(s.table, s.team, g.opp, us, them);
    // everyone else this week, paired at random
    const rest = shuffle(TEAMS.map((t) => t.id).filter((id) => id !== s.team && id !== g.opp));
    for (let i = 0; i + 1 < rest.length; i += 2) { const [a, b] = simGame(rest[i], rest[i + 1]); record(s.table, rest[i], rest[i + 1], a, b); }
    s.week++;
    if (s.week >= s.weeks) startPlayoffs(s);
  } else {
    const r = s.bracket.rounds.at(-1);
    const m = r.games.find((x) => (x.a === s.team || x.b === s.team) && x.winner == null);
    if (m) { m.sa = m.a === s.team ? us : them; m.sb = m.a === s.team ? them : us; m.winner = m.sa > m.sb ? m.a : m.b; }
    finishRound(s);
  }
  return store(s);
}

const ROUND_NAMES = ['Quarterfinal', 'Semifinal', 'Techno Bowl'];
function startPlayoffs(s) {
  s.phase = 'playoffs';
  const top = standings(s).slice(0, 8).map((x) => x.id);
  s.bracket = { seeds: top, rounds: [{ name: ROUND_NAMES[0], games: [[0, 7], [3, 4], [2, 5], [1, 6]].map(([i, j]) => ({ a: top[i], b: top[j], winner: null })) }] };
  if (!top.includes(s.team)) s.missed = true;
  finishRound(s);
}
// simulate every game in the round that isn't yours; when the round is done, build the next one (or crown a champion)
function finishRound(s) {
  for (;;) {
    const r = s.bracket.rounds.at(-1);
    for (const m of r.games) {
      if (m.winner != null || m.a === s.team || m.b === s.team) continue;
      const [a, b] = simGame(m.a, m.b);
      m.sa = a; m.sb = b; m.winner = a > b ? m.a : m.b;
    }
    if (r.games.some((m) => m.winner == null)) return; // waiting on your game
    if (r.games.length === 1) { s.champion = r.games[0].winner; s.phase = 'done'; return; }
    const winners = r.games.map((m) => m.winner);
    const games = [];
    for (let i = 0; i < winners.length; i += 2) games.push({ a: winners[i], b: winners[i + 1], winner: null });
    s.bracket.rounds.push({ name: ROUND_NAMES[s.bracket.rounds.length], games });
  }
}
