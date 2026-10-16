// Career stats on this device: every finished game you coached (vs the computer, a season game or online), your
// record by team, and your players' totals. localStorage (`tb-stats`); the season keeps its own stats too.
const KEY = 'tb-stats';
const FIELDS = ['rushYds', 'carries', 'passYds', 'comp', 'att', 'rec', 'recYds', 'tds', 'tackles', 'sacks', 'fumbles'];
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') ?? { games: [], teams: {}, players: {} }; } catch { return { games: [], teams: {}, players: {} }; } };
export const loadStats = read;
export const clearStats = () => { try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ } };

// a finished game, from the side you coached (me). Counts once per seed.
export function recordGameStats(s, me, { seed, mode, level, season, online } = {}) {
  try {
    const all = read();
    if (all.games.some((g) => g.seed === seed)) return;
    const you = s.teams[me], them = s.teams[1 - me];
    const us = s.score[me], op = s.score[1 - me];
    const result = us > op ? 'W' : us < op ? 'L' : 'T';
    all.games = [...all.games, { seed, at: Date.now(), team: you.id, opp: them.id, us, them: op, result, mode, level, season: !!season, online: !!online }].slice(-300);
    const t = (all.teams[you.id] ??= { g: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 });
    t.g++; t.pf += us; t.pa += op;
    if (result === 'W') t.w++; else if (result === 'L') t.l++; else t.t++;
    for (const [pid, b] of Object.entries(s.box ?? {})) {
      const p = s.players[pid];
      if (!p || p.side !== me) continue;
      const k = `${you.id}:${p.num}`;
      const row = (all.players[k] ??= { team: you.id, num: p.num, name: p.name, games: 0 });
      row.games++;
      for (const f of FIELDS) row[f] = (row[f] ?? 0) + (b[f] ?? 0);
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* not saved */ }
}

export const STAT_COLS = [['rushYds', 'Rush yds'], ['carries', 'Carries'], ['passYds', 'Pass yds'], ['comp', 'Comp'], ['att', 'Att'], ['recYds', 'Rec yds'], ['rec', 'Catches'], ['tds', 'TDs'], ['tackles', 'Tackles'], ['sacks', 'Sacks'], ['fumbles', 'Fumbles']];
