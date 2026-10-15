import { useState } from 'react';
import { Chips } from './ui';
import { TEAMS, teamById, uniformsFor, uniformOf, rosterFor, artUrl } from '../data/art';
import { Stage } from '../three/Stage';
import { Lights } from '../three/Field';
import { PlayerCube } from '../three/Cube';

import { LEVELS } from '../engine/ai.js';
export const MODES = [['techno', 'Techno'], ['alltechno', 'All Techno', true], ['pro', 'Pro', true], ['allpro', 'All Pro', true], ['inferno', 'Inferno!', true]];

const pick = (not) => { let t; do { t = TEAMS[Math.floor(Math.random() * TEAMS.length)].id; } while (t === not); return t; };

// Team + uniform for you and the computer, difficulty, rules mode.
export default function TeamPicker({ onStart }) {
  const [you, setYou] = useState({ team: 'bighorns', uni: 'home' });
  const [cpu, setCpu] = useState(() => ({ team: pick('bighorns'), uni: 'home' }));
  const [level, setLevel] = useState('starter');
  const [mode, setMode] = useState('techno');
  const clash = you.team === cpu.team && you.uni === cpu.uni;
  return (
    <main className="page picker">
      <h1 className="page-title">Pick your teams</h1>
      <div className="picker-cols">
        <Side title="You" sel={you} onSel={setYou} />
        <Side title="Computer" sel={cpu} onSel={setCpu} random={() => setCpu({ team: pick(you.team), uni: 'home' })} />
      </div>
      <section className="glass picker-opts">
        <div className="opt"><span>Difficulty</span><Chips value={level} onChange={setLevel} options={LEVELS} /></div>
        <div className="opt"><span>Rules</span><Chips value={mode} onChange={setMode} options={MODES} /></div>
        <p className="hint">Rookie makes mistakes. Starter plays the odds. All-Pro manages cards, the clock and coverage. Techno = 7-vs-7, no skills, no field goals; the other modes unlock in later batches.</p>
        {clash && <p className="warn">Same team in the same uniform: pick a different uniform for one side.</p>}
        <button className="btn primary big" disabled={clash} onClick={() => onStart({ you, cpu, level, mode })}>Take the field</button>
      </section>
    </main>
  );
}

function Side({ title, sel, onSel, random }) {
  const team = teamById(sel.team);
  const unis = uniformsFor(sel.team);
  return (
    <section className="glass side">
      <header className="side-head">
        <h2>{title}: <span className="led">{team.name.toUpperCase()}</span></h2>
        {random && <button className="btn small" onClick={random}>Random</button>}
      </header>
      <div className="team-grid" role="radiogroup" aria-label={`${title} team`}>
        {TEAMS.map((t) => (
          <button key={t.id} role="radio" aria-checked={t.id === sel.team} className={`team-tile ${t.id === sel.team ? 'on' : ''}`}
            title={t.name} onClick={() => onSel({ team: t.id, uni: 'home' })}>
            <Sprite team={t.id} uni="home" />
            <small>{t.name}</small>
          </button>
        ))}
      </div>
      <div className="opt"><span>Uniform</span><Chips small value={sel.uni} onChange={(u) => onSel({ ...sel, uni: u })} options={unis.map((u) => [u.id, u.label])} /></div>
      <Stage className="side-stage" camera={{ position: [0, 1.3, 4.2], fov: 35 }}>
        <Lights />
        <Lineup team={sel.team} uni={sel.uni} />
      </Stage>
      <p className="hint">{team.notes}</p>
    </section>
  );
}

function Lineup({ team, uni }) {
  const u = uniformOf(team, uni);
  const roster = rosterFor(team, uni).filter((p) => p.num !== 51);
  return (
    <group position={[0, -0.5, 0]}>
      {roster.map((p, i) => (
        <PlayerCube key={`${u.file}${p.row}`} uniform={u} row={p.row} size={0.42} position={[(i - (roster.length - 1) / 2) * 0.52, 0, 0]} facing={-0.35} />
      ))}
    </group>
  );
}

// a flat picture of a player (the front face) straight from the atlas: row = player, column 1 = front
export function Sprite({ team, uni, row = 0, face = 1 }) {
  const u = uniformOf(team, uni);
  if (!u) return null;
  const rows = u.count;
  return (
    <span className="sprite" style={{
      backgroundImage: `url(${artUrl(u.file)})`,
      backgroundSize: `${u.cols * 100}% ${rows * 100}%`,
      backgroundPosition: `${(face / (u.cols - 1)) * 100}% ${(row / (rows - 1)) * 100}%`,
    }} />
  );
}
