// The players, in the game: both rosters with every special ability spelled out, ability players first. Tap a player
// to ring him on the field and point the camera at him. (Key P, or the Players button in the tools.)
import { useEffect, useMemo, useState } from 'react';
import { Sprite } from './TeamPicker';
import { Chips, Toggle } from './ui';
import { abilityText } from '../data/abilities';
import { artRows } from '../data/art';

// what a player can use in this game: his abilities (INFERNO ones only in INFERNO), plus EN FUEGO / ON FIRE extras
export function playerSkills(s, p) {
  const own = (p.abilities ?? []).filter((a) => s.inferno || !a.startsWith('INFERNO'));
  return [...own, ...(p.fuego ? [p.fuego] : []), ...(p.onFire && p.fireSkill && !own.includes(p.fireSkill) ? [p.fireSkill] : [])];
}

function status(s, p) {
  const out = [];
  if (s.ball.at === 'held' && s.ball.pid === p.pid) out.push(['ball', 'Ball']);
  if (s.active?.pid === p.pid) out.push(['up', 'Up now']);
  if (p.down) out.push(['down', 'Down']);
  if (p.onFire) out.push(['fire', 'On fire']);
  if (p.fuego) out.push(['fire', `En fuego: ${p.fuego}`]);
  return out;
}

export default function TeamDrawer({ s, me, oppName, spot, setSpot, onClose }) {
  const [side, setSide] = useState(me);
  const [all, setAll] = useState(false);
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onClose]);
  const rows = useMemo(() => artRows(s, side), [s.teams, side]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = s.teams[side];
  const roster = Object.values(s.players).filter((p) => p.side === side)
    .map((p) => ({ p, skills: playerSkills(s, p) }))
    .sort((a, b) => (b.skills.length > 0) - (a.skills.length > 0) || a.p.num - b.p.num);
  const list = all ? roster : roster.filter((r) => r.skills.length);
  return (
    <aside className="drawer team-drawer glass" role="dialog" aria-label="Players">
      <header className="drawer-head"><h2>Players</h2><button className="btn small" onClick={onClose}>Close</button></header>
      <Chips small value={side} onChange={(v) => { setSide(v); setSpot(null); }} options={[[me, `You · ${s.teams[me].name}`], [1 - me, `${oppName} · ${s.teams[1 - me].name}`]]} />
      {!s.skills && <p className="hint">Abilities are off in this rules mode: they only count in All Techno, All Pro and Inferno.</p>}
      <ul className="roster">
        {list.map(({ p, skills }) => (
          <li key={p.pid}>
            <button className={`roster-row ${spot === p.pid ? 'on' : ''} ${p.col == null ? 'off' : ''}`} onClick={() => setSpot(spot === p.pid ? null : p.pid)}
              title={p.col == null ? 'Not on the field' : 'Show him on the field'}>
              <Sprite team={t.id} uni={t.uniform} row={rows[p.num] ?? 0} />
              <span className="roster-main">
                <span className="roster-name"><b>#{p.num} {p.name}</b><small>Skill {p.skill}</small>
                  {status(s, p).map(([k, l]) => <em key={l} className={`roster-tag ${k}`}>{l}</em>)}</span>
                {skills.map((a) => <span key={a} className="roster-ab"><b>{a}</b>{abilityText(a)}</span>)}
                {!skills.length && <span className="muted">No special abilities</span>}
              </span>
            </button>
          </li>
        ))}
        {!list.length && <li className="muted">No ability players on this team.</li>}
      </ul>
      <footer className="drawer-foot"><Toggle checked={all} onChange={setAll}>Show every player</Toggle></footer>
    </aside>
  );
}

// hovering a cube on the field (computers): who he is and what he can do, without opening the drawer
export function PlayerTag({ s, p }) {
  if (!p) return null;
  const skills = s.skills ? playerSkills(s, p) : [];
  return (
    <div className="player-tag glass" aria-hidden="true">
      <b>#{p.num} {p.name}</b><small>{s.teams[p.side].name} · skill {p.skill}</small>
      {skills.map((a) => <span key={a}><b>{a}</b> {abilityText(a)}</span>)}
    </div>
  );
}
