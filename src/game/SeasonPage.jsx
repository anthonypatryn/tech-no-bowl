// ?view=season — set up a season, see the schedule, standings and playoff bracket, and play your next game.
import { useState } from 'react';
import { Button, Chips, Panel, Row } from './ui';
import { TEAMS, teamById, uniformsFor, teamColors, helmetUrl } from '../data/art';
import { LEVELS } from '../engine/ai.js';
import { altSlots } from '../data/abilities';
import { loadSeason, newSeason, endSeason, nextGame, standings, oppUniform } from './season';
import { useConfirm } from './ui';

const name = (id) => teamById(id)?.name ?? id;
function Helmet({ id, size = 40, flip }) {
  const u = helmetUrl(id);
  return u ? <img className="season-helmet" src={u} alt="" style={{ height: size, transform: flip ? 'scaleX(-1)' : undefined }} /> : null;
}

export default function SeasonPage({ onPlay }) {
  const [season, setSeason] = useState(loadSeason);
  const [confirmIt, dialog] = useConfirm();
  if (!season) return <main className="page season"><h1 className="page-title">Season</h1><Setup onStart={(cfg) => setSeason(newSeason(cfg))} />{dialog}</main>;
  const next = nextGame(season);
  const table = standings(season);
  const me = season.table[season.team];
  const [c0] = teamColors(season.team, season.uni);
  const play = () => onPlay({
    you: { team: season.team, uni: season.uni, picks: season.picks }, cpu: { team: next.opp, uni: oppUniform(season, next.opp), picks: {} },
    level: season.level, mode: 'techno', seed: Date.now(), season: { round: next.round, label: next.label },
  });
  return (
    <main className="page season">
      <h1 className="page-title">Season</h1>
      <Panel className="season-head" style={{ '--c0': c0 }}>
        <Helmet id={season.team} size={80} />
        <div>
          <h2>{name(season.team).toUpperCase()}</h2>
          <p className="led">{me.w}-{me.l}{me.t ? `-${me.t}` : ''}</p>
          <small className="muted">{season.phase === 'regular' ? `Week ${Math.min(season.week + 1, season.weeks)} of ${season.weeks}` : season.phase === 'playoffs' ? 'Playoffs' : 'Season over'}</small>
        </div>
        <div className="season-next">
          {season.champion && <p className="led big-ish">{season.champion === season.team ? 'TECHNO BOWL CHAMPIONS!' : `${name(season.champion).toUpperCase()} WIN THE TECHNO BOWL`}</p>}
          {season.missed && !season.champion && <p className="warn">You missed the playoffs. The bracket plays on without you.</p>}
          {next && <Button kind="primary" size="big" onClick={play}>{next.label}: vs {name(next.opp)}</Button>}
          <Button size="small" onClick={async () => { if (await confirmIt({ title: 'End this season?', body: 'Its schedule and standings will be lost.', yes: 'End season', danger: true })) { endSeason(); setSeason(null); } }}>{season.champion ? 'New season' : 'Abandon season'}</Button>
        </div>
      </Panel>
      <div className="season-grid">
        <Panel>
          <h3>Schedule</h3>
          <ol className="schedule">
            {season.schedule.map((g, i) => (
              <li key={i} className={g.us == null ? (i === season.week ? 'next' : '') : g.us > g.them ? 'win' : g.us < g.them ? 'loss' : 'tie'}>
                <span>Wk {i + 1}</span><Helmet id={g.opp} size={26} flip /><b>{name(g.opp)}</b>
                <em>{g.us == null ? (i === season.week ? 'next' : '') : `${g.us > g.them ? 'W' : g.us < g.them ? 'L' : 'T'} ${g.us}-${g.them}`}</em>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel>
          <h3>Standings</h3>
          <table className="checks standings">
            <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>T</th><th>PF</th><th>PA</th></tr></thead>
            <tbody>{table.map((r, i) => (
              <tr key={r.id} className={`${r.id === season.team ? 'me' : ''} ${i === 7 ? 'cut' : ''}`}><td>{i + 1}</td><td><Helmet id={r.id} size={20} flip /> {name(r.id)}</td><td>{r.w}</td><td>{r.l}</td><td>{r.t}</td><td>{r.pf}</td><td>{r.pa}</td></tr>
            ))}</tbody>
          </table>
          <p className="hint">The top 8 make the playoffs.</p>
        </Panel>
      </div>
      {season.bracket && <Bracket season={season} />}
      {dialog}
    </main>
  );
}

function Bracket({ season }) {
  return (
    <Panel className="bracket-panel">
      <h3>Playoffs</h3>
      <div className="bracket">
        {season.bracket.rounds.map((r) => (
          <div key={r.name} className="bracket-round">
            <h4>{r.name}</h4>
            {r.games.map((m, i) => (
              <div key={i} className="bracket-game">
                {[['a', 'sa'], ['b', 'sb']].map(([k, sk]) => (
                  <div key={k} className={`bk-team ${m.winner === m[k] ? 'won' : m.winner ? 'lost' : ''} ${m[k] === season.team ? 'me' : ''}`}>
                    <Helmet id={m[k]} size={22} flip /><span>{name(m[k])}</span><b>{m[sk] ?? ''}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        {season.champion && <div className="bracket-round"><h4>Champion</h4><div className="bracket-game champ"><Helmet id={season.champion} size={60} /><b>{name(season.champion)}</b></div></div>}
      </div>
    </Panel>
  );
}

function Setup({ onStart }) {
  const [team, setTeam] = useState('bighorns');
  const [uni, setUni] = useState('home');
  const [level, setLevel] = useState('starter');
  const [weeks, setWeeks] = useState(7);
  const t = teamById(team);
  return (
    <Panel className="season-setup">
      <p>Play a schedule against the league, climb the standings, make the top 8 and win the Techno Bowl.</p>
      <div className="ts-grid">
        {TEAMS.map((x) => {
          const [c0] = teamColors(x.id, 'home');
          return <button key={x.id} className={`ts-grid-tile ${x.id === team ? 'on' : ''}`} style={{ '--c0': c0 }} onClick={() => { setTeam(x.id); setUni('home'); }}><Helmet id={x.id} size={56} /><small>{x.name}</small></button>;
        })}
      </div>
      <Row label="Team"><b className="led">{t.name.toUpperCase()}</b>{altSlots(t).length > 0 && <span className="hint"> (alternate players: pick them on the team screen in a normal game)</span>}</Row>
      <Row label="Uniform"><Chips small value={uni} onChange={setUni} options={uniformsFor(team).map((u) => [u.id, u.label])} /></Row>
      <Row label="Computer"><Chips small value={level} onChange={setLevel} options={LEVELS} /></Row>
      <Row label="Length"><Chips small value={weeks} onChange={setWeeks} options={[[4, '4 games'], [7, '7 games'], [10, '10 games']]} /></Row>
      <div className="btns"><Button kind="primary" size="big" onClick={() => onStart({ team, uni, level, weeks })}>Start the season</Button></div>
    </Panel>
  );
}
