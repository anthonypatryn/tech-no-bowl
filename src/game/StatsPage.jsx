// ?view=stats: your career on this device. Record (wins, losses, points, by team, recent games), player totals (pick
// the stat to rank by), and the current season's player stats.
import { useState } from 'react';
import { Button, Chips, Panel, useConfirm } from './ui';
import { teamById, helmetUrl } from '../data/art';
import { loadStats, clearStats, STAT_COLS } from './stats';
import { loadSeason } from './season';

const name = (id) => teamById(id)?.name ?? id;
const Helmet = ({ id }) => { const u = helmetUrl(id, true); return u ? <img className="stats-helmet" src={u} alt="" /> : null; };
const rec = (r) => `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;

export default function StatsPage() {
  const [tab, setTab] = useState('record');
  const [by, setBy] = useState('rushYds');
  const [stats, setStats] = useState(loadStats);
  const [confirmIt, dialog] = useConfirm();
  const season = loadSeason();
  const all = Object.values(stats.teams).reduce((a, r) => ({ g: a.g + r.g, w: a.w + r.w, l: a.l + r.l, t: a.t + r.t, pf: a.pf + r.pf, pa: a.pa + r.pa }), { g: 0, w: 0, l: 0, t: 0, pf: 0, pa: 0 });
  const players = Object.values(stats.players).sort((a, b) => (b[by] ?? 0) - (a[by] ?? 0)).slice(0, 25);
  const seasonRows = season?.stats ? Object.entries(season.stats).map(([num, r]) => ({ num, ...r })).sort((a, b) => (b[by] ?? 0) - (a[by] ?? 0)) : [];
  return (
    <main className="page stats-page">
      <h1 className="page-title">Stats</h1>
      <Chips value={tab} onChange={setTab} options={[['record', 'Record'], ['players', 'Players'], ['season', 'Season']]} />
      {tab === 'record' && (
        <>
          <Panel className="stats-summary">
            <div><b className="led">{rec(all)}</b><small>wins - losses{all.t ? ' - ties' : ''}</small></div>
            <div><b className="led">{all.g}</b><small>games</small></div>
            <div><b className="led">{all.pf}</b><small>points for</small></div>
            <div><b className="led">{all.pa}</b><small>points against</small></div>
          </Panel>
          {!all.g && <p className="hint">Finish a game and it shows up here: every game vs the computer, season games and online games.</p>}
          {all.g > 0 && (
            <Panel>
              <h3>By team</h3>
              <table className="checks stats-table">
                <thead><tr><th>Team</th><th>G</th><th>W-L-T</th><th>PF</th><th>PA</th></tr></thead>
                <tbody>{Object.entries(stats.teams).sort(([, a], [, b]) => b.g - a.g).map(([id, r]) => (
                  <tr key={id}><td><Helmet id={id} /> {name(id)}</td><td>{r.g}</td><td>{rec(r)}</td><td>{r.pf}</td><td>{r.pa}</td></tr>
                ))}</tbody>
              </table>
              <h3>Recent games</h3>
              <table className="checks stats-table">
                <tbody>{[...stats.games].reverse().slice(0, 12).map((g) => (
                  <tr key={g.seed} className={g.result === 'W' ? 'win' : g.result === 'L' ? 'loss' : ''}>
                    <td><b>{g.result}</b> {g.us}-{g.them}</td><td><Helmet id={g.team} /> {name(g.team)} vs <Helmet id={g.opp} /> {name(g.opp)}</td>
                    <td className="muted">{g.online ? 'online' : g.season ? 'season' : g.level}</td><td className="muted">{new Date(g.at).toLocaleDateString()}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Panel>
          )}
        </>
      )}
      {(tab === 'players' || tab === 'season') && (
        <Panel>
          <div className="stats-by"><span className="muted">Rank by</span><Chips small value={by} onChange={setBy} options={STAT_COLS.map(([k, l]) => [k, l])} /></div>
          {tab === 'players' && (players.length ? (
            <table className="checks stats-table">
              <thead><tr><th>Player</th><th>G</th>{STAT_COLS.map(([k, l]) => <th key={k} className={k === by ? 'on' : ''}>{l}</th>)}</tr></thead>
              <tbody>{players.map((p) => (
                <tr key={`${p.team}${p.num}`}><td><Helmet id={p.team} /> #{p.num} {p.name}</td><td>{p.games}</td>{STAT_COLS.map(([k]) => <td key={k} className={k === by ? 'on' : ''}>{p[k] ?? 0}</td>)}</tr>
              ))}</tbody>
            </table>
          ) : <p className="hint">No games yet.</p>)}
          {tab === 'season' && (seasonRows.length ? (
            <>
              <p className="hint">{name(season.team)}, this season ({season.phase === 'regular' ? `week ${Math.min(season.week + 1, season.weeks)} of ${season.weeks}` : season.phase}).</p>
              <table className="checks stats-table">
                <thead><tr><th>Player</th><th>G</th>{STAT_COLS.filter(([k]) => k in (seasonRows[0] ?? {})).map(([k, l]) => <th key={k} className={k === by ? 'on' : ''}>{l}</th>)}</tr></thead>
                <tbody>{seasonRows.map((p) => (
                  <tr key={p.num}><td><Helmet id={season.team} /> #{p.num} {p.name}</td><td>{p.games}</td>{STAT_COLS.filter(([k]) => k in seasonRows[0]).map(([k]) => <td key={k} className={k === by ? 'on' : ''}>{p[k] ?? 0}</td>)}</tr>
                ))}</tbody>
              </table>
            </>
          ) : <p className="hint">{season ? 'No season games played yet.' : 'No season going. Start one from Season.'}</p>)}
        </Panel>
      )}
      <div className="btns"><Button size="small" kind="danger" onClick={async () => { if (await confirmIt({ title: 'Clear your career stats?', body: 'Your record and player totals on this device go back to zero. Seasons are kept.', yes: 'Clear', danger: true })) { clearStats(); setStats(loadStats()); } }}>Clear career stats</Button></div>
      {dialog}
    </main>
  );
}
