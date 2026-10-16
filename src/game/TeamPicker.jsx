// Team select, head-to-head style: each half in its team's colours with the helmet and logo, the players with special
// abilities down the outside (tap one to read what his abilities do), name and home/away at the bottom. Teams with
// alternate players ask who suits up when you pick them.
import { useEffect, useState } from 'react';
import { Button, Chips } from './ui';
import { TEAMS, teamById, uniformsFor, uniformOf, teamColors, artUrl, helmetUrl, rosterFor } from '../data/art';
import { abilityText, altSlots, lineup } from '../data/abilities';
import { LEVELS } from '../engine/ai.js';

export const MODES = [['techno', 'Techno'], ['alltechno', 'All Techno'], ['pro', 'Pro'], ['allpro', 'All Pro'], ['inferno', 'Inferno!']];
export const MODE_INFO = {
  techno: '7-vs-7, no special abilities. Learn the game here.',
  alltechno: '7-vs-7 with every special ability on.',
  pro: '8-vs-8 (#51 suits up) and field goals, no abilities.',
  allpro: '8-vs-8, field goals and every special ability.',
  inferno: 'All Techno plus fire tokens: ON FIRE, EN FUEGO, FIRE BOMB, BRING THE HEAT, dirty hits.',
  infernopro: 'All Pro plus fire tokens: 8-vs-8 (#51 suits up), field goals, ON FIRE, EN FUEGO, FIRE BOMB, BRING THE HEAT, dirty hits.',
};
export const modeName = (m) => (m === 'infernopro' ? 'Inferno! 8 v 8' : MODES.find(([k]) => k === m)?.[1] ?? m);

// the rules picker: the five modes, and for Inferno how many a side (7 like All Techno, or 8 like All Pro, rulebook p.19)
export function ModePicker({ value, onChange }) {
  const inferno = value === 'inferno' || value === 'infernopro';
  return (
    <span className="mode-picker">
      <Chips small value={inferno ? 'inferno' : value} onChange={(m) => onChange(m === 'inferno' && value === 'infernopro' ? value : m)} options={MODES} />
      {inferno && <Chips small value={value} onChange={onChange} options={[['inferno', '7 v 7'], ['infernopro', '8 v 8']]} />}
    </span>
  );
}

const idx = (id) => TEAMS.findIndex((t) => t.id === id);
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const randomTeam = (not) => { let t; do { t = TEAMS[Math.floor(Math.random() * TEAMS.length)].id; } while (t === not); return t; };

