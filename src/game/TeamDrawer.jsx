// The players, in the game: both rosters as cards (the team select's look), ability players first with a gold edge.
// Tap a card for the full card (every ability spelled out) and to find him on the field. Key P, or Players in the
// tools; on phones it slides up from the bottom. Also: the hover tag over a cube, and the card pop-up used anywhere.
import { useEffect, useMemo, useState } from 'react';
import { Sprite } from './TeamPicker';
import { Button, Chips } from './ui';
import { abilityText } from '../data/abilities';
import { artRows, teamColors } from '../data/art';

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

const useEscape = (fn) => useEffect(() => {
  const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fn(); } };
  window.addEventListener('keydown', key, true);
  return () => window.removeEventListener('keydown', key, true);
}, [fn]);

// one player as a card in the drawer's grid
function MiniCard({ s, p, rows, onOpen, on }) {
  const t = s.teams[p.side];
  const skills = playerSkills(s, p);
  const tags = status(s, p);
  return (
    <button className={`ts-card pc-card ${skills.length ? 'skilled' : ''} ${on ? 'on' : ''} ${p.col == null ? 'off' : ''}`} style={{ '--c0': teamColors(t.id, t.uniform)[0] }} onClick={() => onOpen(p)}>
      <span className="ts-card-name">{p.name}</span>
      <span className="ts-card-art"><i>#{p.num}</i>{skills.length > 0 && <b className="pc-star">✦</b>}<Sprite team={t.id} uni={t.uniform} row={rows[p.num] ?? 0} /></span>
      <span className="ts-card-skill">{skills.length ? skills.join(' · ') : `Skill ${p.skill}`}</span>
      {tags.length > 0 && <span className="pc-tags">{tags.map(([k, l]) => <em key={l} className={`roster-tag ${k}`}>{l}</em>)}</span>}
    </button>
  );
}

// the full card: name, team, skill, status, every ability in words
export function PlayerCard({ s, p, onClose, onFind }) {
  useEscape(onClose);
  const t = s.teams[p.side];
  const skills = playerSkills(s, p);
  const tags = status(s, p);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card glass ability-card" style={{ '--c0': teamColors(t.id, t.uniform)[0] }} onClick={(e) => e.stopPropagation()}>
        <div className="pc-head">
          <Sprite team={t.id} uni={t.uniform} row={artRows(s, p.side)[p.num] ?? 0} />
          <div>
            <h2>#{p.num} {p.name}</h2><p className="hint">{t.name} · skill {p.skill}</p>
            {tags.length > 0 && <span className="pc-tags">{tags.map(([k, l]) => <em key={l} className={`roster-tag ${k}`}>{l}</em>)}</span>}
          </div>
        </div>
        {skills.length ? <ul>{skills.map((a) => <li key={a}><b>{a}</b><span>{abilityText(a)}</span></li>)}</ul> : <p className="muted">No special abilities.</p>}
        {!s.skills && skills.length > 0 && <p className="hint">Abilities only count in All Techno, All Pro and Inferno.</p>}
        <div className="btns">
          {onFind && p.col != null && <Button onClick={() => { onFind(p.pid); onClose(); }}>Show on the field</Button>}
          <Button kind="primary" onClick={onClose}>Got it</Button>
        </div>
      </div>
    </div>
  );
}

export default function TeamDrawer({ s, me, oppName, spot, setSpot, onClose }) {
  const [side, setSide] = useState(me);
  const [open, setOpen] = useState(null);
  useEscape(open ? () => {} : onClose);
  const rows = useMemo(() => artRows(s, side), [s.teams, side]); // eslint-disable-line react-hooks/exhaustive-deps
  const roster = Object.values(s.players).filter((p) => p.side === side).sort((a, b) => a.num - b.num);
  const stars = roster.filter((p) => playerSkills(s, p).length);
  const rest = roster.filter((p) => !playerSkills(s, p).length);
  return (
    <aside className="drawer team-drawer glass" role="dialog" aria-label="Players">
      <header className="drawer-head"><h2>Players</h2><Button size="small" onClick={onClose}>Close</Button></header>
      <Chips small value={side} onChange={(v) => { setSide(v); setSpot(null); }} options={[[me, `You · ${s.teams[me].name}`], [1 - me, `${oppName} · ${s.teams[1 - me].name}`]]} />
      <div className="pc-scroll">
        {!s.skills && <p className="hint">Abilities are off in this rules mode: they only count in All Techno, All Pro and Inferno.</p>}
        {stars.length > 0 && <h3>✦ Special abilities</h3>}
        <div className="pc-grid">{stars.map((p) => <MiniCard key={p.pid} s={s} p={p} rows={rows} on={spot === p.pid} onOpen={setOpen} />)}</div>
        {rest.length > 0 && <h3>Everyone else</h3>}
        <div className="pc-grid">{rest.map((p) => <MiniCard key={p.pid} s={s} p={p} rows={rows} on={spot === p.pid} onOpen={setOpen} />)}</div>
        <p className="hint">Tap a card for the full card. On the field, a gold gem over a cube = a special ability.</p>
      </div>
      {open && <PlayerCard s={s} p={s.players[open.pid] ?? open} onClose={() => setOpen(null)} onFind={setSpot} />}
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