export default function TeamPicker({ onStart }) {
  const [you, setYou] = useState({ team: 'bighorns', uni: 'home', picks: {} });
  const [cpu, setCpu] = useState(() => ({ team: randomTeam('bighorns'), uni: 'home', picks: {} }));
  const [level, setLevel] = useState('starter');
  const [mode, setMode] = useState('techno');
  const [grid, setGrid] = useState(null);     // 'you' | 'cpu': the all-teams grid is open for that side
  const [info, setInfo] = useState(null);     // a player whose abilities are being read
  const [lineupFor, setLineupFor] = useState(null); // 'you' | 'cpu': choosing alternates
  const clash = you.team === cpu.team && you.uni === cpu.uni;
  const sides = { you: [you, setYou], cpu: [cpu, setCpu] };

  // picking a team from the grid asks about alternates; flipping through with the arrows doesn't (the Lineup button does)
  const pickTeam = (who, team, ask = true) => {
    const [, set] = sides[who];
    set({ team, uni: 'home', picks: {} });
    if (ask && altSlots(teamById(team)).length) setLineupFor(who);
  };
  const step = (who, d) => {
    const [sel] = sides[who];
    pickTeam(who, TEAMS[(idx(sel.team) + d + TEAMS.length) % TEAMS.length].id, false);
  };

  useEffect(() => {
    const key = (e) => {
      if (grid || info || lineupFor || e.target.closest?.('input, textarea')) return;
      if (e.key === 'ArrowLeft') step('you', -1);
      if (e.key === 'ArrowRight') step('you', 1);
      if (e.key === 'Enter' && !clash) onStart({ you, cpu, level, mode });
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  return (
    <main className="ts">
      <div className="ts-halves">
        <Half who="you" label="You" tag="HOME" sel={you} set={setYou} step={(d) => step('you', d)} random={() => pickTeam('you', randomTeam(you.team), false)} openGrid={() => setGrid('you')} onInfo={setInfo} onLineup={() => setLineupFor('you')} />
        <Half who="cpu" label="Computer" tag="AWAY" mirror sel={cpu} set={setCpu} step={(d) => step('cpu', d)} random={() => pickTeam('cpu', randomTeam(cpu.team), false)} openGrid={() => setGrid('cpu')} onInfo={setInfo} onLineup={() => setLineupFor('cpu')} />
      </div>
      <div className="ts-center glass">
        <div className="opt"><span>Computer</span><Chips small value={level} onChange={setLevel} options={LEVELS} /></div>
        <div className="opt"><span>Rules</span><ModePicker value={mode} onChange={setMode} /></div>
        <p className="hint mode-info">{MODE_INFO[mode]}</p>
        {clash && <p className="warn">Same team, same uniform: change one side's uniform.</p>}
        <Button kind="primary" size="big" disabled={clash} onClick={() => onStart({ you, cpu, level, mode })}>Take the field <kbd className="kh">Enter</kbd></Button>
        <p className="hint">← → flips through teams. Rookie makes mistakes, Starter plays the odds, All-Pro manages cards, the clock and coverage.</p>
      </div>
      {grid && <TeamGrid current={sides[grid][0].team} onPick={(t) => { pickTeam(grid, t); setGrid(null); }} onClose={() => setGrid(null)} />}
      {info && <AbilityCard p={info} onClose={() => setInfo(null)} />}
      {lineupFor && <LineupPicker sel={sides[lineupFor][0]} set={sides[lineupFor][1]} onClose={() => setLineupFor(null)} />}
    </main>
  );
}

function Half({ who, label, tag, sel, set, step, random, openGrid, onInfo, onLineup, mirror }) {
  const team = teamById(sel.team);
  // very light primaries (white jerseys) would wash out the white lettering: use the trim colour behind instead
  const [p0, p1] = teamColors(sel.team, sel.uni);
  const [c0, c1] = lum(p0) > 0.72 ? [p1, p0] : [p0, p1];
  const players = lineup(team, sel.picks).filter((p) => p.abilities?.length);
  const stars = players.reduce((n, p) => n + p.abilities.length, 0);
  const hasAlt = altSlots(team).length > 0;
  const rows = Object.fromEntries(rosterFor(sel.team, sel.uni).map((p) => [p.num, p.row]));
  const helmet = helmetUrl(sel.team);
  return (
    <section className={`ts-half ${mirror ? 'mirror' : ''}`} style={{ '--c0': c0, '--c1': c1 }}>
      <header className="ts-top">
        <span className="ts-who">{label}</span>
        <div className="ts-nav">
          <Button size="small" onClick={() => step(-1)} aria-label="Previous team">◀</Button>
          <Button size="small" onClick={openGrid}>All teams</Button>
          <Button size="small" onClick={() => step(1)} aria-label="Next team">▶</Button>
          <Button size="small" onClick={random} title="Random team">Random</Button>
        </div>
      </header>
      <div className="ts-body">
        <div className="ts-players">
          {players.map((p) => (
            <button key={`${p.num}${p.name}`} className="ts-card" onClick={() => onInfo({ ...p, team: team.name, c0, c1 })}>
              <span className="ts-card-name">{p.name}</span>
              <span className="ts-card-art">
                <i>#{p.num}</i>
                <Sprite team={sel.team} uni={sel.uni} row={rows[p.artNum ?? p.num] ?? 0} />
              </span>
              <span className="ts-card-skill">{p.abilities.join(' · ')}</span>
            </button>
          ))}
          {/* alternates: who suits up, right under the players it changes */}
          {hasAlt && <Button size="small" className="ts-lineup" onClick={onLineup}>Lineup{Object.values(sel.picks).includes('alt') ? ' (alternate)' : ''}</Button>}
        </div>
        <div className="ts-logo">{helmet && <img src={helmet} alt={`${team.name} helmet`} />}</div>
      </div>
      <footer className="ts-foot">
        <div className="ts-ring" title="Special abilities on the roster"><b>{stars}</b><small>★</small></div>
        <div className="ts-name">
          <h2>{team.name.toUpperCase()}</h2>
          <small>{tag}</small>
        </div>
        <div className="ts-opts">
          <Chips small value={sel.uni} onChange={(u) => set({ ...sel, uni: u })} options={uniformsFor(sel.team).map((u) => [u.id, u.label])} />
        </div>
      </footer>
      <span className="sr-only">{who}</span>
    </section>
  );
}

export function TeamGrid({ current, onPick, onClose }) {
  useEscape(onClose);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card glass ts-grid-card" onClick={(e) => e.stopPropagation()}>
        <h2>Pick a team</h2>
        <div className="ts-grid">
          {TEAMS.map((t) => {
            const [c0] = teamColors(t.id, 'home');
            return (
              <button key={t.id} className={`ts-grid-tile ${t.id === current ? 'on' : ''}`} style={{ '--c0': c0 }} onClick={() => onPick(t.id)}>
                {helmetUrl(t.id) ? <img src={helmetUrl(t.id, true)} alt="" loading="lazy" decoding="async" /> : <Sprite team={t.id} uni="home" />}
                <small>{t.name}</small>
              </button>
            );
          })}
        </div>
        <div className="btns"><Button onClick={onClose}>Close</Button></div>
      </div>
    </div>
  );
}

export function AbilityCard({ p, onClose }) {
  useEscape(onClose);
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card glass ability-card" style={{ '--c0': p.c0 }} onClick={(e) => e.stopPropagation()}>
        <h2>#{p.num} {p.name}</h2>
        <p className="hint">{p.team} · skill {p.skill} · {p.tier === 'superstar' ? 'Superstar' : p.tier === 'star' ? 'Star' : 'Impact player'}</p>
        <ul>{p.abilities.map((a) => <li key={a}><b>{a}</b><span>{abilityText(a)}</span></li>)}</ul>
        <p className="hint">Abilities are used in All Techno, All Pro and Inferno.</p>
        <div className="btns"><Button kind="primary" onClick={onClose}>Got it</Button></div>
      </div>
    </div>
  );
}

export function LineupPicker({ sel, set, onClose }) {
  useEscape(onClose);
  const team = teamById(sel.team);
  const slots = altSlots(team);
  const choose = (slot, v) => set({ ...sel, picks: { ...sel.picks, [slot]: v } });
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card glass lineup-card" onClick={(e) => e.stopPropagation()}>
        <h2>{team.name}: who suits up?</h2>
        <p className="hint">{team.name} have alternate players. Pick one for each spot.</p>
        {slots.map((s) => (
          <div key={s.slot} className="lineup-slot">
            {[['reg', s.regular], ['alt', s.alternate]].map(([k, p]) => {
              const on = (sel.picks[s.slot] ?? 'reg') === k;
              return (
                <button key={k} className={`lineup-opt ${on ? 'on' : ''}`} onClick={() => choose(s.slot, k)}>
                  <b>#{p.num} {p.name}</b>
                  <small>{k === 'alt' ? 'Alternate' : 'Regular'} · skill {p.skill}</small>
                  <ul>{p.abilities.map((a) => <li key={a}><i>{a}</i> {abilityText(a)}</li>)}</ul>
                </button>
              );
            })}
          </div>
        ))}
        <div className="btns"><Button kind="primary" onClick={onClose}>Done</Button></div>
      </div>
    </div>
  );
}

function useEscape(fn) {
  useEffect(() => {
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); fn(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [fn]);
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
